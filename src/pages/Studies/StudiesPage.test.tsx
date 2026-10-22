import { AxiosError, type AxiosResponse } from 'axios';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StudiesPage } from './StudiesPage';
import * as estudios from '../../services/studies.service';
import * as auth from '../../services/auth.service';
import { useAuthStore } from '../../store/auth.store';
import type { Study } from '../../services/studies.mapper';

const hoy = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

const base: Study = {
  uid: '1.1', patientId: 'PRUEBA-0001', patientName: 'GARCIA, CARLOS', ageSex: '45M',
  modalities: ['DX'], studyDate: `${hoy} 10:00`, description: 'RADIOGRAFIA DE TORAX', instances: 2,
};
const tomo: Study = {
  ...base, uid: '2.2', patientId: 'PRUEBA-0002', patientName: 'MENDOZA, ANA', ageSex: '32F',
  modalities: ['CT'], studyDate: '2025-01-01 09:00', description: 'TOMOGRAFIA DE CRANEO', instances: 180,
};

function errorHttp(status: number): AxiosError {
  return new AxiosError('x', 'ERR', undefined, undefined, { status } as AxiosResponse);
}

function montar() {
  render(
    <MemoryRouter initialEntries={['/studies']}>
      <Routes>
        <Route path="/studies" element={<StudiesPage />} />
        <Route path="/viewer/:studyId" element={<div>visor del estudio</div>} />
        <Route path="/login" element={<div>pantalla login</div>} />
        <Route path="/cambiar-clave" element={<div>pantalla cambiar clave</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('StudiesPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().setSession('t', 900, 'MEDICO', 'Ana Pérez');
  });

  it('muestra los estudios reales, el nombre y el rol del usuario', async () => {
    vi.spyOn(estudios, 'listarEstudios').mockResolvedValue([base, tomo]);
    montar();
    expect(await screen.findByText('GARCIA, CARLOS')).toBeInTheDocument();
    expect(screen.getByText('MENDOZA, ANA')).toBeInTheDocument();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('Médico')).toBeInTheDocument();
    expect(screen.getByText('PACS WORKLIST')).toBeInTheDocument();
    // ya no hay datos inventados
    expect(screen.queryByText(/Manuel Sernaque/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Urgente/)).not.toBeInTheDocument();
  });

  it('calcula las tarjetas con los estudios cargados', async () => {
    vi.spyOn(estudios, 'listarEstudios').mockResolvedValue([base, tomo]);
    montar();
    await screen.findByText('GARCIA, CARLOS');
    expect(screen.getByTestId('stat-total')).toHaveTextContent('2');
    expect(screen.getByTestId('stat-hoy')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-imagenes')).toHaveTextContent('182');
  });

  it('para un paciente muestra "Mis estudios" y su rol', async () => {
    useAuthStore.getState().setSession('t', 900, 'PACIENTE', 'Juan Díaz');
    vi.spyOn(estudios, 'listarEstudios').mockResolvedValue([base]);
    montar();
    expect(await screen.findByText('MIS ESTUDIOS')).toBeInTheDocument();
    expect(screen.getByText('Paciente')).toBeInTheDocument();
  });

  it('muestra "Cargando" mientras espera y luego el estado vacío', async () => {
    let resolver!: (v: Study[]) => void;
    vi.spyOn(estudios, 'listarEstudios').mockReturnValue(new Promise((r) => { resolver = r; }));
    montar();
    expect(screen.getByText(/Cargando estudios/)).toBeInTheDocument();
    resolver([]);
    expect(await screen.findByText('No hay estudios disponibles.')).toBeInTheDocument();
  });

  it.each([
    [403, 'No tienes permiso para ver este estudio.'],
    [502, 'El servidor de imágenes no está disponible. Intenta nuevamente en unos minutos.'],
  ])('ante un error %i muestra el mensaje y ninguna fila', async (estado, mensaje) => {
    vi.spyOn(estudios, 'listarEstudios').mockRejectedValue(errorHttp(estado));
    montar();
    expect(await screen.findByRole('alert')).toHaveTextContent(mensaje);
    expect(screen.queryByText('GARCIA, CARLOS')).not.toBeInTheDocument();
  });

  it('el botón recargar vuelve a pedir los estudios', async () => {
    const listar = vi.spyOn(estudios, 'listarEstudios').mockResolvedValue([base]);
    montar();
    await screen.findByText('GARCIA, CARLOS');
    await userEvent.click(screen.getByRole('button', { name: 'Recargar estudios' }));
    await waitFor(() => expect(listar).toHaveBeenCalledTimes(2));
  });

  it('filtra por texto y por modalidad (las modalidades salen de los datos)', async () => {
    vi.spyOn(estudios, 'listarEstudios').mockResolvedValue([base, tomo]);
    montar();
    await screen.findByText('GARCIA, CARLOS');
    expect(screen.getByRole('button', { name: 'CT' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'MR' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'CT' }));
    expect(screen.queryByText('GARCIA, CARLOS')).not.toBeInTheDocument();
    expect(screen.getByText('MENDOZA, ANA')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'TODAS' }));
    await userEvent.type(screen.getByPlaceholderText(/Buscar/), 'torax');
    expect(screen.getByText('GARCIA, CARLOS')).toBeInTheDocument();
    expect(screen.queryByText('MENDOZA, ANA')).not.toBeInTheDocument();

    await userEvent.clear(screen.getByPlaceholderText(/Buscar/));
    await userEvent.type(screen.getByPlaceholderText(/Buscar/), 'no existe');
    expect(screen.getByText('Ningún estudio coincide con la búsqueda.')).toBeInTheDocument();
  });

  it('filtra por fecha o rango de fechas y lo combina con el texto (CA05.2)', async () => {
    vi.spyOn(estudios, 'listarEstudios').mockResolvedValue([base, tomo]);
    montar();
    await screen.findByText('GARCIA, CARLOS');

    fireEvent.change(screen.getByLabelText('Fecha desde'), { target: { value: '2025-01-01' } });
    fireEvent.change(screen.getByLabelText('Fecha hasta'), { target: { value: '2025-01-01' } });
    expect(screen.queryByText('GARCIA, CARLOS')).not.toBeInTheDocument();
    expect(screen.getByText('MENDOZA, ANA')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Fecha desde'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Fecha hasta'), { target: { value: '' } });
    expect(screen.getByText('GARCIA, CARLOS')).toBeInTheDocument();
    expect(screen.queryByText('MENDOZA, ANA')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Fecha desde'), { target: { value: '2030-01-01' } });
    expect(screen.getByText('Ningún estudio coincide con la búsqueda.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Quitar fechas' }));
    expect(screen.getByText('GARCIA, CARLOS')).toBeInTheDocument();
    expect(screen.getByText('MENDOZA, ANA')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quitar fechas' })).not.toBeInTheDocument();
  });

  it('abre el visor con el UID del estudio', async () => {
    vi.spyOn(estudios, 'listarEstudios').mockResolvedValue([base]);
    montar();
    const fila = (await screen.findByText('GARCIA, CARLOS')).closest('tr')!;
    await userEvent.click(within(fila).getByRole('button', { name: /Ver DICOM/ }));
    expect(await screen.findByText('visor del estudio')).toBeInTheDocument();
  });

  it('cerrar sesión limpia la sesión y vuelve al login', async () => {
    vi.spyOn(estudios, 'listarEstudios').mockResolvedValue([base]);
    vi.spyOn(auth, 'logout').mockImplementation(async () => useAuthStore.getState().clear());
    montar();
    await screen.findByText('GARCIA, CARLOS');
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByText('pantalla login')).toBeInTheDocument();
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('ofrece cambiar la clave desde el encabezado', async () => {
    vi.spyOn(estudios, 'listarEstudios').mockResolvedValue([base]);
    montar();
    await screen.findByText('GARCIA, CARLOS');
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar clave' }));
    expect(await screen.findByText('pantalla cambiar clave')).toBeInTheDocument();
  });
});
