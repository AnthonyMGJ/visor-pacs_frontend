import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, type AxiosResponse } from 'axios';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NuevaClavePage, tokenDelFragmento, validarClaves } from './NuevaClavePage';
import * as auth from '../../services/auth.service';

const CLAVE = 'ClaveNueva-67890';

function Ubicacion() {
  const l = useLocation();
  return <div data-testid="ubicacion">{l.pathname + l.search + l.hash}</div>;
}

function montar(ruta = '/nueva-clave#token=abc_DEF-123') {
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/nueva-clave" element={<><NuevaClavePage /><Ubicacion /></>} />
        <Route path="/olvide-clave" element={<div>pantalla olvide</div>} />
        <Route path="/login" element={<div>pantalla login</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function llenar(nueva: string, repetida: string) {
  if (nueva) await userEvent.type(screen.getByLabelText('Clave nueva'), nueva);
  if (repetida) await userEvent.type(screen.getByLabelText('Repite la clave nueva'), repetida);
  await userEvent.click(screen.getByRole('button', { name: /Guardar clave nueva/ }));
}

function problema(status: number, title?: string, detail?: string) {
  return new AxiosError('x', 'ERR', undefined, undefined, { status, data: { title, detail } } as AxiosResponse);
}

describe('tokenDelFragmento', () => {
  it('lee el token del fragmento', () => {
    expect(tokenDelFragmento('#token=abc_DEF-123')).toBe('abc_DEF-123');
  });
  it('sin token o vacío devuelve null', () => {
    expect(tokenDelFragmento('')).toBeNull();
    expect(tokenDelFragmento('#')).toBeNull();
    expect(tokenDelFragmento('#token=')).toBeNull();
    expect(tokenDelFragmento('#otro=1')).toBeNull();
  });
});

describe('validarClaves', () => {
  it('exige 12 caracteres y que coincidan', () => {
    expect(validarClaves('corta', 'corta')).toMatch(/al menos 12/);
    expect(validarClaves(CLAVE, 'otra-distinta-123')).toMatch(/no coincide/);
    expect(validarClaves(CLAVE, CLAVE)).toBeNull();
  });
});

describe('NuevaClavePage (RF-09, paso 2)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('borra el token de la URL en cuanto carga', async () => {
    montar();
    expect(await screen.findByTestId('ubicacion')).toHaveTextContent(/^\/nueva-clave$/);
  });

  it('guarda la clave nueva con el token y NO inicia sesión', async () => {
    const restablecer = vi.spyOn(auth, 'restablecerClave').mockResolvedValue();
    montar();
    await llenar(CLAVE, CLAVE);
    expect(restablecer).toHaveBeenCalledWith('abc_DEF-123', CLAVE);
    expect(await screen.findByRole('status')).toHaveTextContent('Inicia sesión con la clave nueva');
    await userEvent.click(screen.getByRole('button', { name: /Ir a iniciar sesión/ }));
    expect(await screen.findByText('pantalla login')).toBeInTheDocument();
  });

  it('clave corta o que no coincide: error local y no llama al servidor', async () => {
    const restablecer = vi.spyOn(auth, 'restablecerClave').mockResolvedValue();
    montar();
    await llenar('corta', 'corta');
    expect(screen.getByRole('alert')).toHaveTextContent(/al menos 12/);
    expect(restablecer).not.toHaveBeenCalled();
  });

  it('sin token en la URL muestra "Enlace no válido" y ofrece pedir otro', async () => {
    montar('/nueva-clave');
    expect(screen.getByRole('alert')).toHaveTextContent('El enlace no es válido o ya venció');
    await userEvent.click(screen.getByRole('link', { name: /Solicitar un enlace nuevo/ }));
    expect(await screen.findByText('pantalla olvide')).toBeInTheDocument();
  });

  it('un enlace con ?token= (en la query, no en el fragmento) no se acepta', () => {
    montar('/nueva-clave?token=abc');
    expect(screen.getByRole('alert')).toHaveTextContent('El enlace no es válido o ya venció');
  });

  it('el servidor dice "Enlace no válido" (vencido o ya usado): pantalla de enlace no válido', async () => {
    vi.spyOn(auth, 'restablecerClave').mockRejectedValue(
      problema(400, 'Enlace no válido', 'El enlace no es válido o ya venció. Solicita uno nuevo.'));
    montar();
    await llenar(CLAVE, CLAVE);
    expect(await screen.findByText('Enlace no válido', { selector: 'h1' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Solicitar un enlace nuevo/ })).toBeInTheDocument();
  });

  it('una clave rechazada por el servidor (400 de política) se muestra y deja reintentar con el mismo enlace', async () => {
    vi.spyOn(auth, 'restablecerClave').mockRejectedValue(
      problema(400, 'Datos inválidos', 'La clave nueva debe ser distinta de la actual.'));
    montar();
    await llenar(CLAVE, CLAVE);
    expect(await screen.findByRole('alert')).toHaveTextContent('distinta de la actual');
    expect(screen.getByRole('button', { name: /Guardar clave nueva/ })).toBeEnabled();
  });

  it('con 429 lo explica', async () => {
    vi.spyOn(auth, 'restablecerClave').mockRejectedValue(
      new AxiosError('x', 'ERR', undefined, undefined, { status: 429, headers: { 'retry-after': '60' } } as unknown as AxiosResponse));
    montar();
    await llenar(CLAVE, CLAVE);
    expect(await screen.findByRole('alert')).toHaveTextContent(/Demasiados intentos.*60 segundos/);
  });

  it('no envía dos veces si se hace doble clic', async () => {
    let resolver: () => void = () => {};
    const restablecer = vi.spyOn(auth, 'restablecerClave').mockImplementation(() => new Promise<void>((r) => { resolver = r; }));
    montar();
    await userEvent.type(screen.getByLabelText('Clave nueva'), CLAVE);
    await userEvent.type(screen.getByLabelText('Repite la clave nueva'), CLAVE);
    const boton = screen.getByRole('button', { name: /Guardar clave nueva/ });
    await userEvent.dblClick(boton);
    expect(restablecer).toHaveBeenCalledTimes(1);
    resolver();
  });
});
