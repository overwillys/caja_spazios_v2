import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'currencyAr',
  standalone: true,
})
export class CurrencyArPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (value == null || isNaN(value)) return '0';
    
    const formatted = Math.round(value)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    
    return formatted;
  }
}
