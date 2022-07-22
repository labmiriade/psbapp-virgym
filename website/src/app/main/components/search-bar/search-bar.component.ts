import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ToastService, ToastType } from 'src/app/core/services/toast.service';

@Component({
  selector: 'app-search-bar',
  templateUrl: './search-bar.component.html',
  styleUrls: ['./search-bar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchBarComponent implements OnChanges, OnDestroy {
  @Input() q = '';
  @Output() searchClick = new EventEmitter<{ q: string; geo: boolean }>();

  form: FormGroup;
  private sub: Subscription;

  constructor(private fb: FormBuilder, private toast: ToastService) {
    this.sub = new Subscription();
    this.form = this.fb.group({
      q: this.q ?? '',
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.q && changes.q.previousValue !== changes.q.currentValue && this.form) {
      this.form.patchValue({ q: this.q ?? '' });
    }
  }

  search(e: Event, geo = false): void {
    e.preventDefault();
    if (this.form.value.q.length < 3) {
      this.toast.show(
        'Ricerca non valida',
        'Inserire una parola di almeno 3 caratteri e premere il pulsante Ricerca o GeoRicerca',
        ToastType.Danger,
      );
    } else {
      const q: string = this.form.value.q.trim();
      this.searchClick.emit({ q, geo });
    }
  }

  isGeoDisabled(): boolean {
    return !navigator.geolocation;
  }
}
