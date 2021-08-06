import Router from '@koa/router';
import { BookingInfo } from '../entities';

const router = new Router({ prefix: '/b' });

export default router;

router.get('/:recipientId', (ctx) => {
  const recipientId = ctx.params.recipientId;
  ctx.body = BookingInfo(recipientId);
});

router.delete('/:recipientId', (ctx) => {
  const q = ctx.header['x-captcha'];
  if (q === null || q === undefined) {
    ctx.throw(401, { message: 'Unauthorized' });
    return;
  }

  ctx.status = 204;
});
