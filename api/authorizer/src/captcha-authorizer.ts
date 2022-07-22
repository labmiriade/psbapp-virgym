import * as lambda from 'aws-lambda';
import axios, { AxiosResponse } from 'axios';
import { inspect } from 'util';

/**
 * The secret for captcha validation (from google captcha console)
 */
const testCaptcha = '<RECAPTCHA_TOKEN>';
const devPassword = 'un-cartellino-per-arianna';
const captchaSecret = process.env['captchaSecret'] || testCaptcha;
/**
 * Whether the captcha should validate incoming IP
 * @default true
 */
const captchaValidateIP: boolean = process.env['captchaValidateIP'] != 'false';

export async function handler(
  event: lambda.APIGatewayRequestAuthorizerEvent,
  context: lambda.APIGatewayAuthorizerResultContext,
): Promise<lambda.APIGatewayAuthorizerResult> {
  // if captcha secret is not set, accept the secret phrase for test environments
  if (captchaSecret == testCaptcha) {
    let [token, sourceIp] = getDataFromEvent(event);
    let isAuthorized = token === devPassword;
    return {
      principalId: 'devUser',
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: isAuthorized ? 'Allow' : 'Deny',
            Resource: event.methodArn,
          },
        ],
      },
    };
  }

  /// the response that will be sent to the api gw
  let response: lambda.APIGatewayAuthorizerResult;
  /// the response from google
  let captchaResponse: AxiosResponse<any> | null;
  try {
    // get the token and source ip
    let [token, sourceIp] = getDataFromEvent(event);
    // validate token only if the `captchaValidateIP` variable is true
    captchaResponse = await queryForCaptcha(token, captchaValidateIP ? sourceIp : null);
  } catch (message) {
    // log the error
    if (typeof message === 'string') {
      console.log(message);
    } else {
      console.error(`error thrown ${inspect(message, false, null)}`);
    }
    // set the response to null, to deny
    captchaResponse = null;
  }
  // create the response
  response = permissionResponseForData(captchaResponse, event.methodArn);
  console.log(`response = ${inspect(response, false, null)}`);
  return response;
}

async function queryForCaptcha(token: string, ip: string | null): Promise<AxiosResponse<any>> {
  const captchaUrl = 'https://www.google.com/recaptcha/api/siteverify';
  let data = `secret=${encodeURIComponent(captchaSecret)}&response=${encodeURIComponent(token)}`;
  if (ip != null) {
    data += `&remoteip=${encodeURIComponent(ip)}`;
  }
  return await axios.post(captchaUrl, data, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
}

/**
 * Given an event, detects captcha token and source ip
 * @param event the incoming event to authorize
 */
export function getDataFromEvent(event: lambda.APIGatewayRequestAuthorizerEvent): [string, string] {
  let token = event.headers?.['x-captcha'];
  let sourceIp = event.requestContext.identity.sourceIp;
  if (token === undefined) {
    throw `Unable to find token in event ${inspect(event, false, null)}`;
  }
  if (sourceIp === undefined) {
    throw `Unable to find ip in event ${inspect(event, false, null)}`;
  }
  return [token, sourceIp];
}

export function permissionResponseForData(
  response: AxiosResponse<any> | null,
  methodArn: string,
): lambda.APIGatewayAuthorizerResult {
  let isSuccess = response?.data.success ?? false;
  let statement: lambda.Statement = {
    Action: 'execute-api:Invoke',
    Effect: isSuccess ? 'Allow' : 'Deny',
    Resource: methodArn,
  };
  if (!isSuccess) {
    console.info(`statusCode from captcha: ${response?.status}`);
    console.info(`response from captcha: ${inspect(response?.data)}`);
  }
  return {
    principalId: 'anonymousUser',
    policyDocument: {
      Version: '2012-10-17',
      Statement: [statement],
    },
  };
}
