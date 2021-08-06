import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, mergeMap, catchError } from 'rxjs/operators';
import { MainService } from 'src/app/core/services/main.service';
import { BookingService } from 'src/app/core/services/booking.service';
import {
  searchSlots,
  searchSuccessSlots,
  searchFailedSlots,
  searchSuccessById,
  searchFailedById,
  searchById,
} from '../actions/booking.actions';
import { ToastService } from 'src/app/core/services/toast.service';
@Injectable()
export class BookingEffects {
  searchById$ = createEffect(() =>
    this.actions$.pipe(
      ofType(searchById),
      mergeMap((props) =>
        this.main.getPlace(props.placeId).pipe(
          map((result) => searchSuccessById({ result: result })),
          catchError((e) => {
            return of(searchFailedById({ error: e, placeId: props.placeId }));
          }),
        ),
      ),
    ),
  );

  searchSlots$ = createEffect(() =>
    this.actions$.pipe(
      ofType(searchSlots),
      mergeMap((props) =>
        this.booking.getSlots(props.placeId).pipe(
          map((result) => searchSuccessSlots({ result: result })),
          catchError((e) => {
            return of(searchFailedSlots({ error: e, placeId: props.placeId }));
          }),
        ),
      ),
    ),
  );

  constructor(
    private actions$: Actions,
    private main: MainService,
    private toast: ToastService,
    private booking: BookingService,
  ) {}
}
