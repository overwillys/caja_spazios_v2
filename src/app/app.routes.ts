import { Routes } from '@angular/router';
import { CajaHome } from './features/caja/pages/caja-home/caja-home';

export const routes: Routes = [
  { path: '', redirectTo: 'caja', pathMatch: 'full' },
  { path: 'caja', component: CajaHome },
];
