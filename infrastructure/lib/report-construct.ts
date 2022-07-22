import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cw_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Construct } from 'constructs';

export interface BaseReportConstructProps {
  /**
   * The email address from which the report email will be sent
   */
  senderEmail: string;
}

export interface ReportConstructProps extends BaseReportConstructProps {
  /**
   * The table from which data will be replicated
   */
  sourceTable: dynamodb.Table;
  /**
   * The alarm topic arn
   */
  alarmTopicArn: string;
}
export class ReportConstruct extends Construct {
  constructor(scope: Construct, id: string, props: ReportConstructProps) {
    super(scope, id);
    //lambda for sending hourly reports to gym representatives
    const dataTable = props.sourceTable;

    const reportSlotReservations = new lambda.Function(this, 'SlotReportsFn', {
      code: new lambda.AssetCode('../scripts/report-email-sender', {
        bundling: {
          image: cdk.DockerImage.fromRegistry('public.ecr.aws/sam/build-python3.8:latest'),
          command: ['sh', 'cdk-build.sh'],
          user: '1000',
        },
      }),

      runtime: lambda.Runtime.PYTHON_3_8,
      handler: 'main.lambda_handler',
      description: 'Function to send hourly reports of slot reservations to gym representative',
      logRetention: logs.RetentionDays.TWO_WEEKS,
      memorySize: 128,
      timeout: cdk.Duration.seconds(15),

      environment: {
        DATA_TABLE: dataTable.tableName,
        SENDER_EMAIL: props.senderEmail,
      },
    });

    dataTable.grantReadData(reportSlotReservations);

    reportSlotReservations.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'SES:SendRawEmail', 'SES:SendTemplatedEmail'],
        resources: ['*'],
        effect: iam.Effect.ALLOW,
      }),
    );

    const eventRule = new events.Rule(this, 'scheduleRule', {
      schedule: events.Schedule.cron({ minute: '0', hour: '9-18', weekDay: '2-6' }),
    });

    eventRule.addTarget(new targets.LambdaFunction(reportSlotReservations));

    const alarmTopic = sns.Topic.fromTopicArn(this, 'alarmTopic', props.alarmTopicArn);

    const dynamoToEsErrors = reportSlotReservations.metricErrors({
      period: cdk.Duration.minutes(1),
    });

    const dynamoError = new cloudwatch.Alarm(this, 'ReportEmailAlarm', {
      metric: dynamoToEsErrors,
      threshold: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      evaluationPeriods: 1,
      alarmDescription: 'An error occurred during the ReportSlotReservation function execution',
    });

    dynamoError.addAlarmAction(new cw_actions.SnsAction(alarmTopic));
  }
}
