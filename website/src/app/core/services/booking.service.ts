import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BookingInfo, BookingRequest, BookingResponse, PlaceInfo, SlotsResponse } from '../interfaces/api.interface';
import { zonedTimeToUtc } from 'date-fns-tz';
@Injectable({
  providedIn: 'root',
})
export class BookingService {
  constructor(private http: HttpClient) {}

  getPlace(placeId: string): Observable<PlaceInfo> {
    return this.http.get<PlaceInfo>(`/p/${placeId}`);
  }

  getSlots(placeId: string): Observable<SlotsResponse> {
    let from = zonedTimeToUtc(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone).toISOString();
    return this.http.get<SlotsResponse>(`/p/${placeId}/slots?from=${from}`);
  }

  getBookedSlot(bookingId: string): Observable<BookingInfo> {
    return this.http.get<BookingInfo>(`/b/${bookingId}`);
  }

  bookSlot(placeId: string, slotId: string, request: BookingRequest): Observable<BookingResponse> {
    return this.http.post<BookingResponse>(`/p/${placeId}/slots/${slotId}/bookings`, request);
  }

  deleteBooking(recipientId: string): Observable<any> {
    return this.http.delete<any>(`/b/${recipientId}`);
  }
}
