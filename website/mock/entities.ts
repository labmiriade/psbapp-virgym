import { components } from './schema';
import * as faker from 'faker';

export function PlaceList(): components['schemas']['PlaceList'] {
  const places = [];

  for (let i = 0; i < 50; i++) {
    places.push(PlaceInfo());
  }

  return {
    places,
  };
}

export function PlaceInfo(placeId?: string): components['schemas']['PlaceInfo'] {
  return {
    placeId: placeId ?? faker.random.word(),
    building: faker.random.word(),
    city: faker.address.city(),
    street: faker.address.streetAddress(),
    streetNumber: faker.datatype.number().toString(),
    province: faker.address.county(),
    phone: faker.phone.phoneNumber(),
    lat: faker.address.latitude(),
    lon: faker.address.longitude(),
    category: faker.random.word(),
    name: faker.company.companyName(),
    website: `https://wwww.${faker.internet.domainName()}.com`,
    istatCode: `${faker.datatype.string(1)}${faker.datatype.number(999)}`,
    representative: faker.name.lastName(),
    cpu: 'CPU',
    openingTimeDesc: 'dal lunedì al venerdì dalle 9 alle 18',
    allowBookingByPhone: faker.datatype.boolean(),
    bookable: faker.datatype.boolean(),
  };
}

export function SlotsResponse(): components['schemas']['SlotsResponse'] {
  const slots: components['schemas']['Slot'][] = [];

  for (let i = 0; i < 50; i++) {
    slots.push(Slot());
  }

  return {
    slots,
  };
}

export function Slot(): components['schemas']['Slot'] {
  const duration = 30 * faker.datatype.number(3);
  const startDateTime = faker.date.future().toISOString();
  return {
    slotId: `${startDateTime}~${duration}`,
    startDatetime: startDateTime,
    duration,
    allowedPeople: faker.datatype.number(100),
    availablePlaces: faker.datatype.number(20),
    allowBookingFrom: faker.datatype.datetime().toISOString(),
    allowBookingUntil: faker.datatype.datetime().toISOString(),
  };
}

export function BookingResponse(bookedPeople?: number): components['schemas']['BookingResponse'] {
  return {
    bookedPeople: bookedPeople ?? faker.datatype.number(100),
  };
}

export function BookingInfo(recipientId: string): components['schemas']['BookingInfo'] {
  const duration = 30 * faker.datatype.number(3);
  const startDatetime = faker.date.future().toISOString();
  return {
    bookedPeople: 1,
    bookingId: recipientId,
    duration,
    entered: false,
    place: PlaceInfo('1'),
    placeId: faker.datatype.number().toString(),
    secretCode: faker.datatype.number().toString(),
    startDatetime,
  };
}
