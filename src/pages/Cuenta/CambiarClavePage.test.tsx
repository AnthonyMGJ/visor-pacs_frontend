import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, type AxiosResponse } from 'axios';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CambiarClavePage, validarClaveNueva } from './CambiarClavePage';
import * as auth from '../../services/auth.service';
import { useAuthStore } from '../../store/auth.store';

function montar() {
  render(
    <MemoryRouter initialEntries={['/cambiar-clave']}>
      <Routes>
        <Route path="/cambiar-clave" element={<CambiarClavePage />} />
        <Route path="/studies" element={<div>lista de estudios</div>} />
        <Route path="/admin" element={<div>panel admin</div>} />
        <Route path="/login" element={<div>pantalla login</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function llenar(actual: string, nueva: string, repetida: string) {
  if (actual) await userEvent.type(screen.getByLabelText(/Clave actual|Clave temporal/), actual);
  if (nueva) await userEvent.type(screen.getByLabelText('Clave nueva'), nueva);
  if (repetida) await userEvent.type(screen.getByLabelText('Repite la clave nueva'), repetida);
  await userEvent.click(screen.getByRole('button', { name: /Guardar clave nueva/ }));
}

function errorHttp(status: number, detail?: string) {
  return new AxiosError('x', 'ERR', undefined, undefined, { status, data: detail ? { detail } : null } as AxiosResponse);
}

describe('validarClaveNueva', () => {
  it('aplica las mismas reglas que el backend', () => {
    expect(validarClaveNueva('', 'una-clave-larga-1', 'una-clave-larga-1')).toMatch(/clave actual/);
    expect(validarClaveNueva('actual-123456', 'corta', 'corta')).toMatch(/al menos 12/);
    expect(validarClaveNueva('misma-clave-123', 'misma-clave-123', 'misma-clave-123')).toMatch(/distinta/);
    expect(validarClaveNueva('actual-123456', 'una-clave-larga-1', 'otra-cosa-larga-1')).toMatch(/no coincide/);
    expect(validarClaveNueva('actual-123456', 'una-clave-larga-1', 'una-clave-larga-1')).toBeNull();
  });
});

describe('CambiarClavePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().setSession('t', 900, 'MEDICO', 'Ana');
  });

  it('no llama al servidor si el formulario no cumple las reglas', async () => {
    const cambiar = vi.spyOn(auth, 'cambiarClave').mockResolvedValue();
    montar();
    await llenar('actual-123456', 'corta', 'corta');
    expect(await screen.findByRole('alert')).toHaveTextContent(/al menos 12/);
    expect(cambiar).not.toHaveBeenCalled();
  });

  it('avisa si la confirmación no coincide', async () => {
    vi.spyOn(auth, 'cambiarClave').mockResolvedValue();
    montar();
    await llenar('actual-123456', 'una-clave-larga-1', 'una-clave-larga-2');
    expect(await screen.findByRole('alert')).toHaveTextContent(/no coincide/);
  });

  it('un médico que cambia su clave vuelve a sus estudios', async () => {
    const cambiar = vi.spyOn(auth, 'cambiarClave').mockResolvedValue();
    montar();
    await llenar('actual-123456', 'una-clave-larga-1', 'una-clave-larga-1');
    expect(cambiar).toHaveBeenCalledWith('actual-123456', 'una-clave-larga-1');
    expect(await screen.findByText('lista de estudios')).toBeInTheDocument();
  });

  it('un administrador que cambia su clave vuelve al panel', async () => {
    useAuthStore.getState().setSession('t', 900, 'ADMIN', 'Luz');
    vi.spyOn(auth, 'cambiarClave').mockResolvedValue();
    montar();
    await llenar('actual-123456', 'una-clave-larga-1', 'una-clave-larga-1');
    expect(await screen.findByText('panel admin')).toBeInTheDocument();
  });

  it('muestra el motivo que da el servidor si la clave actual es incorrecta', async () => {
    vi.spyOn(auth, 'cambiarClave').mockRejectedValue(errorHttp(400, 'La clave actual no es correcta.'));
    montar();
    await llenar('mala-clave-123', 'una-clave-larga-1', 'una-clave-larga-1');
    expect(await screen.findByText('La clave actual no es correcta.')).toBeInTheDocument();
    expect(screen.queryByText('lista de estudios')).not.toBeInTheDocument();
  });

  it('con la cuenta bloqueada (423) lo dice', async () => {
    vi.spyOn(auth, 'cambiarClave').mockRejectedValue(errorHttp(423));
    montar();
    await llenar('mala-clave-123', 'una-clave-larga-1', 'una-clave-larga-1');
    expect(await screen.findByText(/bloqueada temporalmente/)).toBeInTheDocument();
  });

  it('en modo normal ofrece volver y no obliga a nada', async () => {
    montar();
    expect(screen.queryByText(/Tu clave es temporal/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Volver/ }));
    expect(await screen.findByText('lista de estudios')).toBeInTheDocument();
  });

  it('con clave temporal lo explica, pide la clave temporal y solo deja cerrar sesión', async () => {
    useAuthStore.getState().setSession('t', 900, 'MEDICO', 'Ana', true);
    vi.spyOn(auth, 'logout').mockResolvedValue();
    montar();
    expect(screen.getByText(/Tu clave es temporal/)).toBeInTheDocument();
    expect(screen.getByLabelText('Clave temporal')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Volver/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Cerrar sesión/ }));
    expect(await screen.findByText('pantalla login')).toBeInTheDocument();
  });
});
