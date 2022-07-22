import * as cdk from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as dynamo from 'aws-cdk-lib/aws-dynamodb';
import { OpenAPI } from './open-api';
import { JsonSchema } from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export interface ApiGatewayConstructProps {
  /**
   * Function per la creazione di una nuova prenotazione
   */
  createBookingLambda: lambda.IFunction;
  /**
   * Function per la creazione di una nuova prenotazione
   */
  deleteBookingLambda: lambda.IFunction;
  /**
   * Function per la ricerca di places
   */
  searchLambda: lambda.IFunction;
  /**
   * Function per il get di un place
   */
  getPlaceLambda: lambda.IFunction;
  /**
   * DynamoDB Table con i dati
   */
  dataTable: dynamo.Table;

  indexBookingIdName: string;
  /**
   * The captcha secret given from google
   */
  captchaSecret?: string;
}

/**
 * Construct per la creazione delle risorse legate all'API Gateway.
 *
 * Le funzioni lambda vengono passate al costrutture tramite `props`, mentre le integrazioni
 * di tipo AWS (chiamate dirette a DynamoDB) vengono costruite qui.
 */
export class ApiGatewayConstruct extends Construct {
  constructor(scope: Construct, id: string, props: ApiGatewayConstructProps) {
    super(scope, id);

    // L'API Gateway che servirà l'API.
    const api = new apigw.RestApi(this, 'Gateway', {
      deployOptions: {
        description: 'Stage di default',
        loggingLevel: apigw.MethodLoggingLevel.INFO,
        stageName: 'api',
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
      deploy: true,
      description: 'Pasubio App VirGym API',
      endpointTypes: [apigw.EndpointType.EDGE],
      minimumCompressionSize: 0,
    });

    const fullValidator = api.addRequestValidator('BodyValidator', {
      validateRequestBody: true,
      validateRequestParameters: true,
    });

    // lambda che verifica un codice captcha in ingresso
    const captchaAuthFn = new lambda.Function(this, 'CaptchaAuthFn', {
      code: new lambda.AssetCode('../api/authorizer', {
        bundling: {
          image: cdk.DockerImage.fromRegistry('node:14-alpine'),
          command: ['sh', 'cdk-build.sh'],
          user: '1000',
        },
      }),
      handler: 'captcha-authorizer.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      memorySize: 128,
      logRetention: logs.RetentionDays.TWO_WEEKS,
      environment: {
        captchaValidateIP: 'true',
        captchaSecret: props.captchaSecret ?? '',
      },
    });
    // authorizer che autorizza l'utente controllando il captcha in ingresso
    const captchaAuthorizer = new apigw.RequestAuthorizer(this, 'CaptchaAuthorizer', {
      handler: captchaAuthFn,
      identitySources: [apigw.IdentitySource.header('x-captcha')],
      resultsCacheTtl: cdk.Duration.seconds(0),
    });

    // integration per creare una nuova prenotazione
    const createBookingInteg = new apigw.LambdaIntegration(props.createBookingLambda, {
      proxy: true,
    });

    // integration per creare una nuova prenotazione
    const deleteBookingInteg = new apigw.LambdaIntegration(props.deleteBookingLambda, {
      proxy: true,
    });

    // ruolo utilizzato dalle integrazioni che fanno query (sola lettura) a dataTable
    const dataTableReadWriteRole = new iam.Role(this, 'TableQueryRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
    });
    props.dataTable.grantReadWriteData(dataTableReadWriteRole);

    // integration per ottenere le Place Info
    const getPlaceInteg = new apigw.LambdaIntegration(props.getPlaceLambda, { proxy: true });

    // creo la risorsa `/p`
    const p = api.root.addResource('p');
    // creo la risorsa `/p/{placeId}`
    const placeId = p.addResource('{placeId}');
    // creo il metodo `GET /p/{placeId}`
    placeId.addMethod('GET', getPlaceInteg, {
      // configuro la risposta della API
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            // 'application/json': new apigw.Model(this, 'PlaceInfoModel', {
            //   restApi: api,
            //   // importo lo schema dal file OpenAPI
            //   schema: <JsonSchema>OpenAPI.components.schemas.PlaceInfo,
            //   modelName: 'PlaceInfo',
            // }),
            'application/json': apigw.Model.EMPTY_MODEL,
          },
        },
        {
          statusCode: '404',
          responseModels: {
            'application/json': apigw.Model.ERROR_MODEL,
          },
        },
      ],
      requestModels: {
        'application/json': apigw.Model.EMPTY_MODEL,
      },
      requestParameters: {
        'method.request.path.placeId': true,
      },
    });

    // integration per ottenere la lista di bookings
    const getPlaceBookingsInteg = new apigw.AwsIntegration({
      service: 'dynamodb',
      action: 'Query',
      options: {
        credentialsRole: dataTableReadWriteRole,
        requestTemplates: {
          'application/json': JSON.stringify({
            TableName: props.dataTable.tableName,
            ConsistentRead: false,
            ExpressionAttributeNames: {
              '#pk': 'pk',
              '#sk': 'sk',
            },
            ExpressionAttributeValues: {
              ':placeId': {
                S: "p-$input.params('placeId')",
              },
              ':startDate': {
                S: "b-$input.params('from')",
              },
              ':endDate': {
                S: "b-#if($input.params('to')=='')9999#else$input.params('to')#end",
              },
            },
            KeyConditionExpression: '#pk = :placeId AND #sk BETWEEN :startDate AND :endDate',
          }),
        },
        passthroughBehavior: apigw.PassthroughBehavior.NEVER,
        integrationResponses: [
          {
            statusCode: '200',
            responseTemplates: {
              'application/json': bookingsResponseTemplate,
            },
          },
        ],
      },
    });
    // creo la risorsa `/p/{placeId}/bookings`
    const placeBookings = placeId.addResource('bookings');
    // creo il metodo `GET /p/{placeId}/bookings`
    placeBookings.addMethod('GET', getPlaceBookingsInteg, {
      requestParameters: {
        'method.request.path.placeId': true,
      },
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            'application/json': apigw.Model.EMPTY_MODEL,
          },
        },
      ],
      authorizationType: apigw.AuthorizationType.IAM,
    });
    // integration per impostare un booking come entered
    const updateBookingInteg = new apigw.AwsIntegration({
      service: 'dynamodb',
      action: 'UpdateItem',
      options: {
        credentialsRole: dataTableReadWriteRole,
        requestTemplates: {
          'application/json': JSON.stringify({
            TableName: props.dataTable.tableName,
            ExpressionAttributeValues: {
              ':e': {
                BOOL: true,
              },
            },
            Key: {
              pk: {
                S: "p-$input.params('placeId')",
              },
              sk: {
                S: "b-$input.params('bookingId')",
              },
            },
            UpdateExpression: 'SET entered = :e',
            ReturnValues: 'ALL_NEW',
          }),
        },
        passthroughBehavior: apigw.PassthroughBehavior.NEVER,
        integrationResponses: [
          {
            statusCode: '200',
            responseTemplates: {
              'application/json': bookingIdResponseTemplate,
            },
          },
        ],
      },
    });
    // creo la risorsa `/p/{placeId}/b`
    const placeBookingsShort = placeId.addResource('b');
    // creo la risorsa `/p/{placeId}/b/{bookingId}`
    const placeBooking = placeBookingsShort.addResource('{bookingId}');
    // creo la risorsa `/p/{placeId}/b/{bookingId}/entered`
    const placeBookingEntered = placeBooking.addResource('entered');
    // creo il metodo `PUT /p/{placeId}/b/{bookingId}/entered`
    placeBookingEntered.addMethod('PUT', updateBookingInteg, {
      requestParameters: {
        'method.request.path.placeId': true,
        'method.request.path.bookingId': true,
      },
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            'application/json': apigw.Model.EMPTY_MODEL,
          },
        },
      ],
      authorizationType: apigw.AuthorizationType.IAM,
    });

    // integration per ottenere la lista di slot
    const getSlots = new apigw.AwsIntegration({
      service: 'dynamodb',
      action: 'Query',
      options: {
        credentialsRole: dataTableReadWriteRole,
        requestTemplates: {
          'application/json': JSON.stringify({
            TableName: props.dataTable.tableName,
            ConsistentRead: false,
            ExpressionAttributeNames: {
              '#pk': 'pk',
              '#sk': 'sk',
            },
            ExpressionAttributeValues: {
              ':placeId': {
                S: "p-$input.params('placeId')",
              },
              ':startDate': {
                S: "s-$input.params('from')",
              },
              ':endDate': {
                S: "s-#if($input.params('to')=='')9999#else$input.params('to')#end",
              },
            },
            KeyConditionExpression: '#pk = :placeId AND #sk BETWEEN :startDate AND :endDate',
          }),
        },
        passthroughBehavior: apigw.PassthroughBehavior.NEVER,
        integrationResponses: [
          {
            statusCode: '200',
            responseTemplates: {
              'application/json': slotsResponseTemplate,
            },
          },
        ],
      },
    });

    // creo la risorsa `/p/{placeId}/slots`
    const slots = placeId.addResource('slots');
    // creo il metodo `GET /p/{placeId}/slots`
    slots.addMethod('GET', getSlots, {
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            'application/json': apigw.Model.EMPTY_MODEL,
          },
        },
      ],
      requestModels: {
        'application/json': apigw.Model.EMPTY_MODEL,
      },
      requestParameters: {
        'method.request.path.placeId': true,
        'method.request.querystring.from': true,
      },
    });

    // creo la risorsa `/p/{placeId}/slots/{slotId}`
    const slotId = slots.addResource('{slotId}');

    // creo la risorsa `/p/{placeId}/slots/{slotId}/bookings`
    const bookings = slotId.addResource('bookings');

    // creo il metodo `POST /p/{placeId}/slots` per creare una nuova prenotazione
    bookings.addMethod('POST', createBookingInteg, {
      authorizer: captchaAuthorizer,
    });

    // integration per ottenere una singola Booking Info
    const getBookingInteg = new apigw.AwsIntegration({
      service: 'dynamodb',
      action: 'Query',
      options: {
        credentialsRole: dataTableReadWriteRole,
        requestTemplates: {
          'application/json': JSON.stringify({
            TableName: props.dataTable.tableName,
            IndexName: props.indexBookingIdName,
            ExpressionAttributeValues: {
              ':bookingId': {
                S: "b-$input.params('bookingId')",
              },
            },
            KeyConditionExpression: 'gsi1pk = :bookingId',
            Select: 'ALL_ATTRIBUTES',
          }),
        },
        passthroughBehavior: apigw.PassthroughBehavior.NEVER,
        integrationResponses: [
          {
            statusCode: '200',
            responseTemplates: {
              'application/json': bookingIdResponseTemplate,
            },
          },
        ],
      },
    });

    // creo la risorsa `/b`
    const b = api.root.addResource('b');
    // creo la risorsa `/b/{bookingId}`
    const booking = b.addResource('{bookingId}');
    // creo il metodo `DELETE /b/{bookingId}` per eliminare una prenotazione
    booking.addMethod('DELETE', deleteBookingInteg, {
      authorizer: captchaAuthorizer,
    });
    // creo il metodo `GET /b/{bookingId}`
    booking.addMethod('GET', getBookingInteg, {
      // configuro la risposta della API
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            // 'application/json': new apigw.Model(this, 'BookingIdModel', {
            //   restApi: api,
            //   // importo lo schema dal file OpenAPI
            //   schema: <JsonSchema>OpenAPI.components.schemas.BookingInfo,
            //   modelName: 'BookingId',
            // }),
            'application/json': apigw.Model.EMPTY_MODEL,
          },
        },
        {
          statusCode: '404',
          responseModels: {
            'application/json': apigw.Model.ERROR_MODEL,
          },
        },
      ],
      requestModels: {
        'application/json': apigw.Model.EMPTY_MODEL,
      },
      requestParameters: {
        'method.request.path.bookingId': true,
      },
    });

    // // creo l'integration per creare un nuovo slot
    // const createSlotIntegration = new apigw.AwsIntegration({
    //   service: 'dynamodb',
    //   action: 'PutItem',
    //   options: {
    //     credentialsRole: dataTableReadWriteRole,
    //     requestTemplates: {
    //       'application/json': putNewSlot(props.dataTable.tableName),
    //     },
    //     passthroughBehavior: apigw.PassthroughBehavior.NEVER,
    //     integrationResponses: [
    //       {
    //         statusCode: '201',
    //         responseTemplates: {
    //           'application/json': JSON.stringify({
    //             userMessage: "Ho creato lo slot per ${input.params('placeId')}",
    //           }),
    //         },
    //       },
    //       {
    //         statusCode: '400',
    //         responseTemplates: {
    //           'application/json': `{
    //             "userMessage": "Si e\' verificato un errore salvando lo slot. Probabilmente esiste gia' uno slot per il momento richiesto della stessa durata",
    //             "dynamodb": $input.json('$')
    //           }`,
    //         },
    //         selectionPattern: '4\\d\\d',
    //       },
    //     ],
    //   },
    // });
    // // creo il metodo "PUT /p/{placeId}/slots"
    // slots.addMethod('PUT', createSlotIntegration, {
    //   authorizationType: apigw.AuthorizationType.IAM,
    //   methodResponses: [
    //     {
    //       statusCode: '201',
    //       responseModels: {
    //         'application/json': new apigw.Model(this, 'Slot', {
    //           restApi: api,
    //           schema: <JsonSchema>OpenAPI.components.schemas.Slot,
    //         }),
    //       },
    //     },
    //     {
    //       statusCode: '400',
    //       responseModels: {
    //         'application/json': apigw.Model.ERROR_MODEL,
    //       },
    //     },
    //   ],
    //   requestModels: {
    //     'application/json': new apigw.Model(this, 'PutSlotRequest', {
    //       restApi: api,
    //       schema: <JsonSchema>OpenAPI.components.schemas.PutSlotRequest,
    //     }),
    //   },
    //   requestParameters: {
    //     'method.request.path.placeId': true,
    //   },
    //   requestValidator: fullValidator,
    // });

    ///// SEARCH API

    // integration per cercare un posto
    const searchInteg = new apigw.LambdaIntegration(props.searchLambda, {
      proxy: true,
    });

    // creo la risorsa `/search`
    const search = api.root.addResource('search');
    // creo la risorsa `/search/p`
    const searchP = search.addResource('p');
    // creo il metodo `GET /search/p`
    searchP.addMethod('GET', searchInteg, {
      requestParameters: {
        'method.request.querystring.near': false,
        'method.request.querystring.q': false,
      },
    });

    this.restApi = api;
    this.stage = api.deploymentStage;
  }

  stage: apigw.Stage;
  restApi: apigw.RestApi;
}

