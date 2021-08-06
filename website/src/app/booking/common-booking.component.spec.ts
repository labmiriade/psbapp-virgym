import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommonBookingComponent } from './common-booking.component';

describe('CommonBookingComponent', () => {
  let component: CommonBookingComponent;
  let fixture: ComponentFixture<CommonBookingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CommonBookingComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CommonBookingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
