import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GymSearchCardComponent } from './gym-search-card.component';

describe('GymSearchCardComponent', () => {
  let component: GymSearchCardComponent;
  let fixture: ComponentFixture<GymSearchCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GymSearchCardComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GymSearchCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
