import Router from '@koa/router';

import search from './search';
import p from './p';
import b from './b';

const modules: { [key: string]: Router } = {
  search,
  p,
  b,
};

export default modules;
