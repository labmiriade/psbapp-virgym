import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Subscription } from 'rxjs';
import { BookingRequest, PlaceInfo, Slot } from 'src/app/core/interfaces/api.interface';
import { BookingService } from 'src/app/core/services/booking.service';
import { CommonModalComponent } from '../common-modal/common-modal.component';

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss'],
})
export class CheckoutComponent {
  bookingForm: FormGroup;
  @Input() slot?: Slot;
  @Input() place?: PlaceInfo;
  @Output() next = new EventEmitter<void>();
  @Output() setLoading = new EventEmitter<boolean>();

  sub = new Subscription();
  placeId = '';
  loading: boolean = false;

  constructor(private bookingService: BookingService, private modalService: NgbModal) {
    this.bookingForm = new FormGroup({
      email: new FormControl('', [Validators.required, Validators.email]),
      phone: new FormControl(''),
      slotId: new FormControl(''),
    });
  }

  bookSlot() {
    let bookingRequest: BookingRequest = { people: 1, email: this.bookingForm.get('email')?.value };

    if (this.bookingForm.get('phone')?.value !== '') {
      bookingRequest.phone = this.bookingForm.get('phone')?.value;
    }
    if (this.slot && this.place && this.place?.placeId) {
      this.loading = true;
      this.sub.add(
        this.bookingService.bookSlot(this.place?.placeId, this.slot.slotId, bookingRequest).subscribe(
          () => {
            this.next.emit();
            this.loading = false;
          },
          (error) => {
            this.loading = false;
            // Valori di testo provvisori
            let errore = 'Si è verificato un problema';
            let modal = this.modalService.open(CommonModalComponent);
            modal.componentInstance.message = errore;
            modal.componentInstance.title = 'Errore';
            modal.componentInstance.successTitle = 'Riprova';
            modal.result.then((result) => {
              if (result === 'success') {
                this.bookSlot();
              }
            });
          },
        ),
      );
    }
  }
}
