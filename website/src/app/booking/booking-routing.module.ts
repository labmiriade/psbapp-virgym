import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CommonBookingComponent } from './common-booking.component';
import { BookingComponent } from './routes/booking/booking.component';
import { RecipientComponent } from './routes/recipient/recipient.component';

const routes: Routes = [
  {
    path: '',
    component: CommonBookingComponent,
    children: [
      {
        path: 'recipient/:recipientId',
        component: RecipientComponent,
      },
      {
        path: ':placeId',
        component: BookingComponent,
      },
      {
        path: '**',
        redirectTo: '/',
        pathMatch: 'full',
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BookingRoutingModule {}
