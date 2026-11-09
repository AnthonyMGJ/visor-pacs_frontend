import { AxiosError, type AxiosResponse } from 'axios';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewerPage } from './ViewerPage';
import { useAuthStore } from '../../store/auth.store';
import * as dicomweb from '../../services/dicomweb.service';
import * as estudios from '../../services/studies.service';
import type { Serie } from '../../services/dicomweb.mapper';
import type { Study } from '../../services/studies.mapper';
import type { CrearMotor, EstadoVisor, MotorVisor, OpcionesMotor } from '../../viewer/tipos';

const estudio: Study = {
  uid: 'E1', patientId: 'PRUEBA-0001', patientName: 'GARCIA, CARLOS', ageSex: '45M',
  modalities: ['CT'], studyDate: '2026-09-15 10:00', description: 'TC TORAX', instances: 180,
};
const serie = (uid: string, numero: number, descripcion: string, instancias: number | null = 180): Serie => ({
  uid, numero, descripcion, modalidad: 'CT', instancias,
});
const carga = (n: number): dicomweb.SerieCargada => ({
  imageIds: Array.from({ length: n }, (_, i) => `wadors:x/${i}`),
  instancias: Array.from({ length: n }, (_, i) => ({ sopUid: `S${i}`, numero: i + 1, z: i })),
  metadatos: new Map(),
});
const estadoBase: EstadoVisor = {
  indice: 0, total: 180, ventana: 1500, nivel: -600, zoom: 1, rotacion: 0, invertida: false,
};

function errorHttp(status: number): AxiosError {
  return new AxiosError('x', 'ERR', undefined, undefined, { status } as AxiosResponse);
}

interface Visor {
  motor: MotorVisor & { [K in keyof MotorVisor]: ReturnType<typeof vi.fn> };
  opciones: () => OpcionesMotor;
  crear: CrearMotor;
}

function visorSimulado(): Visor {
  let opciones!: OpcionesMotor;
  const motor = {
    mostrarSerie: vi.fn().mockResolvedValue(undefined),
    seleccionarHerramienta: vi.fn(),
    rotar: vi.fn(),
    voltear: vi.fn(),
    invertir: vi.fn(),
    aplicarVentana: vi.fn(),
    restablecer: vi.fn(),
    borrarMediciones: vi.fn(),
    redimensionar: vi.fn(),
    destruir: vi.fn(),
  } as Visor['motor'];
  const crear: CrearMotor = vi.fn(async (_el, o) => {
    opciones = o;
    return motor;
  });
  return { motor, opciones: () => opciones, crear };
}

