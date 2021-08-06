import Router from '@koa/router';
import { BookingResponse, PlaceInfo, SlotsResponse } from '../entities';

const router = new Router({ prefix: '/p' });

export default router;

router.get('/:placeId/slots', (ctx, next) => {
  const from = ctx.request.query.from;
  if (from === null || from === undefined) {
    ctx.throw(400, 'missing query param: from');
    return;
  }
  ctx.body = SlotsResponse();
});

router.get('/:placeId', (ctx, next) => {
  const placeId = ctx.params.placeId;
  ctx.body = PlaceInfo(placeId);
});

router.post('/:placeId/slots/:slotId/bookings', (ctx, next) => {
  const q = ctx.header['x-captcha'];
  if (q === null || q === undefined) {
    ctx.throw(401, { message: 'Unauthorized' });
    return;
  }

  const body = ctx.request.body;
  ctx.status = 201;
  ctx.body = BookingResponse(body.bookedPeople);
});
