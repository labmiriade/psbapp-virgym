import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as dynamo from '@aws-cdk/aws-dynamodb';
import * as logs from '@aws-cdk/aws-logs';
import * as iam from '@aws-cdk/aws-iam';
import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import * as events from '@aws-cdk/aws-events';
import * as targets from '@aws-cdk/aws-events-targets';
import * as s3 from '@aws-cdk/aws-s3';
import * as s3n from '@aws-cdk/aws-s3-notifications';

export interface CoreConstructProps {
  bookingSourceEmail: string;
  userWebAppDomain: string;
  /**
   * Whether to delete everything on removal of the stack,
   * should be false ONLY for production or other sensitive environments
   */
  destroyOnRemoval: boolean;
}

/**
 * Constract with all core resources
 */
export class CoreConstruct extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: CoreConstructProps) {
    super(scope, id);

    const removalPolicy = props.destroyOnRemoval ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN;

    // Data Table con tutti i dati
    const dataTable = new dynamo.Table(this, 'DataTable', {
      partitionKey: {
        name: 'pk',
        type: dynamo.AttributeType.STRING,
      },
      sortKey: {
        name: 'sk',
        type: dynamo.AttributeType.STRING,
      },
      billingMode: dynamo.BillingMode.PAY_PER_REQUEST,
      stream: dynamo.StreamViewType.NEW_IMAGE,
      removalPolicy: removalPolicy,
    });

    // Global Secondary Index per bookingId
    const indexBookingIdName = 'GSI1';
    dataTable.addGlobalSecondaryIndex({
      indexName: indexBookingIdName,
      partitionKey: {
        name: 'gsi1pk',
        type: dynamo.AttributeType.STRING,
      },
    });
    this.indexBookingIdName = indexBookingIdName;

    // default properties for lambda creation
    const defaultLambdaProps: lambda.FunctionProps = {
      code: new lambda.AssetCode('../api/booking', {
        bundling: {
          image: cdk.DockerImage.fromRegistry('node:14-alpine'),
          command: ['sh', 'cdk-build.sh'],
          user: '1000',
        },
      }),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      logRetention: logs.RetentionDays.TWO_WEEKS,
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      environment: {
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        dataTable: dataTable.tableName,
        bookingEmail: props.bookingSourceEmail,
        bookingBaseUrl: `https://${props.userWebAppDomain}/b/`,
      },
    };

    // const policy to allow sending of booking notifications
    const sesSendBookingPolicy = new iam.PolicyStatement({
      actions: ['ses:SendEmail', 'ses:SendTemplatedEmail', 'ses:SendRawEmail', 'ses:SendBulkTemplatedEmail'],
      effect: iam.Effect.ALLOW,
      resources: ['*'],
      conditions: {
        StringLike: {
          'ses:FromAddress': props.bookingSourceEmail,
        },
      },
    });
    const snsSendSMSBookingPolicy = new iam.PolicyStatement({
      actions: ['sns:Publish'],
      effect: iam.Effect.ALLOW,
      resources: ['*'],
    });

    // lambda to allow creation of new bookings
    const createBookingLambda = new lambda.Function(this, 'CreateBookingFn', {
      ...defaultLambdaProps,
      code: new lambda.AssetCode('../api/booking', {
        bundling: {
          image: cdk.DockerImage.fromRegistry('node:14-alpine'),
          command: ['sh', 'cdk-build.sh'],
          user: '1000',
        },
      }),
      description: 'Function to make a reservation',
      handler: 'create-booking.handler',
      memorySize: 512,
    });
    dataTable.grantReadWriteData(createBookingLambda);
    createBookingLambda.addToRolePolicy(sesSendBookingPolicy);
    createBookingLambda.addToRolePolicy(snsSendSMSBookingPolicy);

    // lambda to allow deletion of new bookings
    const deleteBookingLambda = new lambda.Function(this, 'DeleteBookingFn', {
      ...defaultLambdaProps,
      code: new lambda.AssetCode('../api/booking', {
        bundling: {
          image: cdk.DockerImage.fromRegistry('node:14-alpine'),
          command: ['sh', 'cdk-build.sh'],
          user: '1000',
        },
      }),
      description: 'Function to revoke a reservation',
      handler: 'delete-booking.handler',
    });
    dataTable.grantReadWriteData(deleteBookingLambda);

    // lambda to import virtual gyms to dynamodb
    const virGymImportLambda = new lambda.Function(this, 'VirGymImportFn', {
      code: new lambda.AssetCode('../etl/import-virgym', {
        bundling: {
          image: cdk.DockerImage.fromRegistry('public.ecr.aws/sam/build-python3.8:latest'),
          command: ['sh', 'cdk-build.sh'],
          user: '1000',
        },
      }),
      handler: 'main.lambda_handler',
      runtime: lambda.Runtime.PYTHON_3_8,
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      description: 'Lambda per importare palestre digitali',
      environment: {
        DATA_TABLE: dataTable.tableName,
      },
    });
    dataTable.grantReadWriteData(virGymImportLambda);

    const virGymImportErrors = virGymImportLambda.metricErrors({
      period: cdk.Duration.minutes(1),
    });

    new cloudwatch.Alarm(this, 'virGymImportErrorsAlarm', {
      metric: virGymImportErrors,
      threshold: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      evaluationPeriods: 1,
      alarmDescription: 'An error occurred during the VirGymImport function execution',
    });

    const eventRule = new events.Rule(this, 'scheduleRule', {
      schedule: events.Schedule.cron({ minute: '0', hour: '4' }),
    });

    eventRule.addTarget(new targets.LambdaFunction(virGymImportLambda));

    // lambda to import slots from s3
    const slotImportLambda = new lambda.Function(this, 'SlotImportFn', {
      code: new lambda.AssetCode('../etl/import-slot', {
        bundling: {
          image: cdk.DockerImage.fromRegistry('public.ecr.aws/sam/build-python3.8:latest'),
          command: ['sh', 'cdk-build.sh'],
          user: '1000',
        },
      }),
      handler: 'main.lambda_handler',
      runtime: lambda.Runtime.PYTHON_3_8,
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      description: 'Lambda per importare slots',
      environment: {
        DATA_TABLE: dataTable.tableName,
      },
    });
    dataTable.grantReadWriteData(slotImportLambda);
    this.createBookingLambda = createBookingLambda;
    this.deleteBookingLambda = deleteBookingLambda;
    this.dataTable = dataTable;

    // create the bucket for the slot files
    const bucket = new s3.Bucket(this, 'Slot', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    bucket.addObjectCreatedNotification(new s3n.LambdaDestination(slotImportLambda));
    bucket.grantRead(slotImportLambda);
  }

  /**
   * The main Table
   */
  dataTable: dynamo.Table;
  /**
   * The name of the index on the `bookingId` attribute on `dataTable`
   */
  indexBookingIdName: string;
  /**
   * The Lambda function that creates new bookings
   */
  createBookingLambda: lambda.Function;
  /**
   * The Lambda function that creates new bookings
   */
  deleteBookingLambda: lambda.Function;
}