function montar(crear: CrearMotor) {
  return render(
    <MemoryRouter initialEntries={['/viewer/E1']}>
      <Routes>
        <Route path="/viewer/:studyId" element={<ViewerPage crearMotor={crear} />} />
        <Route path="/studies" element={<div>lista de estudios</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ViewerPage', () => {
  let visor: Visor;

  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({ rol: 'MEDICO' });
    visor = visorSimulado();
    vi.spyOn(estudios, 'obtenerEstudio').mockResolvedValue(estudio);
  });

  it('muestra los datos del estudio y el aviso de que no es apta para diagnóstico', async () => {
    vi.spyOn(dicomweb, 'listarSeries').mockResolvedValue([serie('S1', 1, 'AXIAL')]);
    vi.spyOn(dicomweb, 'cargarSerie').mockResolvedValue(carga(2));
    montar(visor.crear);
    expect(await screen.findByText('Imagen de referencia, no apta para diagnóstico')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('visor-paciente')).toHaveTextContent('GARCIA, CARLOS'));
    expect(screen.getByTestId('visor-detalle')).toHaveTextContent('PRUEBA-0001');
  });

  it('con varias series muestra primero la lista y no abre ninguna hasta que se elige', async () => {
    vi.spyOn(dicomweb, 'listarSeries').mockResolvedValue([serie('S1', 1, 'AXIAL'), serie('S2', 2, 'CORONAL', 60)]);
    const cargar = vi.spyOn(dicomweb, 'cargarSerie').mockResolvedValue(carga(60));
    montar(visor.crear);
    expect(await screen.findByRole('button', { name: /AXIAL/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /CORONAL/ })).toBeInTheDocument();
    expect(screen.getByText('Elige una serie de la lista para ver sus imágenes.')).toBeInTheDocument();
    expect(cargar).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /CORONAL/ }));
    await waitFor(() => expect(visor.motor.mostrarSerie).toHaveBeenCalledTimes(1));
    expect(cargar).toHaveBeenCalledWith('E1', 'S2');
    expect(screen.getByRole('button', { name: /CORONAL/ })).toHaveAttribute('aria-current', 'true');
  });

  it('con una sola serie la abre automáticamente y usa "desplazar" si tiene varias imágenes', async () => {
    vi.spyOn(dicomweb, 'listarSeries').mockResolvedValue([serie('S1', 1, 'AXIAL')]);
    vi.spyOn(dicomweb, 'cargarSerie').mockResolvedValue(carga(180));
    montar(visor.crear);
    await waitFor(() => expect(visor.motor.mostrarSerie).toHaveBeenCalledTimes(1));
    expect(visor.motor.seleccionarHerramienta).toHaveBeenCalledWith('desplazar');
    expect(screen.getByRole('button', { name: 'Desplazar serie' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('con una imagen suelta usa "ventana y nivel" como herramienta inicial', async () => {
    vi.spyOn(dicomweb, 'listarSeries').mockResolvedValue([serie('S1', 1, 'TORAX PA', 1)]);
    vi.spyOn(dicomweb, 'cargarSerie').mockResolvedValue(carga(1));
    montar(visor.crear);
    await waitFor(() => expect(visor.motor.mostrarSerie).toHaveBeenCalledTimes(1));
    expect(visor.motor.seleccionarHerramienta).toHaveBeenCalledWith('ventana');
  });

  it('muestra el indicador de carga mientras la serie se descarga y lo quita al terminar', async () => {
    vi.spyOn(dicomweb, 'listarSeries').mockResolvedValue([serie('S1', 1, 'AXIAL')]);
    let terminar!: (c: dicomweb.SerieCargada) => void;
    vi.spyOn(dicomweb, 'cargarSerie').mockReturnValue(new Promise((r) => { terminar = r; }));
    montar(visor.crear);
    expect(await screen.findByText('Cargando imágenes…')).toBeInTheDocument();
    await act(async () => terminar(carga(3)));
    await waitFor(() => expect(screen.queryByText('Cargando imágenes…')).not.toBeInTheDocument());
  });

  it('muestra el número de imagen, el zoom y la ventana/nivel que informa el visor', async () => {
    vi.spyOn(dicomweb, 'listarSeries').mockResolvedValue([serie('S1', 1, 'AXIAL')]);
    vi.spyOn(dicomweb, 'cargarSerie').mockResolvedValue(carga(180));
    montar(visor.crear);
    await waitFor(() => expect(visor.motor.mostrarSerie).toHaveBeenCalled());
    act(() => visor.opciones().alCambiar({ ...estadoBase, indice: 41, zoom: 1.5 }));
    expect(await screen.findByTestId('visor-indice')).toHaveTextContent('Imagen 42 / 180');
    expect(screen.getByTestId('visor-zoom')).toHaveTextContent('Zoom 150%');
    expect(screen.getByTestId('visor-wl')).toHaveTextContent('W 1500 · L -600');
    expect(screen.getByLabelText('Ventana')).toHaveValue('1500');
    expect(screen.getByLabelText('Nivel')).toHaveValue('-600');
  });

  it('cambiar la herramienta se lo pide al visor y marca el botón activo', async () => {
    vi.spyOn(dicomweb, 'listarSeries').mockResolvedValue([serie('S1', 1, 'AXIAL')]);
    vi.spyOn(dicomweb, 'cargarSerie').mockResolvedValue(carga(180));
    montar(visor.crear);
    await waitFor(() => expect(visor.motor.mostrarSerie).toHaveBeenCalled());
    act(() => visor.opciones().alCambiar(estadoBase));
    await userEvent.click(screen.getByRole('button', { name: 'Medir distancia' }));
    expect(visor.motor.seleccionarHerramienta).toHaveBeenLastCalledWith('linea');
    expect(screen.getByRole('button', { name: 'Medir distancia' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Desplazar serie' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('los botones de rotar, voltear, invertir, borrar y restablecer actúan sobre el visor', async () => {
    vi.spyOn(dicomweb, 'listarSeries').mockResolvedValue([serie('S1', 1, 'AXIAL')]);
    vi.spyOn(dicomweb, 'cargarSerie').mockResolvedValue(carga(180));
    montar(visor.crear);
    await waitFor(() => expect(visor.motor.mostrarSerie).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Restablecer' })).toBeEnabled());
    visor.motor.restablecer.mockClear();

    await userEvent.click(screen.getByRole('button', { name: 'Rotar a la izquierda' }));
    await userEvent.click(screen.getByRole('button', { name: 'Rotar a la derecha' }));
    await userEvent.click(screen.getByRole('button', { name: 'Voltear horizontal' }));
    await userEvent.click(screen.getByRole('button', { name: 'Voltear vertical' }));
    await userEvent.click(screen.getByRole('button', { name: 'Invertir colores' }));
    await userEvent.click(screen.getByRole('button', { name: 'Borrar mediciones' }));
    await userEvent.click(screen.getByRole('button', { name: 'Restablecer' }));

    expect(visor.motor.rotar).toHaveBeenNthCalledWith(1, -90);
    expect(visor.motor.rotar).toHaveBeenNthCalledWith(2, 90);
    expect(visor.motor.voltear).toHaveBeenNthCalledWith(1, 'horizontal');
    expect(visor.motor.voltear).toHaveBeenNthCalledWith(2, 'vertical');
    expect(visor.motor.invertir).toHaveBeenCalledTimes(1);
    expect(visor.motor.borrarMediciones).toHaveBeenCalledTimes(1);
    expect(visor.motor.restablecer).toHaveBeenCalledTimes(1);
  });

  it('las herramientas están desactivadas mientras no hay una serie abierta', async () => {
    vi.spyOn(dicomweb, 'listarSeries').mockResolvedValue([serie('S1', 1, 'AXIAL'), serie('S2', 2, 'CORONAL')]);
    montar(visor.crear);
    await screen.findByRole('button', { name: /AXIAL/ });
    expect(screen.getByRole('button', { name: 'Restablecer' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Zoom' })).toBeDisabled();
    expect(screen.getByLabelText('Ventana')).toBeDisabled();
  });

  it('al escribir ventana y nivel válidos los aplica; con una ventana no positiva avisa y no aplica', async () => {
    vi.spyOn(dicomweb, 'listarSeries').mockResolvedValue([serie('S1', 1, 'AXIAL')]);
    vi.spyOn(dicomweb, 'cargarSerie').mockResolvedValue(carga(180));
    montar(visor.crear);
    await waitFor(() => expect(visor.motor.mostrarSerie).toHaveBeenCalled());
    act(() => visor.opciones().alCambiar(estadoBase));
    const ventana = await screen.findByLabelText('Ventana');
    await waitFor(() => expect(ventana).toBeEnabled());

    await userEvent.clear(ventana);
    await userEvent.type(ventana, '350');
    expect(visor.motor.aplicarVentana).toHaveBeenLastCalledWith(350, -600);

    visor.motor.aplicarVentana.mockClear();
    await userEvent.clear(ventana);
    await userEvent.type(ventana, '0');
    expect(visor.motor.aplicarVentana).not.toHaveBeenCalled();
    expect(screen.getByText('La ventana debe ser mayor que 0.')).toBeInTheDocument();
  });

  it('mientras se escribe, el visor no pisa lo tecleado; al salir del campo vuelve a seguirlo', async () => {
    vi.spyOn(dicomweb, 'listarSeries').mockResolvedValue([serie('S1', 1, 'AXIAL')]);
    vi.spyOn(dicomweb, 'cargarSerie').mockResolvedValue(carga(180));
    montar(visor.crear);
    await waitFor(() => expect(visor.motor.mostrarSerie).toHaveBeenCalled());
    act(() => visor.opciones().alCambiar(estadoBase));
    const ventana = await screen.findByLabelText('Ventana');
    await waitFor(() => expect(ventana).toBeEnabled());
    await userEvent.click(ventana);
    await userEvent.clear(ventana);
    await userEvent.type(ventana, '9');
    act(() => visor.opciones().alCambiar({ ...estadoBase, ventana: 777 }));
    expect(ventana).toHaveValue('9');
    act(() => ventana.blur()); // suelta el foco sin pasar al campo "Nivel"
    await waitFor(() => expect(ventana).toHaveValue('777'));
  });

  it('un 403 al pedir las series muestra el mensaje de permiso y ninguna serie', async () => {
    vi.spyOn(dicomweb, 'listarSeries').mockRejectedValue(errorHttp(403));
    montar(visor.crear);
    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permiso para ver este estudio.');
    expect(screen.queryByRole('button', { name: /AXIAL/ })).not.toBeInTheDocument();
  });

  it('si el encabezado del estudio falla, el visor sigue funcionando', async () => {
    vi.spyOn(estudios, 'obtenerEstudio').mockRejectedValue(errorHttp(502));
    vi.spyOn(dicomweb, 'listarSeries').mockResolvedValue([serie('S1', 1, 'AXIAL')]);
    vi.spyOn(dicomweb, 'cargarSerie').mockResolvedValue(carga(2));
    montar(visor.crear);
    await waitFor(() => expect(visor.motor.mostrarSerie).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('un error al cargar la serie se muestra y quita el indicador de carga', async () => {
    vi.spyOn(dicomweb, 'listarSeries').mockResolvedValue([serie('S1', 1, 'AXIAL')]);
    vi.spyOn(dicomweb, 'cargarSerie').mockRejectedValue(errorHttp(502));
    montar(visor.crear);
    expect(await screen.findByRole('alert')).toHaveTextContent('El servidor de imágenes no está disponible');
    expect(screen.queryByText('Cargando imágenes…')).not.toBeInTheDocument();
    expect(visor.motor.mostrarSerie).not.toHaveBeenCalled();
  });

  it('una serie sin imágenes avisa en vez de quedarse cargando', async () => {
    vi.spyOn(dicomweb, 'listarSeries').mockResolvedValue([serie('S1', 1, 'VACIA', 0)]);
    vi.spyOn(dicomweb, 'cargarSerie').mockResolvedValue(carga(0));
    montar(visor.crear);
    expect(await screen.findByRole('alert')).toHaveTextContent('La serie no tiene imágenes.');
    expect(visor.motor.mostrarSerie).not.toHaveBeenCalled();
  });

  it('si el visor no puede iniciar (sin WebGL) lo explica', async () => {
    vi.spyOn(dicomweb, 'listarSeries').mockResolvedValue([serie('S1', 1, 'AXIAL')]);
    const falla: CrearMotor = vi.fn().mockRejectedValue(new Error('webgl'));
    montar(falla);
    expect(await screen.findByRole('alert')).toHaveTextContent('aceleración por hardware');
  });

  it('un error que informa el visor (imagen que no cargó) se muestra', async () => {
    vi.spyOn(dicomweb, 'listarSeries').mockResolvedValue([serie('S1', 1, 'AXIAL')]);
    vi.spyOn(dicomweb, 'cargarSerie').mockResolvedValue(carga(180));
    montar(visor.crear);
    await waitFor(() => expect(visor.motor.mostrarSerie).toHaveBeenCalled());
    act(() => visor.opciones().alError('No se pudo cargar una imagen de la serie.'));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar una imagen de la serie.');
  });

  it('si se elige otra serie mientras la anterior carga, solo se muestra la última', async () => {
    vi.spyOn(dicomweb, 'listarSeries').mockResolvedValue([serie('S1', 1, 'AXIAL'), serie('S2', 2, 'CORONAL')]);
    let terminarPrimera!: (c: dicomweb.SerieCargada) => void;
    const cargar = vi
      .spyOn(dicomweb, 'cargarSerie')
      .mockImplementationOnce(() => new Promise((r) => { terminarPrimera = r; }))
      .mockResolvedValueOnce(carga(5));
    montar(visor.crear);
    await userEvent.click(await screen.findByRole('button', { name: /AXIAL/ }));
    await userEvent.click(screen.getByRole('button', { name: /CORONAL/ }));
    await waitFor(() => expect(visor.motor.mostrarSerie).toHaveBeenCalledTimes(1));
    await act(async () => terminarPrimera(carga(180))); // llega tarde: debe ignorarse
    expect(cargar).toHaveBeenCalledTimes(2);
    expect(visor.motor.mostrarSerie).toHaveBeenCalledTimes(1);
    expect(visor.motor.mostrarSerie.mock.calls[0]![0].imageIds).toHaveLength(5);
  });

  it('el botón Volver regresa a la lista de estudios', async () => {
    vi.spyOn(dicomweb, 'listarSeries').mockResolvedValue([serie('S1', 1, 'AXIAL'), serie('S2', 2, 'B')]);
    montar(visor.crear);
    await userEvent.click(await screen.findByRole('button', { name: 'Volver a estudios' }));
    expect(await screen.findByText('lista de estudios')).toBeInTheDocument();
  });

  it('al salir de la pantalla destruye el visor (libera la memoria de las imágenes)', async () => {
    vi.spyOn(dicomweb, 'listarSeries').mockResolvedValue([serie('S1', 1, 'AXIAL'), serie('S2', 2, 'B')]);
    const { unmount } = montar(visor.crear);
    await screen.findByRole('button', { name: /AXIAL/ });
    await waitFor(() => expect(visor.crear).toHaveBeenCalled());
    await act(async () => Promise.resolve());
    unmount();
    expect(visor.motor.destruir).toHaveBeenCalledTimes(1);
  });

  it('si la pantalla se cierra mientras el visor arranca, lo destruye apenas termina de arrancar', async () => {
    vi.spyOn(dicomweb, 'listarSeries').mockResolvedValue([serie('S1', 1, 'AXIAL')]);
    let listo!: (m: MotorVisor) => void;
    const lento: CrearMotor = vi.fn(() => new Promise<MotorVisor>((r) => { listo = r; }));
    const { unmount } = montar(lento);
    await waitFor(() => expect(lento).toHaveBeenCalled());
    unmount();
    await act(async () => listo(visor.motor));
    expect(visor.motor.destruir).toHaveBeenCalledTimes(1);
  });
});

describe('ViewerPage en modo consulta (paciente)', () => {
  let visor: Visor;

  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({ rol: 'PACIENTE' });
    visor = visorSimulado();
    vi.spyOn(estudios, 'obtenerEstudio').mockResolvedValue(estudio);
  });

  it('el paciente solo ve desplazar, zoom, mover y restablecer', async () => {
    vi.spyOn(dicomweb, 'listarSeries').mockResolvedValue([serie('S1', 1, 'AXIAL')]);
    vi.spyOn(dicomweb, 'cargarSerie').mockResolvedValue(carga(180));
    montar(visor.crear);
    await waitFor(() => expect(visor.motor.mostrarSerie).toHaveBeenCalledTimes(1));

    for (const nombre of ['Desplazar serie', 'Zoom', 'Mover imagen', 'Restablecer']) {
      expect(screen.getByRole('button', { name: nombre })).toBeInTheDocument();
    }
    for (const nombre of [
      'Ventana y nivel', 'Medir distancia', 'Medir ángulo', 'Rotar a la izquierda', 'Rotar a la derecha',
      'Voltear horizontal', 'Voltear vertical', 'Invertir colores', 'Borrar mediciones',
    ]) {
      expect(screen.queryByRole('button', { name: nombre })).not.toBeInTheDocument();
    }
    expect(screen.queryByLabelText('Ventana')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Nivel')).not.toBeInTheDocument();
  });

  it('con una imagen suelta el paciente empieza en "zoom", nunca en "ventana y nivel"', async () => {
    vi.spyOn(dicomweb, 'listarSeries').mockResolvedValue([serie('S1', 1, 'TORAX PA', 1)]);
    vi.spyOn(dicomweb, 'cargarSerie').mockResolvedValue(carga(1));
    montar(visor.crear);
    await waitFor(() => expect(visor.motor.mostrarSerie).toHaveBeenCalledTimes(1));
    expect(visor.motor.seleccionarHerramienta).toHaveBeenCalledWith('zoom');
    expect(visor.motor.seleccionarHerramienta).not.toHaveBeenCalledWith('ventana');
    expect(screen.getByRole('button', { name: 'Zoom' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('sin rol en la sesión el visor queda en modo consulta (falla cerrado)', async () => {
    useAuthStore.setState({ rol: null });
    vi.spyOn(dicomweb, 'listarSeries').mockResolvedValue([serie('S1', 1, 'AXIAL')]);
    vi.spyOn(dicomweb, 'cargarSerie').mockResolvedValue(carga(2));
    montar(visor.crear);
    await waitFor(() => expect(visor.motor.mostrarSerie).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: 'Medir distancia' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Ventana')).not.toBeInTheDocument();
  });
});
