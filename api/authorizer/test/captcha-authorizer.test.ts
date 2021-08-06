import { permissionResponseForData, getDataFromEvent } from '../src/captcha-authorizer';
import { AxiosResponse } from 'axios';
import { APIGatewayRequestAuthorizerEvent } from 'aws-lambda';

describe('Captcha Authorizer', () => {
  describe('Make permission', () => {
    test('success', () => {
      // GIVEN
      const response = <AxiosResponse<any>>{ data: { success: true } };
      const methodArn = 'arn:test:test/test';
      // WHEN
      const permission = permissionResponseForData(response, methodArn);
      // EXPECT
      expect(permission).toMatchObject({
        policyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Action: 'execute-api:Invoke',
              Effect: 'Allow',
              Resource: methodArn,
            },
          ],
        },
      });
    });
    test('failure', () => {
      // GIVEN
      const response = <AxiosResponse<any>>{ data: { success: false } };
      const methodArn = 'arn:test:test/test';
      // WHEN
      const permission = permissionResponseForData(response, methodArn);
      // EXPECT
      expect(permission).toMatchObject({
        policyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Action: 'execute-api:Invoke',
              Effect: 'Deny',
              Resource: methodArn,
            },
          ],
        },
      });
    });
  });

  describe('getDataFromEvent', () => {
    test('good data', () => {
      const event = <APIGatewayRequestAuthorizerEvent>(<unknown>{
        headers: { 'x-captcha': 'mycaptcha' },
        requestContext: {
          identity: {
            sourceIp: '123.123.123.123',
          },
        },
      });
      const [token, ip] = getDataFromEvent(event);
      expect(token).toStrictEqual('mycaptcha');
      expect(ip).toStrictEqual('123.123.123.123');
    });
    test('missing header', () => {
      const event = <APIGatewayRequestAuthorizerEvent>(<unknown>{
        headers: { 'fake-header': 'mycaptcha' },
        requestContext: {
          identity: {
            sourceIp: '123.123.123.123',
          },
        },
      });
      expect(() => getDataFromEvent(event)).toThrowError();
    });
  });
});
