import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { combineLatest, Subscription } from 'rxjs';
import { PlaceInfo } from 'src/app/core/interfaces/api.interface';
import { CommonModalComponent } from '../../components/common-modal/common-modal.component';
import { Location } from '@angular/common';
import { select, Store } from '@ngrx/store';
import { AppState } from 'src/app/store/reducers';
import { searchById, searchFailedSlots, searchSlots } from 'src/app/store/actions/booking.actions';
import { searchPlace, searchSlotsSelector } from 'src/app/store/selectors/booking.selector';
import { Actions, ofType } from '@ngrx/effects';

@Component({
  selector: 'app-booking',
  templateUrl: './booking.component.html',
  styleUrls: ['./booking.component.scss'],
})
export class BookingComponent implements OnInit {
  currentStep = 0;

  MAX_STEPS = 4;

  placeId: string = '';
  sub = new Subscription();
  slots?: any;
  days?: { [key: string]: any[] };
  selectedDay: any;
  selectedTime: any;
  place?: PlaceInfo;

  loading: boolean = false;

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private modalRef: NgbModal,
    private location: Location,
    private store: Store<AppState>,
    private action$: Actions,
  ) {}

  ngOnInit(): void {
    this.loading = true;
    this.sub.add(
      this.activatedRoute.params.subscribe((params) => {
        this.placeId = params.placeId;
      }),
    );
    this.store.dispatch(searchById({ placeId: this.placeId }));
    this.store.dispatch(searchSlots({ placeId: this.placeId }));

    this.sub.add(
      combineLatest([this.store.pipe(select(searchPlace())), this.store.pipe(select(searchSlotsSelector()))]).subscribe(
        ([place, data]) => {
          this.place = place;
          if (data?.slots) {
            this.slots = data;
            this.days = this.slots.slots?.reduce((result: any, value: any) => {
              const key = value['slotId'].substring(0, 10);
              if (!(key in result)) {
                result[key] = [];
              }
              result[key].push(value);
              return result;
            }, {});
            this.loading = false;
          }
        },
      ),
    );

    this.sub.add(
      this.action$.pipe(ofType(searchFailedSlots)).subscribe((props) => {
        let modal = this.modalRef.open(CommonModalComponent);
        modal.componentInstance.title = 'Errore';
        modal.componentInstance.message = 'Si è verificato un errore con la tua richiesta';
        modal.componentInstance.successTitle = 'Continua';
        modal.result.then(
          () => {
            this.router.navigate(['/']);
          },
          () => {
            this.router.navigate(['/']);
          },
        );
      }),
    );
  }

  next(): void {
    if (this.loading) {
      this.loading = false;
    }
    this.currentStep = Math.min(this.MAX_STEPS, this.currentStep + 1);
    if (this.currentStep === this.MAX_STEPS) {
      this.router.navigateByUrl('/');
    }
  }

  prev(): void {
    if (this.currentStep === 0) {
      this.location.back();
    } else {
      this.currentStep = Math.max(0, this.currentStep - 1);
    }
  }

  // Day and time setter from specific page
  setDay(event: any) {
    this.selectedDay = event;
    this.selectedTime = undefined;
  }

  setTime(event: any) {
    this.selectedTime = event;
  }

  canGoNext(): boolean {
    if (this.currentStep === 0) {
      if (this.selectedDay) {
        return true;
      }
    }
    if (this.currentStep === 1) {
      if (this.selectedTime) {
        return true;
      }
    }
    if (this.currentStep === 2) {
      return true;
    }
    return false;
  }
}
