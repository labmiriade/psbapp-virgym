import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-choose-date',
  templateUrl: './choose-date.component.html',
  styleUrls: ['./choose-date.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChooseDateComponent {
  @Input() days?: { [key: string]: any[] };
  @Output() setDay: EventEmitter<any> = new EventEmitter();

  @Input() selectedDay: any;

  selectDay(dateValue: any) {
    this.setDay.emit(dateValue);
  }

  get daysLength(): number {
    if (!this.days) {
      return 0;
    }
    return Object.keys(this.days).length;
  }
}
