import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CajaHome } from './caja-home';

describe('CajaHome', () => {
  let component: CajaHome;
  let fixture: ComponentFixture<CajaHome>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CajaHome]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CajaHome);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
