import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Contrast,
  Eraser,
  FlipHorizontal2,
  FlipVertical2,
  Layers,
  Loader2,
  Move,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Ruler,
  SunMedium,
  Triangle,
  ZoomIn,
} from 'lucide-react';

import { mensajeDeError } from '../../services/auth.service';
import type { Serie } from '../../services/dicomweb.mapper';
import { cargarSerie, listarSeries } from '../../services/dicomweb.service';
import { obtenerEstudio } from '../../services/studies.service';
import type { Study } from '../../services/studies.mapper';
import type { CrearMotor, EstadoVisor, Herramienta, MotorVisor } from '../../viewer/tipos';
import { formatearNumero, leerNumero, rangoDeVentana, validarVentanaNivel } from '../../viewer/ventana';

interface Props {
  /** Solo para pruebas: permite sustituir el visor real (Cornerstone necesita WebGL). */
  crearMotor?: CrearMotor;
}

/** Cornerstone pesa mucho: se descarga solo al abrir el visor, no al entrar a la lista de estudios. */
let moduloDelMotor: Promise<typeof import('../../viewer/motorVisor')> | null = null;

/**
 * La promesa de la descarga se comparte: así, si la pantalla pide el visor dos veces seguidas (React en desarrollo),
 * ambas llamadas esperan la misma promesa y llegan a la cola de creación en el orden en que se pidieron.
 */
const crearMotorReal: CrearMotor = async (elemento, opciones) => {
  moduloDelMotor ??= import('../../viewer/motorVisor');
  const { crearMotorCornerstone } = await moduloDelMotor;
  return crearMotorCornerstone(elemento, opciones);
};

const MENSAJE_SIN_VISOR =
  'No se pudo iniciar el visor de imágenes. Verifica que tu navegador tenga activada la aceleración por hardware (WebGL).';

const HERRAMIENTAS_UI: { id: Herramienta; etiqueta: string; icono: React.ReactNode }[] = [
  { id: 'desplazar', etiqueta: 'Desplazar serie', icono: <Layers className="h-5 w-5" /> },
  { id: 'ventana', etiqueta: 'Ventana y nivel', icono: <SunMedium className="h-5 w-5" /> },
  { id: 'zoom', etiqueta: 'Zoom', icono: <ZoomIn className="h-5 w-5" /> },
  { id: 'pan', etiqueta: 'Mover imagen', icono: <Move className="h-5 w-5" /> },
  { id: 'linea', etiqueta: 'Medir distancia', icono: <Ruler className="h-5 w-5" /> },
  { id: 'angulo', etiqueta: 'Medir ángulo', icono: <Triangle className="h-5 w-5" /> },
];

/** Botón táctil: mínimo 44×44 px (RNF-01). */
const BOTON =
  'inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40';
const BOTON_NORMAL = `${BOTON} border-slate-700 bg-[#0d1522] text-slate-300 hover:border-sky-500/50 hover:text-sky-300`;
const BOTON_ACTIVO = `${BOTON} border-sky-400 bg-sky-500/15 text-sky-300`;

function etiquetaDeSerie(s: Serie): string {
  const nombre = s.descripcion || (s.numero !== null ? `Serie ${s.numero}` : 'Serie');
  return nombre;
}

