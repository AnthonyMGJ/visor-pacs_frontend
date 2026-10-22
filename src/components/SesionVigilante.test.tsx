import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SesionVigilante } from './SesionVigilante';
import { consultarMotivoSalida, useAuthStore } from '../store/auth.store';

vi.mock('../services/auth.service', () => ({ renovar: vi.fn() }));

function montar() {
  render(
    <MemoryRouter initialEntries={['/studies']}>
      <Routes>
        <Route path="/login" element={<div>pantalla login</div>} />
        <Route path="/studies" element={<><SesionVigilante /><div>contenido</div></>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function avanzar(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('SesionVigilante', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    useAuthStore.getState().clear();
    vi.useRealTimers();
  });

  it('no muestra nada mientras queda tiempo de sobra', () => {
    useAuthStore.getState().setSession('t', 600, 'MEDICO', 'Ana');
    montar();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('contenido')).toBeInTheDocument();
  });

  it('avisa cuando falta menos de un minuto para que venza por inactividad', async () => {
    useAuthStore.getState().setSession('t', 50, 'MEDICO', 'Ana');
    montar();
    const aviso = screen.getByRole('alert');
    expect(aviso).toHaveTextContent(/vence en 50 s/);
    await avanzar(10_000);
    expect(screen.getByRole('alert')).toHaveTextContent(/vence en 40 s/);
  });

  it('si vence, cierra la sesión, lleva al login y deja el aviso de inactividad', async () => {
    useAuthStore.getState().setSession('t', 8, 'MEDICO', 'Ana');
    montar();
    await avanzar(10_000);
    expect(screen.getByText('pantalla login')).toBeInTheDocument();
    expect(useAuthStore.getState().token).toBeNull();
    expect(consultarMotivoSalida()).toBe('inactividad');
  });
});
