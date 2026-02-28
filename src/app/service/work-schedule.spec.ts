import { TestBed } from '@angular/core/testing';

import { WorkSchedule } from './work-schedule';

describe('WorkSchedule', () => {
  let service: WorkSchedule;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WorkSchedule);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