export const ViewerPage: React.FC<Props> = ({ crearMotor = crearMotorReal }) => {
  const { studyId = '' } = useParams<{ studyId: string }>();
  const navigate = useNavigate();

  const contenedor = useRef<HTMLDivElement>(null);
  const lienzo = useRef<HTMLDivElement>(null);
  const motor = useRef<MotorVisor | null>(null);
  const peticion = useRef(0);

  const [estudio, setEstudio] = useState<Study | null>(null);
  const [series, setSeries] = useState<Serie[]>([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [motorListo, setMotorListo] = useState(false);
  const [serieActiva, setSerieActiva] = useState<string | null>(null);
  const [cargandoSerie, setCargandoSerie] = useState(false);
  const [error, setError] = useState('');
  const [herramienta, setHerramienta] = useState<Herramienta>('ventana');
  const [estado, setEstado] = useState<EstadoVisor | null>(null);

  const [textoVentana, setTextoVentana] = useState('');
  const [textoNivel, setTextoNivel] = useState('');
  const [editando, setEditando] = useState(false);

  // --- Lista de series y datos del estudio ---------------------------------------------------------------------
  useEffect(() => {
    let vigente = true;
    setCargandoLista(true);
    setError('');
    void (async () => {
      try {
        const [lista, datos] = await Promise.all([
          listarSeries(studyId),
          obtenerEstudio(studyId).catch(() => null), // el encabezado es accesorio: si falla, el visor sigue
        ]);
        if (!vigente) return;
        setSeries(lista);
        setEstudio(datos);
      } catch (err) {
        if (vigente) setError(mensajeDeError(err));
      } finally {
        if (vigente) setCargandoLista(false);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [studyId]);

  // --- Visor (Cornerstone) --------------------------------------------------------------------------------------
  useEffect(() => {
    const elemento = lienzo.current;
    if (!elemento) return;
    let vigente = true;
    let creado: MotorVisor | null = null;

    crearMotor(elemento, {
      alCambiar: (e) => setEstado(e),
      alError: (mensaje) => setError(mensaje),
    })
      .then((m) => {
        if (!vigente) {
          m.destruir(); // la pantalla se cerró (o se remontó) mientras el visor arrancaba
          return;
        }
        creado = m;
        motor.current = m;
        setMotorListo(true);
      })
      .catch((err: unknown) => {
        console.error('No se pudo iniciar el visor de imágenes:', err);
        if (vigente) setError(MENSAJE_SIN_VISOR);
      });

    return () => {
      vigente = false;
      peticion.current += 1;
      creado?.destruir();
      motor.current = null;
      setMotorListo(false);
    };
  }, [crearMotor]);

  // El visor conserva su proporción cuando cambia el tamaño o la orientación de la pantalla (CA02.3).
  useEffect(() => {
    const caja = contenedor.current;
    if (!caja || typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(() => motor.current?.redimensionar());
    observador.observe(caja);
    return () => observador.disconnect();
  }, []);

  // --- Abrir una serie ------------------------------------------------------------------------------------------
  const abrirSerie = useCallback(
    async (serie: Serie) => {
      const m = motor.current;
      if (!m) return;
      const id = ++peticion.current;
      setSerieActiva(serie.uid);
      setCargandoSerie(true);
      setError('');
      try {
        const carga = await cargarSerie(studyId, serie.uid);
        if (id !== peticion.current) return; // el usuario ya eligió otra serie
        if (carga.imageIds.length === 0) {
          setError('La serie no tiene imágenes.');
          return;
        }
        const inicial: Herramienta = carga.imageIds.length > 1 ? 'desplazar' : 'ventana';
        setHerramienta(inicial);
        m.seleccionarHerramienta(inicial);
        await m.mostrarSerie(carga);
      } catch (err) {
        if (id === peticion.current) setError(mensajeDeError(err));
      } finally {
        if (id === peticion.current) setCargandoSerie(false);
      }
    },
    [studyId],
  );

  // Con una sola serie no hay nada que elegir: se abre sola. Con varias, se muestra primero la lista (CA02.4).
  useEffect(() => {
    const unica = series.length === 1 ? series[0] : undefined;
    if (motorListo && unica && serieActiva === null) void abrirSerie(unica);
  }, [motorListo, series, serieActiva, abrirSerie]);

  // --- Ventana y nivel: los campos siguen al visor salvo mientras la persona escribe ---------------------------
  useEffect(() => {
    if (editando || !estado) return;
    setTextoVentana(formatearNumero(estado.ventana));
    setTextoNivel(formatearNumero(estado.nivel));
  }, [estado, editando]);

  const aplicarValores = (ventana: string, nivel: string) => {
    const valores = validarVentanaNivel(leerNumero(ventana), leerNumero(nivel));
    if (valores) motor.current?.aplicarVentana(valores.ventana, valores.nivel);
  };

  const valoresInvalidos =
    editando && validarVentanaNivel(leerNumero(textoVentana), leerNumero(textoNivel)) === null;

  const elegirHerramienta = (h: Herramienta) => {
    setHerramienta(h);
    motor.current?.seleccionarHerramienta(h);
  };

  const hayImagen = serieActiva !== null && !cargandoSerie && estado !== null;
  const puedeUsarHerramientas = serieActiva !== null && !cargandoSerie;

  return (
    <div className="flex h-dvh flex-col bg-[#070b11] font-sans text-slate-100">
      {/* ENCABEZADO */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-800/80 bg-[#09101d] px-3 sm:px-5">
        <button
          type="button"
          onClick={() => navigate('/studies')}
          className={BOTON_NORMAL}
          aria-label="Volver a estudios"
          title="Volver a estudios"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="hidden sm:inline">Estudios</span>
        </button>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-bold text-white" data-testid="visor-paciente">
            {estudio?.patientName ?? (cargandoLista ? 'Cargando…' : 'Estudio')}
          </p>
          <p className="truncate font-mono text-[11px] text-slate-400" data-testid="visor-detalle">
            {[estudio?.patientId, estudio?.description, estudio?.studyDate].filter(Boolean).join(' · ')}
          </p>
        </div>
      </header>

      {/* AVISO: las imágenes son de referencia (RF-03, CA02.5) */}
      <div
        role="note"
        className="flex shrink-0 items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-center text-[11px] font-semibold text-amber-300"
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        Imagen de referencia, no apta para diagnóstico
      </div>

      {/* BARRA DE HERRAMIENTAS */}
      <div
        role="toolbar"
        aria-label="Herramientas del visor"
        className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-slate-800/80 bg-[#09101d] px-3 py-2 md:flex-wrap md:overflow-x-visible"
      >
        {HERRAMIENTAS_UI.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => elegirHerramienta(h.id)}
            disabled={!puedeUsarHerramientas}
            aria-pressed={herramienta === h.id}
            aria-label={h.etiqueta}
            title={h.etiqueta}
            className={herramienta === h.id ? BOTON_ACTIVO : BOTON_NORMAL}
          >
            {h.icono}
          </button>
        ))}
        <span className="mx-1 h-6 w-px shrink-0 bg-slate-700" aria-hidden="true" />
        <button type="button" disabled={!puedeUsarHerramientas} onClick={() => motor.current?.rotar(-90)} aria-label="Rotar a la izquierda" title="Rotar a la izquierda" className={BOTON_NORMAL}>
          <RotateCcw className="h-5 w-5" />
        </button>
        <button type="button" disabled={!puedeUsarHerramientas} onClick={() => motor.current?.rotar(90)} aria-label="Rotar a la derecha" title="Rotar a la derecha" className={BOTON_NORMAL}>
          <RotateCw className="h-5 w-5" />
        </button>
        <button type="button" disabled={!puedeUsarHerramientas} onClick={() => motor.current?.voltear('horizontal')} aria-label="Voltear horizontal" title="Voltear horizontal" className={BOTON_NORMAL}>
          <FlipHorizontal2 className="h-5 w-5" />
        </button>
        <button type="button" disabled={!puedeUsarHerramientas} onClick={() => motor.current?.voltear('vertical')} aria-label="Voltear vertical" title="Voltear vertical" className={BOTON_NORMAL}>
          <FlipVertical2 className="h-5 w-5" />
        </button>
        <button
          type="button"
          disabled={!puedeUsarHerramientas}
          onClick={() => motor.current?.invertir()}
          aria-label="Invertir colores"
          aria-pressed={estado?.invertida === true}
          title="Invertir colores"
          className={estado?.invertida ? BOTON_ACTIVO : BOTON_NORMAL}
        >
          <Contrast className="h-5 w-5" />
        </button>
        <button type="button" disabled={!puedeUsarHerramientas} onClick={() => motor.current?.borrarMediciones()} aria-label="Borrar mediciones" title="Borrar mediciones" className={BOTON_NORMAL}>
          <Eraser className="h-5 w-5" />
        </button>
        <button type="button" disabled={!puedeUsarHerramientas} onClick={() => motor.current?.restablecer()} aria-label="Restablecer" title="Restablecer" className={BOTON_NORMAL}>
          <RefreshCw className="h-5 w-5" />
          <span className="hidden md:inline">Restablecer</span>
        </button>
        <span className="mx-1 h-6 w-px shrink-0 bg-slate-700" aria-hidden="true" />
        <label className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-slate-400">
          Ventana
          <input
            inputMode="decimal"
            aria-label="Ventana"
            value={textoVentana}
            disabled={!hayImagen}
            onFocus={() => setEditando(true)}
            onBlur={() => setEditando(false)}
            onChange={(e) => {
              setTextoVentana(e.target.value);
              aplicarValores(e.target.value, textoNivel);
            }}
            className="h-11 w-20 rounded-lg border border-slate-700 bg-[#0d1522] px-2 text-center font-mono text-xs text-slate-100 outline-none focus:border-sky-400 disabled:opacity-40"
          />
        </label>
        <label className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-slate-400">
          Nivel
          <input
            inputMode="decimal"
            aria-label="Nivel"
            value={textoNivel}
            disabled={!hayImagen}
            onFocus={() => setEditando(true)}
            onBlur={() => setEditando(false)}
            onChange={(e) => {
              setTextoNivel(e.target.value);
              aplicarValores(textoVentana, e.target.value);
            }}
            className="h-11 w-20 rounded-lg border border-slate-700 bg-[#0d1522] px-2 text-center font-mono text-xs text-slate-100 outline-none focus:border-sky-400 disabled:opacity-40"
          />
        </label>
        {valoresInvalidos && (
          <span role="status" className="shrink-0 text-[11px] text-amber-300">
            La ventana debe ser mayor que 0.
          </span>
        )}
      </div>

      {/* SERIES + IMAGEN */}
      <div ref={contenedor} className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav
          aria-label="Series del estudio"
          className="flex shrink-0 gap-2 overflow-x-auto border-b border-slate-800/80 bg-[#09101d] p-2 md:w-64 md:flex-col md:overflow-y-auto md:overflow-x-hidden md:border-b-0 md:border-r"
        >
          {cargandoLista && <p className="p-2 text-xs text-slate-400">Cargando series…</p>}
          {!cargandoLista && series.length === 0 && !error && (
            <p className="p-2 text-xs text-slate-400">Este estudio no tiene series.</p>
          )}
          {series.map((s) => {
            const activa = s.uid === serieActiva;
            return (
              <button
                key={s.uid}
                type="button"
                onClick={() => void abrirSerie(s)}
                aria-current={activa ? 'true' : undefined}
                className={`min-h-11 w-44 shrink-0 rounded-lg border px-3 py-2 text-left transition-colors md:w-full ${
                  activa
                    ? 'border-sky-400 bg-sky-500/15 text-sky-200'
                    : 'border-slate-700 bg-[#0d1522] text-slate-300 hover:border-sky-500/50'
                }`}
              >
                <span className="block truncate text-xs font-bold">{etiquetaDeSerie(s)}</span>
                <span className="block truncate font-mono text-[10px] text-slate-400">
                  {[s.modalidad, s.instancias !== null ? `${s.instancias} img` : null].filter(Boolean).join(' · ')}
                </span>
              </button>
            );
          })}
        </nav>

        <main className="relative min-h-0 flex-1 bg-black">
          {/* El lienzo que usa Cornerstone: nunca se desmonta mientras la pantalla está abierta. */}
          <div
            ref={lienzo}
            data-testid="lienzo"
            className="absolute inset-0 touch-none"
            onContextMenu={(e) => e.preventDefault()}
          />

          {hayImagen && (
            <>
              <div className="pointer-events-none absolute left-3 top-3 text-[11px] leading-tight text-slate-200 drop-shadow">
                <p className="font-bold">{estudio?.patientName}</p>
                <p className="font-mono text-slate-300">{estudio?.patientId}</p>
              </div>
              <div className="pointer-events-none absolute bottom-3 left-3 font-mono text-[11px] leading-tight text-slate-200 drop-shadow">
                <p data-testid="visor-indice">
                  Imagen {estado.indice + 1} / {estado.total}
                </p>
                <p data-testid="visor-zoom">Zoom {Math.round(estado.zoom * 100)}%</p>
              </div>
              <div className="pointer-events-none absolute bottom-3 right-3 text-right font-mono text-[11px] leading-tight text-slate-200 drop-shadow">
                <p data-testid="visor-wl">
                  W {formatearNumero(estado.ventana) || '—'} · L {formatearNumero(estado.nivel) || '—'}
                </p>
                {estado.ventana !== null && estado.nivel !== null && (
                  <p className="text-slate-400">
                    {Math.round(rangoDeVentana(estado.ventana, estado.nivel).lower)} a{' '}
                    {Math.round(rangoDeVentana(estado.ventana, estado.nivel).upper)}
                  </p>
                )}
              </div>
            </>
          )}

          {serieActiva === null && !cargandoLista && !error && series.length > 1 && (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-slate-400">
              Elige una serie de la lista para ver sus imágenes.
            </p>
          )}

          {cargandoSerie && (
            <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 text-sm text-slate-200">
              <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
              Cargando imágenes…
            </div>
          )}

          {error && (
            <div role="alert" className="absolute inset-x-3 top-3 z-10 flex items-start gap-2 rounded-lg border border-red-500/40 bg-[#1a0d10] px-4 py-3 text-xs text-red-200 shadow-lg">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ViewerPage;
