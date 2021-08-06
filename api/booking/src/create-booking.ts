import * as lambda from 'aws-lambda';
import * as AWS from 'aws-sdk';
import * as nanoid from './nanoid';
import * as moment from 'moment-timezone';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { inspect } from 'util';
import * as crypto from 'crypto';

const dynamo = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_DEFAULT_REGION,
});
const ses = new AWS.SESV2({
  region: process.env.AWS_DEFAULT_REGION,
});
const sns = new AWS.SNS({
  region: process.env.AWS_DEFAULT_REGION,
});
const tableName = process.env['dataTable'] || 'fakeTable';
const bookingBaseUrl = process.env['bookingBaseUrl'] || 'https://test.virgym.com/b/';
const bookingEmail = process.env['bookingEmail'] || 'no-reply@test.virgym';

export async function handler(
  event: lambda.APIGatewayProxyEvent,
  context: lambda.Context,
): Promise<lambda.APIGatewayProxyResult> {
  try {
    // ottieni il request token per non rischiare di processare la richiesta più di una volta
    const requestToken = event.requestContext.requestId;
    // parsa i parametri dalla richiesta
    const params = getParamsFromRequest(event);
    // crea la nuova prenotazione
    const newBooking = createBooking(
      params.placeId,
      params.slotId,
      params.people,
      params.method,
      params.email,
      params.phone,
    );
    // salva la nuova prenotazione
    console.log(JSON.stringify({ willSaveBooking: newBooking.bookingId, booking: newBooking }));
    await saveBooking(newBooking, requestToken);
    try {
      // invia la mail di conferma
      console.log(JSON.stringify({ willSendRegistrationEmail: true, bookingId: newBooking.bookingId }));
      await sendRegistration(newBooking, params.email, params.phone);
    } catch (error) {
      // se l'invio va in errore
      console.log(
        JSON.stringify({
          didSendRegistrationEmail: false,
          bookingId: newBooking.bookingId,
          error: inspect(error, false, null),
        }),
      );
      console.error('there was an error sending the email to the customer, will delete the booking');
      // annulla la richiesta effettuata
      console.log(JSON.stringify({ willUndoBooking: true, bookingId: newBooking.bookingId }));
      await Promise.all([
        deleteBooking(newBooking),
        freePlaces(newBooking.placeId, newBooking.slotId, newBooking.bookedPeople),
      ]);
      throw error;
    }
    // bookingId, secretCode and gsi1pk MUST be stripped from the response, to be sure
    // the user has access to the email/phone number.
    // In the future it may be useful to create a link to _confirm_ the reservation
    // (if the user performs a GET on the api/b/{bookingId} the state become CONFIRMED)
    let response = {
      ...newBooking,
      bookingId: null,
      secretCode: null,
    };
    delete response['gsi1pk'];
    return {
      statusCode: 201,
      body: JSON.stringify(response),
    };
  } catch (errorResponse) {
    console.error('error response:', inspect(errorResponse));
    return errorResponse;
  }
}

async function sendRegistration(booking: Booking, email?: string, phone?: string) {
  if (typeof email === 'string' && booking.method === BookingMethod.EMAIL) {
    console.log(JSON.stringify({ willSend: 'email', bookingId: booking.bookingId }));
    await sendRegistrationEmail(booking, email);
  } else if (typeof phone === 'string' && booking.method === BookingMethod.PHONE) {
    console.log(JSON.stringify({ willSend: 'phone', bookingId: booking.bookingId }));
    await sendRegistrationSMS(booking, phone);
  } else {
    const error = {
      willSend: 'nothing',
      error: 'unable to send confirmation',
      bookingId: booking.bookingId,
      booking: booking,
      phone: phone,
      email: email,
    };
    console.error(inspect(error));
    throw {
      statusCode: 400,
      body: JSON.stringify({
        userMessage: "Impossibile inviare conferma all'indirizzo email o al numero di telefono impostato",
      }),
    };
  }
}

/**
 * Deletes a booking. Used to _undo_ a booking.
 * @param booking the booking to delete
 */
