import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, type AxiosResponse } from 'axios';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OlvideClavePage } from './OlvideClavePage';
import * as auth from '../../services/auth.service';

function montar() {
  render(
    <MemoryRouter initialEntries={['/olvide-clave']}>
      <Routes>
        <Route path="/olvide-clave" element={<OlvideClavePage />} />
        <Route path="/login" element={<div>pantalla login</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function errorHttp(status: number) {
  return new AxiosError('x', 'ERR', undefined, undefined, { status } as AxiosResponse);
}

describe('OlvideClavePage (RF-09, paso 1)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('envía el correo y muestra el mensaje genérico del servidor', async () => {
    const pedir = vi.spyOn(auth, 'solicitarRecuperacion').mockResolvedValue('Si el correo está registrado, te enviaremos las instrucciones.');
    montar();
    await userEvent.type(screen.getByLabelText('Correo'), 'ana@clinica.pe');
    await userEvent.click(screen.getByRole('button', { name: /Enviar enlace/ }));
    expect(pedir).toHaveBeenCalledWith('ana@clinica.pe');
    expect(await screen.findByRole('status')).toHaveTextContent('Si el correo está registrado');
    expect(screen.queryByLabelText('Correo')).not.toBeInTheDocument();
  });

  it('un correo que no existe muestra EXACTAMENTE la misma pantalla (el servidor responde igual)', async () => {
    const texto = 'Si el correo está registrado, te enviaremos las instrucciones.';
    vi.spyOn(auth, 'solicitarRecuperacion').mockResolvedValue(texto);
    montar();
    await userEvent.type(screen.getByLabelText('Correo'), 'nadie@correo.pe');
    await userEvent.click(screen.getByRole('button', { name: /Enviar enlace/ }));
    expect(await screen.findByRole('status')).toHaveTextContent(texto);
  });

  it('sin correo pide escribirlo y no llama al servidor', async () => {
    const pedir = vi.spyOn(auth, 'solicitarRecuperacion').mockResolvedValue('x');
    montar();
    await userEvent.click(screen.getByRole('button', { name: /Enviar enlace/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe el correo de tu cuenta.');
    expect(pedir).not.toHaveBeenCalled();
  });

  it('con demasiadas solicitudes (429) lo explica y deja reintentar', async () => {
    vi.spyOn(auth, 'solicitarRecuperacion').mockRejectedValue(
      new AxiosError('x', 'ERR', undefined, undefined, { status: 429, headers: { 'retry-after': '120' } } as unknown as AxiosResponse),
    );
    montar();
    await userEvent.type(screen.getByLabelText('Correo'), 'ana@clinica.pe');
    await userEvent.click(screen.getByRole('button', { name: /Enviar enlace/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Demasiados intentos.*120 segundos/);
    expect(screen.getByRole('button', { name: /Enviar enlace/ })).toBeEnabled();
  });

  it('si la función está desactivada en el servidor (404) lo dice', async () => {
    vi.spyOn(auth, 'solicitarRecuperacion').mockRejectedValue(errorHttp(404));
    montar();
    await userEvent.type(screen.getByLabelText('Correo'), 'ana@clinica.pe');
    await userEvent.click(screen.getByRole('button', { name: /Enviar enlace/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La recuperación de clave no está disponible');
  });

  it('un fallo de red se muestra como error de conexión', async () => {
    vi.spyOn(auth, 'solicitarRecuperacion').mockRejectedValue(new AxiosError('net', 'ERR_NETWORK'));
    montar();
    await userEvent.type(screen.getByLabelText('Correo'), 'ana@clinica.pe');
    await userEvent.click(screen.getByRole('button', { name: /Enviar enlace/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor');
  });

  it('avisa que los administradores no usan este medio y permite volver al login', async () => {
    montar();
    expect(screen.getByText(/Los administradores no usan este medio/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: /Volver al inicio de sesión/ }));
    expect(await screen.findByText('pantalla login')).toBeInTheDocument();
  });
});
