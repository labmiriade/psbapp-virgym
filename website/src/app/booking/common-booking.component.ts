import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { PlaceInfo } from '../core/interfaces/api.interface';
import { AppState } from '../store/reducers';
import { searchPlace } from '../store/selectors/booking.selector';
import { searchKeywords } from '../store/selectors/main.selector';

@Component({
  selector: 'app-common-booking',
  templateUrl: './common-booking.component.html',
  styleUrls: ['./common-booking.component.scss'],
})
export class CommonBookingComponent implements OnInit {
  place?: PlaceInfo;
  constructor(private store: Store<AppState>, private router: Router) {}
  sub = new Subscription();
  ngOnInit(): void {
    this.sub.add(this.store.select(searchPlace()).subscribe((place) => (this.place = place)));
  }

  onGoBackClick() {
    this.store
      .select(searchKeywords())
      .pipe(take(1))
      .subscribe((keys) => {
        this.router.navigate(['/search'], {
          queryParams: {
            q: keys.key,
            geo: keys.geo ? keys.geo : '0',
          },
        });
      });
  }
}
