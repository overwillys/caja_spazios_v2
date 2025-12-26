import { Component, computed, inject, OnInit, signal, OnDestroy, Renderer2  } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CurrencyArPipe } from '../../../../shared/pipes/currency-ar.pipe';
import { Cuota, Inquilino, MetodoPago, Pagos } from '../../models/caja.models';
import { CajaService, PagarRequest } from '../../services/caja.service';
import { DOCUMENT } from '@angular/common';


@Component({
  selector: 'app-caja-home',
  standalone: true,
  imports: [CurrencyArPipe],
  templateUrl: './caja-home.html',
  styleUrl: './caja-home.scss',
})
export class CajaHome implements OnInit, OnDestroy  {

  private cajaService = inject(CajaService);
  private route = inject(ActivatedRoute);
  private renderer = inject(Renderer2);
    private document = inject(DOCUMENT);



  
  idWork = signal<number>(0);
  usuarioActual = signal<string>('');
  fechaOriginal = signal<string | undefined>(undefined);

  inquilino = signal<Inquilino>({
    nombre: '',
    propiedad: '',
    tipo: '',
    cuit: '',
    diaVencimiento: 0,
    deudaTotal: 0,
  });

  cuotas = signal<Cuota[]>([]);
  metodoActivo = signal<MetodoPago | null>(null);
  cargando = signal(false);

  pagos = signal<Pagos>({
    efectivo: 0,
    transferencia: 0,
    cheque: 0,
    retencion: 0,
  });

  esTransferencia = signal<boolean>(false);
  efectivoHabilitado = computed(() => !this.esTransferencia());
  transferenciaHabilitada = computed(() => this.esTransferencia());

  ngOnInit() {

        // ⬇️ AGREGAR: Ocultar scrollbars al cargar el componente
    this.renderer.setStyle(this.document.body, 'overflow', 'hidden');
    this.renderer.setStyle(this.document.documentElement, 'overflow', 'hidden');

    const idWorkParam = this.route.snapshot.queryParams['idWork'];
    const fechaParam = this.route.snapshot.queryParams['fecha'];
    const usuarioParam = this.route.snapshot.queryParams['usuario'];

    console.log('📋 Query Params:', {
      idWork: idWorkParam,
      fecha: fechaParam || 'NO RECIBIDA',
      usuario: usuarioParam || 'NO RECIBIDO'
    });

    if (idWorkParam) {
      this.idWork.set(parseInt(idWorkParam));
      this.usuarioActual.set(usuarioParam || 'cajeroSYS');
      this.fechaOriginal.set(fechaParam);
      this.cargarDatos(fechaParam); // ⬅️ SOLO UNA LLAMADA CON FECHA
    } else {
      alert('Falta parámetro idWork');
    }
  }

  ngOnDestroy() {
    // ⬇️ AGREGAR: Restaurar scrollbars al salir del componente
    this.renderer.removeStyle(this.document.body, 'overflow');
    this.renderer.removeStyle(this.document.documentElement, 'overflow');
  }

  cargarDatos(fecha?: string) {
    this.cargando.set(true);

    console.log('🎯 Llamando obtenerCuotas con:', {
      idWork: this.idWork(),
      fecha: fecha || 'SIN FECHA (usará hoy)',
      usuario: this.usuarioActual()
    });

    this.cajaService.obtenerCuotas(this.idWork(), fecha).subscribe({
      next: (data) => {
        console.log('✅ Datos recibidos:', data);
        this.inquilino.set(data.inquilino);
        this.cuotas.set(data.cuotas);
        
        this.esTransferencia.set(data.esTransferencia);
        
        if (data.esTransferencia) {
          this.pagos.update(p => ({ ...p, efectivo: 0 }));
        } else {
          this.pagos.update(p => ({ ...p, transferencia: 0 }));
        }
        
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('❌ Error al cargar cuotas:', err);
        alert('Error al cargar datos del inquilino');
        this.cargando.set(false);
      },
    });
  }

  // --------- DERIVADOS: PERÍODOS ---------

  periodosUnicos = computed(() => {
    const cuotas = this.cuotas();
    return [...new Set(cuotas.map(c => c.periodo))];
  });

  periodosConSeleccion = computed(() => {
    const cuotas = this.cuotas();
    const periodos = this.periodosUnicos();
    return periodos.map(periodo =>
      cuotas.some(c => c.periodo === periodo && c.seleccionado),
    );
  });

  ultimoPeriodoConSeleccion = computed(() => {
    const periodosSel = this.periodosConSeleccion();
    let ultimo = -1;
    for (let i = 0; i < periodosSel.length; i++) {
      if (periodosSel[i]) ultimo = i;
    }
    return ultimo;
  });

  periodoCompleto = computed(() => {
    const cuotas = this.cuotas();
    const periodos = this.periodosUnicos();
    return periodos.map(periodo => {
      const cuotasPeriodo = cuotas.filter(c => c.periodo === periodo);
      if (cuotasPeriodo.length === 0) return false;
      return cuotasPeriodo.every(c => c.seleccionado);
    });
  });

