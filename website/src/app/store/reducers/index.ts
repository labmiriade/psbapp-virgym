import * as main from './main.reducer';
import * as booking from './booking.reducer';

export interface AppState {
  main: main.State;
  booking: booking.State;
}

export const reducers = {
  main: main.reducer,
  booking: booking.reducer,
};

export const metaReducers = [];
