import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Cuota, Inquilino } from '../models/caja.models';
import { environment } from '../../../../environments/environment';

// Interfaces para las respuestas de ScriptCase
export interface CajaApiResponse {
  success: boolean;
  message?: string;
  inquilino: Inquilino;
  cuotas: {
    id: number;
    id_detalle: number;
    periodo: string;
    concepto: string;
    importe: number;
    importeOriginal: number;
    interes: number;
    fechaVencimiento: string;
    id_tarifa: number;
  }[];
  fechaCalculo: string;
  tasaDiaria?: number;
  esTransferencia: boolean; // ⬅️ NUEVO
  fechaHoy?: string; // ⬅️ NUEVO (opcional)
}

export interface PagarRequest {
  id_work: number;
  efectivo: number;
  transferencia: number;
  cheque: number;
  retencion: number;
  cuotas: {
    id_tarifa: number;
    periodo: string;
    importe: number;
  }[];
  fecha_transferencia?: string;
  usuario: string;
}

export interface PagarResponse {
  success: boolean;
  message: string;
  nroComprobante: number;
  pagoTotal: number;
}

@Injectable({
  providedIn: 'root',
})
export class CajaService {
  private http = inject(HttpClient);

  // URLs de los blanks en ScriptCase
  private urlObtenerCuotas = `${environment.scriptCaseUrl}/blank_api_obtener_cuotas/`;
  private urlRegistrarPago = `${environment.scriptCaseUrl}/blank_api_registrar_pago/`;

  /**
   * Obtiene las cuotas pendientes de un inquilino desde ScriptCase
   */
  obtenerCuotas(idWork: number, fecha?: string): Observable<{ 
    inquilino: Inquilino; 
    cuotas: Cuota[];
    esTransferencia: boolean; // ⬅️ NUEVO
  }> {
    let params = new HttpParams().set('id_work', idWork.toString());

    if (fecha) {
      params = params.set('fecha', fecha);
    }

    return this.http.get<CajaApiResponse>(this.urlObtenerCuotas, { params }).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Error al obtener cuotas');
        }

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const cuotas: Cuota[] = response.cuotas.map(c => {
          const fechaVenc = this.parsearFecha(c.fechaVencimiento);
          const vencido = fechaVenc < hoy;

          return {
            id: c.id,
            periodo: c.periodo,
            concepto: c.concepto,
            importe: c.importe,
            importeAPagar: vencido ? c.importe : 0,
            seleccionado: vencido,
            fechaVencimiento: c.fechaVencimiento,
            vencido,
            id_tarifa: c.id_tarifa,
          };
        });

        return {
          inquilino: response.inquilino,
          cuotas,
          esTransferencia: response.esTransferencia, // ⬅️ NUEVO
        };
      })
    );
  }

  /**
   * Registra el pago de cuotas en ScriptCase
   */
  registrarPago(data: PagarRequest): Observable<PagarResponse> {
    return this.http.post<PagarResponse>(this.urlRegistrarPago, data);
  }

  /**
   * Parsea fecha DD-MM-YYYY o YYYY-MM-DD a Date
   */
  parsearFecha(fecha: string): Date {
    const partes = fecha.split('-');

    // Si viene YYYY-MM-DD
    if (partes[0].length === 4) {
      return new Date(fecha);
    }

    // Si viene DD-MM-YYYY
    const [dia, mes, anio] = partes;
    return new Date(`${anio}-${mes}-${dia}`);
  }

  /**
   * Verifica si una fecha está vencida
   */
  estaVencida(fechaVencimiento: string, fechaReferencia: Date = new Date()): boolean {
    const fechaVenc = this.parsearFecha(fechaVencimiento);
    return fechaVenc < fechaReferencia;
  }

  /**
   * Procesa las cuotas del backend y marca vencidas
   */
  procesarCuotas(cuotasBackend: CajaApiResponse['cuotas']): Cuota[] {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    return cuotasBackend.map(c => {
      const vencido = this.estaVencida(c.fechaVencimiento, hoy);

      return {
        id: c.id,
        periodo: c.periodo,
        concepto: c.concepto,
        importe: c.importe,
        importeAPagar: vencido ? c.importe : 0,
        seleccionado: vencido,
        fechaVencimiento: c.fechaVencimiento,
        vencido,
        id_tarifa: c.id_tarifa,
      };
    });
  }
}