  cuotaHabilitada = computed(() => {
    const cuotas = this.cuotas();
    const periodos = this.periodosUnicos();

    return cuotas.map(cuota => {
      const idxPeriodo = periodos.indexOf(cuota.periodo);

      if (idxPeriodo === 0) return true;

      const periodoAnterior = periodos[idxPeriodo - 1];
      const cuotaMismoConceptoAnterior = cuotas.find(
        c => c.periodo === periodoAnterior && c.concepto === cuota.concepto
      );

      if (!cuotaMismoConceptoAnterior) {
        const cuotasAnterioresMismoConcepto = cuotas.filter(
          c => periodos.indexOf(c.periodo) < idxPeriodo && c.concepto === cuota.concepto
        );

        if (cuotasAnterioresMismoConcepto.length === 0) {
          return true;
        }

        const ultimaCuota = cuotasAnterioresMismoConcepto[cuotasAnterioresMismoConcepto.length - 1];
        return ultimaCuota.seleccionado;
      }

      return cuotaMismoConceptoAnterior.seleccionado;
    });
  });

  // --------- DERIVADOS: TOTALES ---------

  totalAPagar = computed(() =>
    this.cuotas().reduce(
      (acc, c) => acc + (c.seleccionado ? c.importeAPagar : 0),
      0,
    ),
  );

  totalPagado = computed(() => {
    const p = this.pagos();
    return p.efectivo + p.transferencia + p.cheque + p.retencion;
  });

  diferencia = computed(() => this.totalPagado() - this.totalAPagar());

  // --------- MÉTODOS: DISTRIBUCIÓN AUTOMÁTICA ---------

  distribuirPagoAutomatico() {
    const totalDisponible = this.totalPagado();
    let restante = totalDisponible;

    this.cuotas.update(list => {
      return list.map(cuota => {
        if (restante <= 0) {
          return { ...cuota, seleccionado: false, importeAPagar: 0 };
        }

        const pagar = Math.min(cuota.importe, restante);
        restante -= pagar;

        return {
          ...cuota,
          seleccionado: pagar > 0,
          importeAPagar: pagar,
        };
      });
    });
  }

  // --------- MÉTODOS: PAGOS ---------

  cambiarPago(metodo: keyof Pagos, valor: string) {
  // ⬇️ VALIDAR: Solo números, comas y puntos
  const valorLimpio = valor.replace(/[^\d,]/g, '');
  const numero = parseFloat(valorLimpio.replace(/,/g, '.')) || 0;
  
  if (metodo === 'efectivo' && this.esTransferencia()) {
    console.warn('⚠️ No se puede usar efectivo en transferencia');
    return;
  }
  
  if (metodo === 'transferencia' && !this.esTransferencia()) {
    console.warn('⚠️ No se puede usar transferencia en pago del día');
    return;
  }

  this.metodoActivo.set(metodo.toUpperCase() as MetodoPago);
  this.pagos.update(p => ({ ...p, [metodo]: numero }));
  this.distribuirPagoAutomatico();
  }

  // --------- MÉTODOS: CUOTAS ---------

  actualizarCuota(id: number, cambios: Partial<Cuota>) {
    this.cuotas.update(list =>
      list.map(c => (c.id === id ? { ...c, ...cambios } : c)),
    );
  }

  toggleSeleccion(id: number, seleccionado: boolean) {
    const cuotas = this.cuotas();
    const idx = cuotas.findIndex(c => c.id === id);
    const habilitadas = this.cuotaHabilitada();

    if (!habilitadas[idx]) return;

    const cuotaActual = cuotas[idx];
    const periodos = this.periodosUnicos();
    const idxPeriodoActual = periodos.indexOf(cuotaActual.periodo);

    if (!seleccionado) {
      this.actualizarCuota(id, { seleccionado: false, importeAPagar: 0 });

      this.cuotas.update(list =>
        list.map(c => {
          const idxPeriodoCuota = periodos.indexOf(c.periodo);

          if (
            c.concepto === cuotaActual.concepto &&
            idxPeriodoCuota > idxPeriodoActual
          ) {
            return { ...c, seleccionado: false, importeAPagar: 0 };
          }

          return c;
        }),
      );
    } else {
      this.actualizarCuota(id, { seleccionado: true });
    }
  }

  cambiarImporteAPagar(id: number, valor: string) {
    // ⬇️ VALIDAR: Solo números, comas y puntos
    const valorLimpio = valor.replace(/[^\d,\.]/g, '');
    const numero = parseFloat(valorLimpio.replace(/,/g, '.')) || 0;
    const seleccionado = numero > 0;

    this.actualizarCuota(id, {
      importeAPagar: numero,
      seleccionado,
    });
  }

