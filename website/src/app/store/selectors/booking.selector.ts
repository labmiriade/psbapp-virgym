import { createSelector } from '@ngrx/store';
import { AppState } from '../reducers';

const bookingFeature = (state: AppState) => state.booking;

export const searchLoading = () => createSelector(bookingFeature, (state) => state.loading);

export const searchResults = () => createSelector(bookingFeature, (state) => state.slots || []);

export const searchError = () => createSelector(bookingFeature, (state) => state.error);

export const searchPlace = () => createSelector(bookingFeature, (state) => state.place);

export const searchSlotsSelector = () => createSelector(bookingFeature, (state) => state.slots);
