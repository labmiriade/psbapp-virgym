import { createReducer, on } from '@ngrx/store';
import { PlaceInfo, SlotsResponse } from 'src/app/core/interfaces/api.interface';
import {
  searchSlots,
  searchById,
  searchFailedSlots,
  searchFailedById,
  searchSuccessSlots,
  searchSuccessById,
} from '../actions/booking.actions';

export interface State {
  loading: boolean;
  error: any;
  slots: SlotsResponse | undefined;
  place: PlaceInfo | undefined;
}

const initialState: State = {
  loading: false,
  error: null,
  slots: undefined,
  place: undefined,
};

export const reducer = createReducer(
  initialState,
  on(searchSlots, (state, props) => ({
    ...state,
    loading: true,
  })),
  on(searchSuccessSlots, (state, props) => ({
    ...state,
    loading: false,
    slots: props.result,
  })),
  on(searchFailedSlots, (state, props) => ({
    ...state,
    loading: false,
    error: props.error,
    slots: undefined,
  })),
  on(searchById, (state, props) => ({
    ...state,
    loading: true,
  })),
  on(searchSuccessById, (state, props) => ({
    ...state,
    loading: false,
    place: props.result,
  })),
  on(searchFailedById, (state, props) => ({
    ...state,
    loading: false,
    error: props.error,
    place: undefined,
  })),
);
