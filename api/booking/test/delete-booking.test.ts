import { deleteBooking, getParamsFromRequest, searchBooking } from '../src/delete-booking';
import * as lambda from 'aws-lambda';

describe('Booking search', () => {
  test('Get Params Works', () => {
    // GIVEN
    const input = <lambda.APIGatewayProxyEvent>(<unknown>{
      pathParameters: {
        bookingId: 'npJvSqhkwNBl',
      },
    });

    // WHEN
    const params = getParamsFromRequest(input);

    // EXPECT
    expect(params).toStrictEqual({
      bookingId: 'npJvSqhkwNBl',
    });
  });

  //test('search a Booking', async () => {
  //  // GIVEN
  //  const bookingIdTest = 'npJvSqhkwNBl';

  //  // WHEN
  //  const b = await searchBooking(bookingIdTest);

  //  // EXPECT
  //  expect(b).toStrictEqual({
  //    pk: 'p-test',
  //    sk: 'b-2020-06-04T08:00:00Z~60~087354'
  //  });

  //});

  //test('delete a Booking', async () => {
  //  // GIVEN
  //  const bookingIdTest = 'npJvSqhkwNBl';

  //  // WHEN
  //  const b = await deleteBooking(bookingIdTest);
  //});
});
