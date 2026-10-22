import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, type AxiosResponse } from 'axios';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';
import * as auth from '../../services/auth.service';
import { useAuthStore } from '../../store/auth.store';

function montar() {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/studies" element={<div>lista de estudios</div>} />
        <Route path="/admin" element={<div>panel admin</div>} />
        <Route path="/cambiar-clave" element={<div>pantalla cambiar clave</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function rellenarYEnviar(usuario: string, clave: string) {
  await userEvent.type(screen.getByPlaceholderText('Ingresa tu usuario'), usuario);
  await userEvent.type(screen.getByPlaceholderText('••••••••'), clave);
  await userEvent.click(screen.getByRole('button', { name: /Iniciar sesión/ }));
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().clear();
    sessionStorage.clear();
  });

  it('un login correcto lleva a la lista de estudios', async () => {
    const login = vi.spyOn(auth, 'login').mockResolvedValue();
    montar();
    await rellenarYEnviar('ana.perez', 'clave-larga-123');
    expect(login).toHaveBeenCalledWith({ username: 'ana.perez', password: 'clave-larga-123' });
    expect(await screen.findByText('lista de estudios')).toBeInTheDocument();
  });

  it('muestra el mensaje del backend si las credenciales fallan', async () => {
    vi.spyOn(auth, 'login').mockRejectedValue(
      new AxiosError('x', 'ERR', undefined, undefined, { status: 401 } as AxiosResponse),
    );
    montar();
    await rellenarYEnviar('ana.perez', 'mala');
    expect(await screen.findByText('Usuario o contraseña incorrectos.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Usuario o contraseña incorrectos.'); // lo anuncian los lectores de pantalla
    expect(screen.queryByText('lista de estudios')).not.toBeInTheDocument();
  });

  it('muestra el aviso de cuenta bloqueada (423)', async () => {
    vi.spyOn(auth, 'login').mockRejectedValue(
      new AxiosError('x', 'ERR', undefined, undefined, { status: 423 } as AxiosResponse),
    );
    montar();
    await rellenarYEnviar('ana.perez', 'mala');
    expect(await screen.findByText(/bloqueada temporalmente/)).toBeInTheDocument();
  });

  it('una cuenta con rol no soportado no entra', async () => {
    vi.spyOn(auth, 'login').mockRejectedValue(new auth.RolNoSoportadoError());
    montar();
    await rellenarYEnviar('root', 'clave-larga-123');
    expect(await screen.findByText('Tu cuenta no tiene acceso a esta aplicación.')).toBeInTheDocument();
  });

  it('no ofrece "Recordarme" ni, con la recuperación apagada, "¿Olvidaste tu contraseña?"', () => {
    // Se fija el valor apagado a propósito: un .env local con VITE_RECUPERACION_HABILITADA=true no debe afectar la prueba.
    vi.stubEnv('VITE_RECUPERACION_HABILITADA', 'false');
    try {
      montar();
      expect(screen.queryByText('Recordarme')).not.toBeInTheDocument();
      expect(screen.queryByText(/Olvidaste/)).not.toBeInTheDocument();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('con la recuperación activada (VITE_RECUPERACION_HABILITADA=true) muestra el enlace y lleva a la pantalla', async () => {
    vi.stubEnv('VITE_RECUPERACION_HABILITADA', 'true');
    try {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/olvide-clave" element={<div>pantalla olvide</div>} />
          </Routes>
        </MemoryRouter>,
      );
      await userEvent.click(screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' }));
      expect(await screen.findByText('pantalla olvide')).toBeInTheDocument();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('con la recuperación apagada (valor por defecto) no hay enlace', () => {
    vi.stubEnv('VITE_RECUPERACION_HABILITADA', 'false');
    try {
      montar();
      expect(screen.queryByRole('link', { name: /Olvidaste/ })).not.toBeInTheDocument();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('un administrador entra directo al panel de administración', async () => {
    vi.spyOn(auth, 'login').mockImplementation(async () => {
      useAuthStore.getState().setSession('t', 900, 'ADMIN', 'Luz Rojas');
    });
    montar();
    await rellenarYEnviar('admin.demo', 'clave-larga-123');
    expect(await screen.findByText('panel admin')).toBeInTheDocument();
  });

  it('un médico entra a la lista de estudios', async () => {
    vi.spyOn(auth, 'login').mockImplementation(async () => {
      useAuthStore.getState().setSession('t', 900, 'MEDICO', 'Ana');
    });
    montar();
    await rellenarYEnviar('ana.perez', 'clave-larga-123');
    expect(await screen.findByText('lista de estudios')).toBeInTheDocument();
  });

  it('con una clave temporal lo lleva primero a cambiarla, sea cual sea su rol', async () => {
    vi.spyOn(auth, 'login').mockImplementation(async () => {
      useAuthStore.getState().setSession('t', 900, 'ADMIN', 'Luz', true);
    });
    montar();
    await rellenarYEnviar('admin.demo', 'Temporal23456789');
    expect(await screen.findByText('pantalla cambiar clave')).toBeInTheDocument();
  });

  it('muestra por qué volvió al login cuando la sesión terminó (una sola vez)', () => {
    sessionStorage.setItem('pacs_motivo_salida', 'sesion');
    montar();
    expect(screen.getByRole('status')).toHaveTextContent('Tu sesión terminó. Inicia sesión nuevamente.');
    expect(sessionStorage.getItem('pacs_motivo_salida')).toBeNull();
  });

  it('muestra el aviso de inactividad', () => {
    sessionStorage.setItem('pacs_motivo_salida', 'inactividad');
    montar();
    expect(screen.getByRole('status')).toHaveTextContent(/cerró por inactividad/);
  });

  it('sin motivo de salida no hay aviso', () => {
    montar();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('el aviso de sesión terminada cede su lugar a un error de credenciales', async () => {
    sessionStorage.setItem('pacs_motivo_salida', 'sesion');
    vi.spyOn(auth, 'login').mockRejectedValue(
      new AxiosError('x', 'ERR', undefined, undefined, { status: 401 } as AxiosResponse),
    );
    montar();
    await rellenarYEnviar('ana.perez', 'mala');
    expect(await screen.findByText('Usuario o contraseña incorrectos.')).toBeInTheDocument();
    expect(screen.queryByText(/Tu sesión terminó/)).not.toBeInTheDocument();
  });

  it('con demasiados intentos (429) lo explica', async () => {
    vi.spyOn(auth, 'login').mockRejectedValue(
      new AxiosError('x', 'ERR', undefined, undefined, { status: 429, headers: { 'retry-after': '30' } } as unknown as AxiosResponse),
    );
    montar();
    await rellenarYEnviar('ana.perez', 'mala');
    expect(await screen.findByText(/Demasiados intentos.*30 segundos/)).toBeInTheDocument();
  });
});
