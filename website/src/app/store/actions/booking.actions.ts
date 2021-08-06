import { createAction, props } from '@ngrx/store';
import { PlaceInfo, SlotsResponse } from 'src/app/core/interfaces/api.interface';

export const searchById = createAction('[Booking] Search by Id', props<{ placeId: string }>());
export const searchSuccessById = createAction('[Booking] Search Success by Id', props<{ result: PlaceInfo }>());
export const searchFailedById = createAction('[Booking] Search Failed by Id', props<{ error: any; placeId: string }>());

export const searchSlots = createAction('[Booking] Search slots', props<{ placeId: string }>());
export const searchSuccessSlots = createAction('[Booking] Search Slots Success', props<{ result: SlotsResponse }>());
export const searchFailedSlots = createAction(
  '[Booking] Search Slots Failed',
  props<{ error: any; placeId: string }>(),
);
