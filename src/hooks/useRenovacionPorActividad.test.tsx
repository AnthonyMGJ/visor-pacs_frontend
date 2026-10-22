import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRenovacionPorActividad } from './useRenovacionPorActividad';
import { useAuthStore } from '../store/auth.store';

const renovarMock = vi.hoisted(() => vi.fn());
vi.mock('../services/auth.service', () => ({ renovar: renovarMock }));

const SEG = 1000;

/** Simula una renovación correcta: el servidor entrega un token con 15 minutos nuevos. */
function renovacionCorrecta() {
  renovarMock.mockImplementation(async () => {
    useAuthStore.getState().setSession('token-nuevo', 900, 'MEDICO', 'Ana');
  });
}

async function avanzar(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function actividad(tipo = 'keydown') {
  act(() => {
    window.dispatchEvent(new Event(tipo));
  });
}

describe('useRenovacionPorActividad', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    renovarMock.mockReset();
    renovacionCorrecta();
  });
  afterEach(() => {
    useAuthStore.getState().clear();
    vi.useRealTimers();
  });

  it('sin actividad NO renueva, aunque falte poco: el token vence por inactividad', async () => {
    useAuthStore.getState().setSession('viejo', 200, 'MEDICO', 'Ana'); // faltan 200 s (< 5 min)
    renderHook(() => useRenovacionPorActividad());
    await avanzar(60 * SEG);
    expect(renovarMock).not.toHaveBeenCalled();
  });

  it('con actividad y poco tiempo restante renueva en la siguiente revisión', async () => {
    useAuthStore.getState().setSession('viejo', 200, 'MEDICO', 'Ana');
    renderHook(() => useRenovacionPorActividad());
    actividad();
    await avanzar(5 * SEG);
    expect(renovarMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().token).toBe('token-nuevo');
  });

  it('con actividad pero mucho tiempo restante todavía no renueva', async () => {
    useAuthStore.getState().setSession('viejo', 900, 'MEDICO', 'Ana'); // 15 min
    renderHook(() => useRenovacionPorActividad());
    actividad();
    await avanzar(60 * SEG);
    expect(renovarMock).not.toHaveBeenCalled();
  });

  it('renueva en cuanto cruza el umbral si la persona sigue activa', async () => {
    useAuthStore.getState().setSession('viejo', 330, 'MEDICO', 'Ana'); // faltan 5 min 30 s
    renderHook(() => useRenovacionPorActividad());
    actividad();
    await avanzar(20 * SEG);
    expect(renovarMock).not.toHaveBeenCalled();
    await avanzar(15 * SEG); // ya faltan menos de 5 min
    expect(renovarMock).toHaveBeenCalledTimes(1);
  });

  it('una actividad cuando ya toca renovar no espera a la revisión periódica', async () => {
    useAuthStore.getState().setSession('viejo', 40, 'MEDICO', 'Ana'); // faltan 40 s
    renderHook(() => useRenovacionPorActividad({ intervaloMs: 60 * SEG }));
    await avanzar(3 * SEG);
    expect(renovarMock).not.toHaveBeenCalled();
    actividad('pointermove');
    await avanzar(0);
    expect(renovarMock).toHaveBeenCalledTimes(1);
  });

  it('tras renovar no vuelve a renovar hasta que haya actividad nueva y poco tiempo restante', async () => {
    useAuthStore.getState().setSession('viejo', 200, 'MEDICO', 'Ana');
    renderHook(() => useRenovacionPorActividad());
    actividad();
    await avanzar(5 * SEG);
    expect(renovarMock).toHaveBeenCalledTimes(1);

    await avanzar(120 * SEG); // el token nuevo dura 15 min: no toca
    actividad();
    await avanzar(30 * SEG);
    expect(renovarMock).toHaveBeenCalledTimes(1);
  });

  it('nunca lanza dos renovaciones a la vez', async () => {
    useAuthStore.getState().setSession('viejo', 200, 'MEDICO', 'Ana');
    let resolver: () => void = () => {};
    renovarMock.mockImplementation(() => new Promise<void>((ok) => { resolver = ok; }));
    renderHook(() => useRenovacionPorActividad());
    actividad();
    await avanzar(5 * SEG);
    actividad();
    await avanzar(5 * SEG);
    expect(renovarMock).toHaveBeenCalledTimes(1);
    resolver();
    await avanzar(0);
  });

  it('si la renovación falla (sin red), no se rinde y reintenta en la siguiente revisión', async () => {
    useAuthStore.getState().setSession('viejo', 200, 'MEDICO', 'Ana');
    renovarMock.mockRejectedValueOnce(new Error('sin red'));
    renderHook(() => useRenovacionPorActividad());
    actividad();
    await avanzar(5 * SEG);
    expect(renovarMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().token).toBe('viejo'); // la sesión local no se tocó

    renovacionCorrecta();
    actividad();
    await avanzar(5 * SEG);
    expect(renovarMock).toHaveBeenCalledTimes(2);
    expect(useAuthStore.getState().token).toBe('token-nuevo');
  });

  it('no renueva mientras la cuenta tiene clave temporal', async () => {
    useAuthStore.getState().setSession('viejo', 200, 'MEDICO', 'Ana', true);
    renderHook(() => useRenovacionPorActividad());
    actividad();
    await avanzar(30 * SEG);
    expect(renovarMock).not.toHaveBeenCalled();
  });

  it('cuando el token vence avisa una sola vez', async () => {
    useAuthStore.getState().setSession('viejo', 8, 'MEDICO', 'Ana');
    const alVencer = vi.fn();
    renderHook(() => useRenovacionPorActividad({ alVencer }));
    await avanzar(5 * SEG);
    expect(alVencer).not.toHaveBeenCalled();
    await avanzar(20 * SEG);
    expect(alVencer).toHaveBeenCalledTimes(1);
  });

  it('informa el tiempo restante del token y null si no hay sesión', async () => {
    const sin = renderHook(() => useRenovacionPorActividad());
    expect(sin.result.current).toBeNull();
    sin.unmount();

    useAuthStore.getState().setSession('viejo', 600, 'MEDICO', 'Ana');
    const con = renderHook(() => useRenovacionPorActividad());
    expect(con.result.current).toBeGreaterThan(590 * SEG);
    expect(con.result.current).toBeLessThanOrEqual(600 * SEG);
  });

  it('al desmontarse deja de escuchar la actividad y de revisar', async () => {
    useAuthStore.getState().setSession('viejo', 200, 'MEDICO', 'Ana');
    const { unmount } = renderHook(() => useRenovacionPorActividad());
    unmount();
    actividad();
    await avanzar(30 * SEG);
    expect(renovarMock).not.toHaveBeenCalled();
  });
});