const bookingIdResponseTemplate = `
#set( $items = $input.path('$.Items') )
#if ( $items.size() < 1 )
#set( $context.responseOverride.status = 444 )
{
  "userMessage": "Non ho trovato la prenotazione",
  "debugMessage": "la prenotazione $input.params('bookingId') non esiste"
}
#else
#set( $item = $items.get(0) )
{
  "bookingId": "$input.params('bookingId')",
  "placeId": "$item.pk.S.substring(2)",
  "startDatetime": "$util.escapeJavaScript("$item.startDatetime.S").replaceAll("\\'","'")",
  "duration": $item.duration.N,
  "bookedPeople": $item.bookedPeople.N,
  "secretCode": "$util.escapeJavaScript("$item.secretCode.S").replaceAll("\\'","'")",
  "entered": #if($item.entered.BOOL == '') false #else $item.entered.BOOL #end
}
#end
`;
const slotsResponseTemplate = `
#set( $items = $input.path('$.Items') )
{
  "placeId": "$input.params('placeId')",
  "slots":[
    #foreach($item in $items)
    {
      "slotId": "$item.sk.S.substring(2)",
      "startDatetime": "$util.escapeJavaScript("$item.startDatetime.S").replaceAll("\\'","'")",
      "availablePlaces": $item.availablePlaces.N,
      "allowedPeople": $item.allowedPeople.N,
      "duration": $item.duration.N
    }#if($foreach.hasNext),#end
    #end
  ]
}
`;
const placeOccupationResponseTemplate = `
#set( $item = $input.path('$.Item') )
#if ( $item == "" )
#set( $item = $input.path('$.Attributes') )
#end
#if ( $item == "" )
#set( $context.responseOverride.status = 444 )
{
  "userMessage": "Non ho trovato il luogo",
  "debugMessage": "Il luogo $input.params('placeId') non esiste"
}
#set( $item = $input.path('$.Item') )
#else
{
  "placeId": "$input.params('placeId')",
  "peopleInside": "$item.peopleInside.N",
  "lastUpdateTimestamp": "$item.lastUpdateTimestamp.N"
}
#end
`;

