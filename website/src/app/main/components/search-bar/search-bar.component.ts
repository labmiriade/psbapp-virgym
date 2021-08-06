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

@Component({
  selector: 'app-search-bar',
  templateUrl: './search-bar.component.html',
  styleUrls: ['./search-bar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchBarComponent implements OnChanges, OnInit, OnDestroy {
  @Input() q = '';
  @Output() searchClick = new EventEmitter<{ q: string; geo: boolean }>();

  allPlace: boolean = true;
  form: FormGroup;
  private sub: Subscription;

  constructor(private fb: FormBuilder) {
    this.sub = new Subscription();
    this.form = this.fb.group({
      q: this.q ?? '',
    });
  }

  ngOnInit(): void {
    this.sub.add(
      this.form.valueChanges.subscribe((dati) => {
        if (dati.q !== '') {
          this.allPlace = false;
        } else {
          this.allPlace = true;
        }
      }),
    );
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
    const q: string = (this.form.value.q || '').trim();

    this.searchClick.emit({ q, geo });
  }

  isGeoDisabled(): boolean {
    return !navigator.geolocation;
  }
}
