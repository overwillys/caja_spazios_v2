export type MetodoPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE' | 'RETENCION';

export interface Cuota {
  id: number;
  periodo: string;
  concepto: string;
  importe: number;
  importeAPagar: number;
  seleccionado: boolean;
  fechaVencimiento: string; // 'YYYY-MM-DD' o 'DD-MM-YYYY'
  vencido: boolean; // calculado en frontend
  id_tarifa: number;
}

export interface Pagos {
  efectivo: number;
  transferencia: number;
  cheque: number;
  retencion: number;
}

export interface Inquilino {
  nombre: string;
  propiedad: string;
  tipo: string;
  cuit: string;
  diaVencimiento: number;
  deudaTotal: number;
}

// Respuesta esperada del backend
export interface CajaResponse {
  inquilino: Inquilino;
  cuotas: {
    id: number;
    periodo: string;
    concepto: string;
    importe: number;
    fechaVencimiento: string; // 'DD-MM-YYYY' o 'YYYY-MM-DD'
  }[];
}