const bookingsResponseTemplate = `
#set( $items = $input.path('$.Items') )
{
  "placeId": "$input.params('placeId')",
  "bookings":[
    #foreach($item in $items)
    {
      "bookingId": "$item.sk.S.substring(2)",
      "slotId": "$util.escapeJavaScript("$item.slotId.S").replaceAll("\\'","'")",
      "startDatetime": "$util.escapeJavaScript("$item.startDatetime.S").replaceAll("\\'","'")",
      "bookedPeople": $item.bookedPeople.N,
      "secretCode": "$util.escapeJavaScript("$item.secretCode.S").replaceAll("\\'","'")",
      "duration": $item.duration.N,
      "anonEmail": #if($item.anonEmail.S == '') null #else "$util.escapeJavaScript("$item.anonEmail.S").replaceAll("\\'","'")" #end,
      "anonPhone": #if($item.anonPhone.S == '') null #else "$util.escapeJavaScript("$item.anonPhone.S").replaceAll("\\'","'")" #end,
      "entered": #if($item.entered.BOOL == '') false #else $item.entered.BOOL #end
    }#if($foreach.hasNext),#end
    #end
  ]
}
`;

function putNewSlot(tableName: string): string {
  return `
#set( $placeId = "p-$input.params('placeId')" )
#set( $startDatetime = $input.path('$.startDatetime') )
#set( $duration = $input.path('$.duration') )
#set( $tilde = "~" )
#set( $slotId = "s-$startDatetime$tilde$duration")
#set( $allowedPeople = $input.path('$.allowedPeople') )
{
  "ConditionExpression": "attribute_not_exists(sk)",
  "Item": { 
     "pk": { 
        "S": "$placeId"
     },
     "sk": {
       "S": "$slotId"
     },
     "startDatetime": {
       "S": "$startDatetime"
     },
     "duration": {
       "N": "$duration"
     },
     "allowedPeople": {
       "N": "$allowedPeople"
     },
     "availablePlaces": {
       "N": "$allowedPeople"
     },
     "lastUpdate": {
       "S": "$context.requestTimeEpoch"
     }
  },
  "ReturnValues": "NONE",
  "TableName": "${tableName}"
}
`;
}

const putSlotResponseTemplate = `
{
  "userMessage": "did create slot for $input.params('placeId')",
}
`;
