import {
  createBooking,
  BookingMethod,
  putBookingParams,
  getParamsFromRequest,
  validatedPhone,
  sendRegistrationSMS,
} from '../src/create-booking';
import * as lambda from 'aws-lambda';

describe('Booking Creation', () => {
  test('creates a new Booking', () => {
    // GIVEN
    const placeId = 'placeId';
    const slotId = 'slotId';

    // WHEN
    const b = createBooking(placeId, slotId, 2, BookingMethod.EMAIL);

    // THEN
    const secretCode = b.secretCode;
    expect(secretCode).toHaveLength(6);
    expect(typeof secretCode).toBe('string');
    const bookingId = b.bookingId;
    expect(bookingId).toHaveLength(12);
    expect(typeof bookingId).toBe('string');
    expect(b.sk).toMatch(RegExp(`b-${slotId}~\\d{6}`));
    const expected = {
      pk: `p-${placeId}`,
      sk: b.sk,
      slotId: slotId,
      placeId: placeId,
      bookedPeople: 2,
      method: 'email',
    };
    expect(b).toMatchObject(expected);
    expect(b.createdAt).toEqual(b.lastUpdate);
    expect(typeof b.createdAt).toEqual('string');
    expect(b.createdAt).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
  });

  test('putrequest creation', () => {
    // GIVEN
    const booking = createBooking('boh', 'mah', 3, BookingMethod.PHONE);

    // WHEN
    const putParams = putBookingParams(booking);

    // THEN
    expect(putParams).toMatchObject({
      TableName: 'fakeTable',
      Item: booking,
      ConditionExpression: 'attribute_not_exists(sk)',
      ReturnValues: 'NONE',
    });
  });

  test('Get Params Works', () => {
    // GIVEN
    const input = <lambda.APIGatewayProxyEvent>(<unknown>{
      body: '{"people": 3, "email": "user@example.org"}',
      pathParameters: {
        placeId: 'place',
        slotId: 'slot',
      },
    });

    // WHEN
    const params = getParamsFromRequest(input);

    // EXPECT
    expect(params).toStrictEqual({
      placeId: 'place',
      slotId: 'slot',
      people: 3,
      email: 'user@example.org',
      phone: undefined,
      method: 'email',
    });
  });

  test('Get Params throws error', () => {
    // GIVEN
    const input = <lambda.APIGatewayProxyEvent>(<unknown>{
      body: '{"people": 3, "email": "user@example.org"}',
      pathParameters: {
        placeId: 'place',
        slotId: 'slot',
      },
    });
    const inputs = [
      {
        ...input,
        pathParameters: null,
      },
      {
        ...input,
        body: {},
      },
      {
        ...input,
        body: JSON.stringify({
          people: 3,
          email: 234,
          phone: 123,
        }),
      },
      {
        ...input,
        body: JSON.stringify({
          people: '4',
          email: 'fsdjaljfdsl@example.com',
        }),
      },
    ];

    // WHEN
    inputs.forEach((input) => {
      expect(() => {
        return getParamsFromRequest(<lambda.APIGatewayProxyEvent>input);
      }).toThrow();
    });
  });

  test('validatedPhone', () => {
    const numbers = [
      '123456789',
      '0039 12 345 67  890',
      '00391234567890',
      '0039123456789',
      '0039 12 34 56 789',
      '+39123456789',
      '(0039)123456789',
      '+441234567890',
      '+3912345678',
      '12345678',
    ];
    const validated = numbers.map(validatedPhone);
    expect(validated).toStrictEqual([
      '+39123456789',
      '+391234567890',
      '+391234567890',
      '+39123456789',
      '+39123456789',
      '+39123456789',
      '+39123456789',
      undefined,
      undefined,
      undefined,
    ]);
  });
});