async function deleteBooking(booking: Booking) {
  await dynamo
    .delete({
      Key: {
        pk: booking.pk,
        sk: booking.sk,
      },
      TableName: tableName,
    })
    .promise();
}

async function getPlaceName(placeId: string): Promise<string | undefined> {
  const res = await dynamo
    .get({
      Key: {
        pk: `p-${placeId}`,
        sk: 'p-info',
      },
      TableName: tableName,
      ProjectionExpression: '#data.#name',
      ExpressionAttributeNames: {
        '#data': 'data',
        '#name': 'name',
      },
      ConsistentRead: false,
    })
    .promise();
  return res.Item?.data.name;
}

/**
 * Free up one or more places. Used to _undo_ a booking.
 *
 * @param placeId the place the slot belogs to
 * @param slotId the slot to be free'd up
 * @param places the number of places to free
 */
async function freePlaces(placeId: string, slotId: string, places: number) {
  await dynamo
    .update({
      Key: {
        pk: `p-{placeId}`,
        sk: `s-{slotId}`,
      },
      UpdateExpression: 'SET availablePlaces = availablePlaces + :newPlaces',
      TableName: tableName,
      ExpressionAttributeValues: {
        ':newPlaces': places,
      },
    })
    .promise();
}

/**
 * Saves a booking if there is place available.
 *
 * Updates both the slot and the booking.
 * @param newBooking the booking to save
 * @param token the unique token to prevent making the same request twice
 */
async function saveBooking(newBooking: Booking, token: string) {
  const saveBooking = putBookingParams(newBooking);
  const updateSlot = updateSlotParams(
    newBooking.placeId,
    newBooking.slotId,
    newBooking.bookedPeople,
    newBooking.lastUpdate,
  );
  console.log(inspect(updateSlot));
  try {
    await dynamo
      .transactWrite({
        TransactItems: [
          {
            Put: saveBooking,
          },
          {
            Update: updateSlot,
          },
        ],
        ReturnConsumedCapacity: 'INDEXES',
        ClientRequestToken: token,
      })
      .promise();
  } catch (error) {
    console.error(inspect({ ...newBooking, FAILED: true, error: String(error) }));
    throw {
      statusCode: 400,
      body: JSON.stringify({
        userMessage: 'Lo slot selezionato è pieno, prova con un altro slot.',
      }),
    };
  }
}

/**
 * A booking to be saved
 */
interface Booking {
  pk: string;
  sk: string;
  slotId: string;
  placeId: string;
  bookedPeople: number;
  secretCode: string;
  bookingId: string;
  gsi1pk: string;
  method: string;
  createdAt: string;
  lastUpdate: string;
  startDatetime: string;
  duration: number;
  email?: string;
  phone?: string;
}

/**
 * The input params needed to create a booking
 */
interface InputParams {
  placeId: string;
  slotId: string;
  people: number;
  method: BookingMethod;
  email?: string;
  phone?: string;
}

/**
 * Gets all params needed from an API Gateway Proxy Event
 * If an error occurs, an API Gateway Response is thrown.
 * @param event the incoming proxy event from API Gateway
 */
