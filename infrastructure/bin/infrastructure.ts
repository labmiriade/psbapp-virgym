#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { InfrastructureStack, InfrastructureStackProps } from '../lib/infrastructure-stack';

const env: cdk.Environment = {
  account: '<ACCOUNT_ID>',
  region: '<AWS_REGION>',
};

const app = new cdk.App();
cdk.Tags.of(app).add('project', 'PSBAPP');

/////// STACK DI SVILUPPO

// default props for all dev env: customizable afterwards
function makeDefaultDevProps(ownerName: string): InfrastructureStackProps {
  return {
    env,
    endUserWebApp: {
      domain: `virgym-${ownerName.toLowerCase()}.example.org`,
      buildCommand: 'testBuild',
      shouldCacheS3: false,
      zoneName: undefined, // route53 is not in the same account
      certificateArn: '<CERTIFICATE_ARN>',
      apiBaseUrl: `/api`,
    },
    bookingSourceEmail: 'virgym-dev@example.org',
    captcha: {
      'secret': '<reCAPTCHA SECRET>',
      'key': '<reCAPTCHA KEY>',
    },
    description: `Development Stack for PsbApp - VirGym owned by ${ownerName}`,
    destroyOnRemoval: true,
    locationMapArn: '<LOCATION_MAP_ARN>',
    searchProps: {
      indexPrefix: ownerName,
      reuseDomainAttributes: {
        domainArn: '<ES_DOMAIN_ARN>',
        domainEndpoint: '<ES_ENDPOINT>',
      },
    },
    reportProps: {
      senderEmail: 'psbapp@example.org',
    },
  };
}

// an object with all dev props
const devProps: { [ownerEmail: string]: InfrastructureStackProps } = {
  'user@example.org': makeDefaultDevProps('user'),
};

// creates a stack for each dev
for (const ownerEmail of Object.keys(devProps)) {
  const ownerName = ownerEmail.split('@')[0].replace('.', ''); // from n.cognome@mail.com to ncognome
  const stackName = `PSBAPPVirGymDev${ownerName}`;
  const props = devProps[ownerEmail];
  const stack = new InfrastructureStack(app, stackName, props);
  cdk.Tags.of(stack).add('referente', ownerEmail);
  cdk.Tags.of(stack).add('owner', ownerEmail);
  cdk.Tags.of(stack).add('environment', 'dev');
}