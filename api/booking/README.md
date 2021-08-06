# Booking Fns

## Booking creation Lambda

The creation lambda allows the creation of bookings for a slot by a recaptcha authenticated user.

This lambda receives an object BookingRequest, creates a booking and updates the related slot's available places.

## Booking creation Lambda

The deletion lambda allows the deletion of a booking by a recaptcha authenticated user.

This lambda receives a bookingId, deletes the related booking and updates the related slot's available places through a transaction.
