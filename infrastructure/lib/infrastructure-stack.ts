import * as cdk from '@aws-cdk/core';
import { ApiGatewayConstruct } from './apigateway-construct';
import { WebAppConstruct, BaseWebAppConstructProps } from './webapp-stack';
import { CoreConstruct } from './core-construct';
import { SearchConstruct, BaseSearchConstructProps } from './search-construct';
import { BaseReportConstructProps, ReportConstruct } from './report-construct';
import { AuthConstruct } from './auth-construct';
import { ConfigWriterConstruct } from './config-env-writer';

export interface InfrastructureStackProps extends cdk.StackProps {
  // userManagement: DarvadUserManagementConstructProps;
  endUserWebApp: BaseWebAppConstructProps;
  // adminWebApp: BaseDarvadWebAppConstructProps;
  /**
   * Indirizzo email da usare per l'invio delle mail di avvenuta prenotazione all'utente
   */
  bookingSourceEmail: string;
  /**
   * Whether to delete everything on removal of the stack,
   * should be false ONLY for production or other sensitive environments
   */
  destroyOnRemoval: boolean;
  /**
   * Arn of the map to use in the frontend.
   */
  locationMapArn: string;
  /**
   * Props for the search construct
   */
  searchProps: BaseSearchConstructProps;

  /**
   * Props for the report construct
   */
  reportProps: BaseReportConstructProps;

  /**
   * The captcha key to use
   */
  captcha?: CaptchaProps;
}

export interface CaptchaProps {
  /**
   * The Site Key
   *
   * @see https://developers.google.com/recaptcha/docs/v3
   */
  key: string;
  /**
   * The Secret Key
   *
   * @see https://developers.google.com/recaptcha/docs/v3
   */
  secret: string;
}

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: InfrastructureStackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    const core = new CoreConstruct(this, 'Core', {
      userWebAppDomain: props.endUserWebApp.domain,
      bookingSourceEmail: props.bookingSourceEmail,
      destroyOnRemoval: props.destroyOnRemoval,
    });

    // const userManagement = new DarvadUserManagementConstruct(this, 'Users', props.userManagement);

    const search = new SearchConstruct(this, 'Search', {
      ...props.searchProps,
      sourceTable: core.dataTable,
    });

    const mainGW = new ApiGatewayConstruct(this, 'MainApi', {
      createBookingLambda: core.createBookingLambda,
      deleteBookingLambda: core.deleteBookingLambda,
      dataTable: core.dataTable,
      indexBookingIdName: core.indexBookingIdName,
      // userPool: userManagement.userPool,
      captchaSecret: props.captcha?.secret,
      searchLambda: search.searchFn,
    });

    let regexLocationName = props.locationMapArn.match(/.*:map\/(.*)/);
    if (!regexLocationName) {
      regexLocationName = ['', 'explore.map'];
    }

    const auth = new AuthConstruct(this, 'Auth', {
      locationMapArn: props.locationMapArn,
    });

    const endUserCDN = new WebAppConstruct(this, 'EndUser', {
      apiStage: mainGW.stage,
      captchaSecret: props.captcha?.secret,
      mapIdentityPoolId: auth.identityPool.ref,
      region: props.env?.region ?? 'eu-west-1',
      ...props.endUserWebApp,
    });

    const configWriter = new ConfigWriterConstruct(this, 'ConfigWriter', {
      bucket: endUserCDN.frontendBucket,
      objectKey: 'v1/assets/config-env.json',
      baseUrl: props.endUserWebApp.apiBaseUrl,
      awsRegion: props.env?.region ?? 'eu-west-1',
      awsMapName: regexLocationName[1],
      awsIdentityPoolId: auth.identityPool.ref,
      siteKeyCaptcha: props.captcha?.key ?? '',
    });

    configWriter.node.addDependency(auth.identityPool);
    configWriter.node.addDependency(endUserCDN.frontendBucket);

    const report = new ReportConstruct(this, 'Report', {
      sourceTable: core.dataTable,
      ...props.reportProps,
    });

    /*
    // const adminCDN = new WebAppConstruct(this, 'Admin', {
    //   apiStage: mainGW.stage,
    //   ...props.adminWebApp,
    // });
    */
  }
}
