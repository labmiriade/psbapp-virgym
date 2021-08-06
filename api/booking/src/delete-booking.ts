import * as lambda from 'aws-lambda';
import * as AWS from 'aws-sdk';
import { inspect } from 'util';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';

const dynamo = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_DEFAULT_REGION,
});
const tableName = process.env['dataTable'] || 'fakeTable';
const indexName = process.env['indexName'] || 'GSI1';

export async function handler(
  event: lambda.APIGatewayProxyEvent,
  context: lambda.Context,
): Promise<lambda.APIGatewayProxyResult> {
  try {
    // ottieni il request token per non rischiare di processare la richiesta più di una volta
    const requestToken = event.requestContext.requestId;

    // parsa i parametri dalla richiesta
    const params = getParamsFromRequest(event);
    // cancella la prenotazione
    try {
      // se l'operazione va a buon fine
      await deleteBookingUpdateSlot(params.bookingId, requestToken);
      console.log('booking delete and slot update done');
    } catch (error) {
      // se l'elemento non esiste
      console.error('bookingId not exists');
      console.log(`bookingId not exists, id = ${params.bookingId}`, inspect(error));
      let errorResponse: lambda.APIGatewayProxyResult = {
        statusCode: 400,
        body: JSON.stringify({
          error,
        }),
      };
      throw errorResponse;
    }
    return {
      statusCode: 204,
      body: JSON.stringify({
        bookingId: null,
      }),
    };
  } catch (errorResponse) {
    console.error('error response:', inspect(errorResponse));
    return errorResponse;
  }
}

/**
 * Saves a booking if there is place available.
 *
 * Updates both the slot and the booking.
 * @param newBooking the booking to save
 * @param token the unique token to prevent making the same request twice
 */
async function deleteBookingUpdateSlot(bookingId: string, token: string) {
  // controlla se prenotazione esiste ed estrae i parametri
  const booking = await searchBooking(bookingId);
  const creationTime = new Date().toISOString();

  // delete booking
  const delBooking = deleteBooking(booking.pk, booking.sk);
  console.log(inspect(deleteBooking));
  // updatae slot
  const updSlot = updateSlot(booking.placeId, booking.slotId, booking.bookedPeople, creationTime);
  console.log(inspect(updateSlot));
  try {
    await dynamo
      .transactWrite({
        TransactItems: [
          {
            Delete: delBooking,
          },
          {
            Update: updSlot,
          },
        ],
        ReturnConsumedCapacity: 'INDEXES',
        ClientRequestToken: token,
      })
      .promise();
  } catch (error) {
    console.error(inspect({ ...booking, FAILED: true, error: String(error) }));
    throw {
      statusCode: 400,
      body: JSON.stringify({
        userMessage: 'Cancellazione non effettuata.',
      }),
    };
  }
}

/**
 * Creates the params to save a new booking
 * @param booking the booking to create
 */
export function deleteBooking(pk: string, sk: string): DocumentClient.Delete {
  return {
    Key: {
      pk: pk,
      sk: sk,
    },
    TableName: tableName,
  };
}

/**
 * Creates the params to remove some space from the slot recap
 * @param placeId the place
 * @param slotId the slot
 * @param count the number of people to subtract from available spaces
 * @param lastUpdate the date to set as last update
 */
export function updateSlot(placeId: string, slotId: string, count: number, lastUpdate: string): DocumentClient.Update {
  return {
    Key: {
      pk: `p-${placeId}`,
      sk: `s-${slotId}`,
    },
    TableName: tableName,
    UpdateExpression: `set availablePlaces = availablePlaces + :newPeople, lastUpdate = :lu`,
    ExpressionAttributeValues: {
      ':lu': lastUpdate,
      ':newPeople': count,
    },
  };
}

/**
 * The booking params needed to delete a booking
 */
interface Booking {
  pk: string;
  sk: string;
  placeId: string;
  slotId: string;
  bookedPeople: number;
}

/**
 * Search a bookingId.
 * @param booking the booking to delete
 */
export async function searchBooking(bookingId: string): Promise<Booking> {
  // cerca se il bookingId esiste in tabella ed estrae la chiave
  var items = await dynamo
    .query({
      TableName: tableName,
      IndexName: indexName,
      ExpressionAttributeValues: {
        ':bookingId': `b-${bookingId}`,
      },
      KeyConditionExpression: 'gsi1pk = :bookingId',
    })
    .promise();

  const booking: Booking = {} as any;
  booking.pk = items.Items?.[0].pk;
  booking.sk = items.Items?.[0].sk;
  booking.placeId = items.Items?.[0].placeId;
  booking.slotId = items.Items?.[0].slotId;
  booking.bookedPeople = items.Items?.[0].bookedPeople;

  return booking;
}

/**
 * The input params needed to delete a booking
 */
interface InputParams {
  bookingId: string;
}
/**
 * Gets all params needed from an API Gateway Proxy Event
 * If an error occurs, an API Gateway Response is thrown.
 * @param event the incoming proxy event from API Gateway
 */
export function getParamsFromRequest(event: lambda.APIGatewayProxyEvent): InputParams {
  try {
    const pathParameters: { [name: string]: string } = event.pathParameters || {};
    const bookingId = pathParameters.bookingId;

    if (typeof bookingId !== 'string') {
      throw 'Missing bookingId in request path.';
    }
    // if the bookingId is not valid, drop it.
    if (typeof bookingId === 'string') {
      if (!validateBookingId(bookingId)) {
        throw 'BookingId non valido';
      }
    }
    return {
      bookingId,
    };
  } catch (message) {
    let errorResponse: lambda.APIGatewayProxyResult = {
      statusCode: 400,
      body: JSON.stringify({
        message,
      }),
    };
    throw errorResponse;
  }
}

/**
 * Checks whether the email is valid or not
 * @param email the email to check
 */
function validateBookingId(bookingId: string): boolean {
  var re = /^([A-Za-z0-9]{12})$/;
  return re.test(String(bookingId));
}
