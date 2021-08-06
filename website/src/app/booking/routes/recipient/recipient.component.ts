import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Store } from '@ngrx/store';
import { format, parseISO } from 'date-fns';
import { Subscription } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import { BookingInfo } from 'src/app/core/interfaces/api.interface';
import { BookingService } from 'src/app/core/services/booking.service';
import { ToastService, ToastType } from 'src/app/core/services/toast.service';
import { searchById } from 'src/app/store/actions/booking.actions';
import { CommonModalComponent } from '../../components/common-modal/common-modal.component';

@Component({
  selector: 'app-recipient',
  templateUrl: './recipient.component.html',
  styleUrls: ['./recipient.component.scss'],
})
export class RecipientComponent implements OnInit, OnDestroy {
  private sub = new Subscription();
  recipientId: string = '';
  slot?: BookingInfo;
  deleted: boolean = false;
  loading: boolean = false;

  constructor(
    private bookingService: BookingService,
    private activatedRoute: ActivatedRoute,
    private modalService: NgbModal,
    private toast: ToastService,
    private store: Store,
  ) {}

  ngOnInit(): void {
    this.loading = true;

    this.sub.add(
      this.activatedRoute.params
        .pipe(
          map((params) => params.recipientId),
          mergeMap((recipientId) => this.bookingService.getBookedSlot(recipientId)),
        )
        .subscribe(
          (slot) => {
            this.slot = slot;
            this.recipientId = this.slot.bookingId;
            this.store.dispatch(searchById({ placeId: this.slot.placeId }));
            this.loading = false;
          },
          () => {
            this.loading = false;
          },
        ),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  openModal(): void {
    // Check sulla larghezza dello schermo se è minore del breakpoint md di bootstrap
    let size = { size: '' };
    if (window.innerWidth < 768) {
      size.size = 'sm';
    }
    let modal = this.modalService.open(CommonModalComponent, size);
    let dateFormatted = '';

    if (this.slot?.startDatetime) {
      dateFormatted = format(parseISO(this.slot?.startDatetime), 'dd MMMM hh:mm');
    }
    modal.componentInstance.title = 'Cancella prenotazione';
    modal.componentInstance.message = `Cancellare la prenotazione relativa alla palestra ${this.slot?.place?.name} del ${dateFormatted} ?`;
    modal.componentInstance.successTitle = 'Cancella';
    modal.result.then(
      () => {
        this.deleteBooking();
      },
      () => {},
    );
  }

  deleteBooking(): void {
    this.loading = true;
    this.sub.add(
      this.bookingService.deleteBooking(this.recipientId).subscribe(
        () => {
          this.deleted = true;
          this.loading = false;
        },
        (error) => {
          this.toast.show(
            'OH NO!',
            'Qualcosa è andato storto, non siano riusciti a cancellare la tua prenotazione. Si prega di riprovare.',
            ToastType.Danger,
          );
          this.loading = false;
        },
      ),
    );
  }
}