  // ⬇️ NUEVO: Método para validar teclas en los inputs
  validarTecla(event: KeyboardEvent): void {
    const teclasPermitidas = [
      'Backspace', 'Tab', 'End', 'Home', 'ArrowLeft', 'ArrowRight', 'Delete', ','
    ];
    
    // Permitir teclas especiales
    if (teclasPermitidas.includes(event.key)) {
      return;
    }
    
    // Permitir Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
    if (event.ctrlKey && ['a', 'c', 'v', 'x'].includes(event.key.toLowerCase())) {
      return;
    }
    
    // Bloquear si no es número
    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
    }
  }

  pagarTodo() {
    this.cuotas.update(list =>
      list.map(c => ({
        ...c,
        seleccionado: true,
        importeAPagar: c.importe,
      })),
    );

    const total = this.cuotas().reduce((acc, c) => acc + c.importe, 0);

    if (this.esTransferencia()) {
      this.pagos.set({
        efectivo: 0,
        transferencia: total,
        cheque: 0,
        retencion: 0,
      });
      this.metodoActivo.set('TRANSFERENCIA');
    } else {
      this.pagos.set({
        efectivo: total,
        transferencia: 0,
        cheque: 0,
        retencion: 0,
      });
      this.metodoActivo.set('EFECTIVO');
    }
  }

  pagar() {
    if (this.diferencia() !== 0 || this.totalAPagar() === 0) {
      alert('El monto pagado no coincide con el total a pagar');
      return;
    }

    if (confirm('¿Confirmar pago?')) {
      this.cargando.set(true);

      const cuotasAPagar = this.cuotas()
        .filter(c => c.seleccionado)
        .map(c => ({
          id_tarifa: c.id_tarifa,
          periodo: c.periodo,
          importe: c.importeAPagar,
        }));

      const request: PagarRequest = {
        id_work: this.idWork(),
        efectivo: this.pagos().efectivo,
        transferencia: this.pagos().transferencia,
        cheque: this.pagos().cheque,
        retencion: this.pagos().retencion,
        cuotas: cuotasAPagar,
        usuario: this.usuarioActual(),
        fecha_transferencia: this.fechaOriginal() // ⬅️ AGREGAR ESTA LÍNEA
      };

      console.log('💳 Enviando pago:', request);
      console.log('📅 Fecha que se envía:', this.fechaOriginal());

      this.cajaService.registrarPago(request).subscribe({
        next: (response) => {
          this.cargando.set(false);
          
          if (response.success) {
            alert(`Pago registrado exitosamente\nComprobante: ${response.nroComprobante}`);

            // ⬇️ ABRIR VENTANA DE IMPRESIÓN CON GET
            const urlImpresion = `../blank_imprime_comprobante/blank_imprime_comprobante.php?comprobante=${response.nroComprobante}&pago_total=${response.pagoTotal}`;
            window.open(urlImpresion, '_blank', 'width=800,height=600');

           
            // ⬇️ RECARGAR DATOS
            //this.cargarDatos(this.fechaOriginal());
            //this.resetearPagos();

            // ⬇️ AGREGAR REDIRECCIÓN DESPUÉS DEL ALERT
            //window.location.href = '../control_seleccionar_cliente_a_cobrar/control_seleccionar_cliente_a_cobrar.php';

            // Limpiar estilos
            this.renderer.removeStyle(this.document.body, 'overflow');
            this.renderer.removeStyle(this.document.documentElement, 'overflow');
            
            setTimeout(() => {
              try {
                // Cerrar la pestaña de ScriptCase
                (window.parent as any).del_aba_td('item_69');
              } catch (e) {
                console.error('Error al cerrar pestaña:', e);
                window.location.href = '../control_seleccionar_cliente_a_cobrar/control_seleccionar_cliente_a_cobrar.php';
              }
            }, 1000);

          } else {
            alert('Error: ' + response.message);
          }
        },
        error: (err) => {
          this.cargando.set(false);
          console.error('❌ Error al registrar pago:', err);
          alert('Error al registrar el pago. Intente nuevamente.');
        },
      });
    }
  }

/*
  resetearPagos() {
    this.pagos.set({
      efectivo: 0,
      transferencia: 0,
      cheque: 0,
      retencion: 0,
    });
    this.metodoActivo.set(null);
  }
*/
  
// ⬇️ AGREGAR ESTE MÉTODO AL FINAL
  cerrarYVolver() {
    // Limpiar estilos
    this.renderer.removeStyle(this.document.body, 'overflow');
    this.renderer.removeStyle(this.document.documentElement, 'overflow');
    
    try {
      // Llamar a la función de ScriptCase para cerrar la pestaña
      (window.parent as any).del_aba_td('item_69');
    } catch (e) {
      console.error('Error al cerrar pestaña:', e);
      // Fallback: redirigir
      window.location.href = '../control_seleccionar_cliente_a_cobrar/control_seleccionar_cliente_a_cobrar.php';
    }

  }
}
