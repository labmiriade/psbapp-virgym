import { Component, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-common-modal',
  templateUrl: './common-modal.component.html',
  styleUrls: ['./common-modal.component.scss'],
})
export class CommonModalComponent {
  constructor(private modalRef: NgbActiveModal) {}

  message: string = '';
  title: string = '';
  successTitle: string = '';

  dismiss() {
    this.modalRef.dismiss();
  }

  success() {
    this.modalRef.close('success');
  }
}
