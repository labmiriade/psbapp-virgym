import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { BookingRoutingModule } from './booking-routing.module';
import { BookingComponent } from './routes/booking/booking.component';
import { ChooseDateComponent } from './components/choose-date/choose-date.component';
import { ChooseTimeComponent } from './components/choose-time/choose-time.component';
import { ConfirmationComponent } from './components/confirmation/confirmation.component';
import { CheckoutComponent } from './components/checkout/checkout.component';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModalComponent } from './components/common-modal/common-modal.component';
import { NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import { RecipientComponent } from './routes/recipient/recipient.component';
import { RecaptchaModule } from 'ng-recaptcha';
import { CommonBookingComponent } from './common-booking.component';

@NgModule({
  declarations: [
    BookingComponent,
    ChooseDateComponent,
    ChooseTimeComponent,
    ConfirmationComponent,
    CheckoutComponent,
    CommonModalComponent,
    RecipientComponent,
    CommonBookingComponent,
  ],
  imports: [
    CommonModule,
    BookingRoutingModule,
    FontAwesomeModule,
    FormsModule,
    ReactiveFormsModule,
    NgbModalModule,
    RecaptchaModule,
  ],
})
export class BookingModule {}