export function getParamsFromRequest(event: lambda.APIGatewayProxyEvent): InputParams {
  try {
    const pathParameters: { [name: string]: string } = event.pathParameters || {};
    const placeId = pathParameters.placeId;
    const slotId = pathParameters.slotId;

    if (typeof placeId !== 'string' || typeof slotId !== 'string') {
      throw 'Missing placeId or slotId in request path.';
    }

    // get body
    if (typeof event.body !== 'string') {
      throw 'Missing body in request';
    }
    const body = JSON.parse(event.body);

    // get the number of people
    const people: number = body.people;
    if (typeof people !== 'number') {
      throw "Missing 'people' attribute in body.";
    }

    // check the email and the phone
    let email: string | undefined = body.email;
    let phone: string | undefined = body.phone;
    if (typeof email !== 'string' && typeof phone !== 'string') {
      throw "Missing 'email' or 'phone' in body.";
    }

    // if the email is not valid, drop it.
    if (typeof email === 'string') {
      email = email.toLowerCase();
      if (!validateEmail(email)) {
        throw "L'indirizzo email non è valido";
      }
    }

    if (typeof phone === 'string') {
      phone = validatedPhone(phone);
      if (phone == null) {
        throw 'Il numero di telefono inserito non è valido';
      }
    }

    // TODO: remove this when signup by phone will be available
    if (typeof email == null) {
      throw 'La registrazione tramite numero di telefono non è ancora supportata';
    }

    const method = email == null ? BookingMethod.PHONE : BookingMethod.EMAIL;

    return {
      email: email ?? undefined,
      people,
      phone: phone ?? undefined,
      placeId,
      slotId,
      method,
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

export enum BookingMethod {
  EMAIL = 'email',
  PHONE = 'phone',
}

/**
 * Creates a new booking ready to be saved in dynamodb.
 * @param placeId the place
 * @param slotId the slot
 * @param people the number of people
 * @param method the method used to sign up
 */
export function createBooking(
  placeId: string,
  slotId: string,
  people: number,
  method: BookingMethod,
  email?: string,
  phone?: string,
): Booking {
  let methodString: string;
  switch (method) {
    case BookingMethod.EMAIL:
      methodString = 'email';
      break;
    case BookingMethod.PHONE:
      methodString = 'phone';
      break;
  }
  const creationTime = new Date().toISOString();
  const secretCode = nanoid.customAlphabet('1234567890', 6)();
  const [startDatetime, duration] = slotId.split('~');
  const bookingId = nanoid.customAlphabet(nanoid.urlAlphabet, 12)();
  return {
    bookingId,
    gsi1pk: `b-${bookingId}`,
    bookedPeople: people,
    placeId,
    pk: `p-${placeId}`,
    slotId,
    sk: `b-${slotId}~${secretCode}`,
    secretCode,
    method: methodString,
    createdAt: creationTime,
    lastUpdate: creationTime,
    startDatetime,
    duration: Number(duration),
    email,
    phone,
  };
}

/**
 * Creates the params to save a new booking
 * @param booking the booking to create
 */
export function putBookingParams(booking: Booking): DocumentClient.PutItemInput {
  return {
    Item: {
      ...booking,
    },
    TableName: tableName,
    ConditionExpression: 'attribute_not_exists(sk)',
    ReturnValues: 'NONE',
  };
}

/**
 * Creates the params to remove some space from the slot recap
 * @param placeId the place
 * @param slotId the slot
 * @param count the number of people to subtract from available spaces
 * @param lastUpdate the date to set as last update
 */
export function updateSlotParams(
  placeId: string,
  slotId: string,
  count: number,
  lastUpdate: string,
): DocumentClient.Update {
  return {
    Key: {
      pk: `p-${placeId}`,
      sk: `s-${slotId}`,
    },
    TableName: tableName,
    UpdateExpression: `set availablePlaces = availablePlaces - :newPeople, lastUpdate = :lu`,
    ExpressionAttributeValues: {
      ':lu': lastUpdate,
      ':newPeople': count,
    },
    ConditionExpression: 'availablePlaces >= :newPeople',
  };
}

export async function sendRegistrationSMS(newBooking: Booking, phone: string) {
  if (phone === undefined) {
    throw {
      statusCode: 400,
      body: JSON.stringify({
        userMessage: 'Il numero di telefono fornito non è valido',
      }),
    };
  }
  const params = sendSMSParams(newBooking, phone);
  await sns.publish(params).promise();
}

function sendSMSParams(newBooking: Booking, phone: string): AWS.SNS.PublishInput {
  const [url, formattedSecretCode, formattedDate] = confirmationParams(newBooking);
  const params: AWS.SNS.PublishInput = {
    Message: `Ciao, conferma la prenotazione del ${formattedDate} visitando ${url}.\nIl tuo codice è: ${formattedSecretCode}`,
    PhoneNumber: phone,
    MessageAttributes: {
      'AWS.SNS.SMS.SenderID': {
        StringValue: 'Avatarlab',
        DataType: 'String',
      },
      'AWS.SNS.SMS.MaxPrice': {
        DataType: 'Number',
        StringValue: '0.10',
      },
    },
  };
  return params;
}

export function formattedDate(date: string) {
  return moment(date).tz('Europe/Rome').locale('it').format('D MMMM [alle] H:mm');
}

/**
 * Sends a confirmation mail for the booking to the given address
 * @param newBooking the booking to confirm
 * @param email the email to send the confirmation to
 */
export async function sendRegistrationEmail(newBooking: Booking, email: string) {
  email = email;
  if (!validateEmail(email)) {
    throw {
      statusCode: 400,
      body: JSON.stringify({
        userMessage: "L'indirizzo email fornito non è valido.",
      }),
    };
  }
  // la mail è valida
  const sendEmailParams = await createRegistrationEmailParams(newBooking, email);
  await ses.sendEmail(sendEmailParams).promise();
}

/**
 * Creates the params to send a confirmation email
 * @param booking the new booking
 * @param email the email
 */
async function createRegistrationEmailParams(booking: Booking, email: string): Promise<AWS.SESV2.SendEmailRequest> {
  const [url, formattedSecretCode, formattedDate] = confirmationParams(booking);
  const placeName = await getPlaceName(booking.placeId);
  return {
    Destination: {
      ToAddresses: [email],
    },
    Content: {
      Simple: {
        Body: {
          Html: {
            Data: `
            Ciao,<br />
            puoi vedere qui la tua prenotazione per ${placeName ?? booking.placeId} del ${formattedDate}: ${url}.
            <br />
            Se all'ingresso ti chiedono il codice di prenotazione, fornisci <strong>${formattedSecretCode}</strong>.
            <br />
            Se hai cambiato idea, ricordati di cancellare la tua prenotazione al link: ${url}.
            `,
          },
          Text: {
            Data: `
            Ciao,\n
            puoi vedere qui la tua prenotazione per ${placeName ?? booking.placeId} del ${formattedDate}: ${url}.
            \n
            Se all'ingresso ti chiedono il codice di prenotazione, fornisci <strong>${formattedSecretCode}</strong>.
            \n
            Se hai cambiato idea, ricordati di cancellare la tua prenotazione al link: ${url}.
            `,
          },
        },
        Subject: {
          Data: 'Conferma la tua prenotazione con Avatarlab',
        },
      },
    },
    FromEmailAddress: `Avatarlab <${bookingEmail}>`,
    EmailTags: [
      {
        Name: 'EmailType',
        Value: 'BookingConfirmation',
      },
    ],
  };
}

/**
 * Returns the booking url, the formatted secret code and the starting date of the booking
 * @param booking the booking to confirm
 */
export function confirmationParams(booking: Booking): [string, string, string] {
  const url = bookingBaseUrl + booking.bookingId;
  let formattedSecretCode = booking.secretCode;
  if (formattedSecretCode.length == 6) {
    formattedSecretCode = formattedSecretCode.substring(0, 3) + '-' + formattedSecretCode.substring(3, 6);
  }
  const startingDate = formattedDate(booking.startDatetime);
  return [url, formattedSecretCode, startingDate];
}

/**
 * Checks whether the email is valid or not
 * @param email the email to check
 */
function validateEmail(email: string): boolean {
  var re =
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email));
}

export function validatedPhone(phone: string): string | undefined {
  let aux = phone.replace(/[\s\(\)]/g, '');
  if (!aux.startsWith('+')) {
    // if aux does not start with +39 or +44 or others
    if (aux.startsWith('00')) {
      // a good format may be 0039, replace 00 with +
      aux = aux.replace(/^00/, '+');
    } else {
      // otherwise prepend +39
      aux = '+39' + aux;
    }
  }
  // valid numbers begins with +39 and have 9 or 10 digits after it.
  const re = /^\+39\d{9,10}/;
  return re.test(String(aux)) ? aux : undefined;
}
