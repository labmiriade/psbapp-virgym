import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { addMinutes, isAfter, parseISO } from 'date-fns';
import { Slot } from 'src/app/core/interfaces/api.interface';

@Component({
  selector: 'app-choose-time',
  templateUrl: './choose-time.component.html',
  styleUrls: ['./choose-time.component.scss'],
})
export class ChooseTimeComponent implements OnInit {
  @Input() slots: Slot[] = [];
  @Output() setTime: EventEmitter<Slot> = new EventEmitter();

  @Input() selectedTime?: Slot;

  slotsData: SlotDates[] = [];

  ngOnInit(): void {
    this.slots.forEach((slot: any) => {
      let endDatetime = addMinutes(parseISO(slot.startDatetime), slot.duration).toISOString();
      this.slotsData.push({ slot, endDatetime });
    });

    // Sort by start hour
    this.slotsData = this.slotsData.sort((a, b) =>
      isAfter(parseISO(a.slot.startDatetime), parseISO(b.slot.startDatetime))
        ? 1
        : isAfter(parseISO(b.slot.startDatetime), parseISO(a.slot.startDatetime))
        ? -1
        : 0,
    );
  }

  selectSlot(slot: SlotDates) {
    if (slot.slot.availablePlaces && slot.slot.availablePlaces > 0) {
      this.setTime.emit(slot.slot);
    }
  }
}

export interface SlotDates {
  slot: Slot;
  endDatetime?: string;
}
