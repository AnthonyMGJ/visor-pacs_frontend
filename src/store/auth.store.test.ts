import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const KEY = 'pacs_session';

async function cargarStore() {
  vi.resetModules();
  return (await import('./auth.store')).useAuthStore;
}

describe('auth.store', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.useRealTimers());

  it('setSession guarda token, rol y nombre, y la sesión es válida', async () => {
    const store = await cargarStore();
    store.getState().setSession('tok', 900, 'MEDICO', 'Ana Pérez');
    const s = store.getState();
    expect(s.token).toBe('tok');
    expect(s.rol).toBe('MEDICO');
    expect(s.nombre).toBe('Ana Pérez');
    expect(s.isValid()).toBe(true);
    expect(JSON.parse(sessionStorage.getItem(KEY)!)).toMatchObject({ token: 'tok', rol: 'MEDICO' });
  });

  it('recupera la sesión guardada al recargar la página', async () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ token: 't', expiresAt: Date.now() + 60_000, rol: 'PACIENTE', nombre: 'Juan Díaz' }),
    );
    const store = await cargarStore();
    expect(store.getState().rol).toBe('PACIENTE');
    expect(store.getState().isValid()).toBe(true);
  });

  it('descarta una sesión vencida', async () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ token: 't', expiresAt: Date.now() - 1, rol: 'MEDICO', nombre: 'x' }),
    );
    const store = await cargarStore();
    expect(store.getState().token).toBeNull();
    expect(store.getState().isValid()).toBe(false);
  });

  it('descarta una sesión guardada sin rol o con un rol desconocido', async () => {
    sessionStorage.setItem(KEY, JSON.stringify({ token: 't', expiresAt: Date.now() + 60_000 }));
    expect((await cargarStore()).getState().token).toBeNull();

    sessionStorage.setItem(
      KEY,
      JSON.stringify({ token: 't', expiresAt: Date.now() + 60_000, rol: 'AUDITOR', nombre: 'x' }),
    );
    expect((await cargarStore()).getState().token).toBeNull();
  });

  it('ignora JSON corrupto en el almacenamiento', async () => {
    sessionStorage.setItem(KEY, '{no es json');
    expect((await cargarStore()).getState().token).toBeNull();
  });

  it('isValid pasa a false cuando el token vence', async () => {
    vi.useFakeTimers();
    const store = await cargarStore();
    store.getState().setSession('tok', 10, 'MEDICO', 'Ana');
    expect(store.getState().isValid()).toBe(true);
    vi.advanceTimersByTime(11_000);
    expect(store.getState().isValid()).toBe(false);
  });

  it('clear borra todo, también del almacenamiento', async () => {
    const store = await cargarStore();
    store.getState().setSession('tok', 900, 'MEDICO', 'Ana');
    store.getState().clear();
    expect(store.getState()).toMatchObject({ token: null, expiresAt: null, rol: null, nombre: null });
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('acepta y recupera una sesión de ADMIN', async () => {
    const store = await cargarStore();
    store.getState().setSession('tok', 900, 'ADMIN', 'Luz Rojas');
    expect(store.getState().isValid()).toBe(true);
    const recargada = await cargarStore();
    expect(recargada.getState().rol).toBe('ADMIN');
  });

  it('la marca de clave temporal se guarda y sobrevive a recargar la página', async () => {
    const store = await cargarStore();
    store.getState().setSession('tok', 900, 'MEDICO', 'Ana', true);
    expect(store.getState().debeCambiarClave).toBe(true);
    expect((await cargarStore()).getState().debeCambiarClave).toBe(true);
  });

  it('por defecto la sesión no exige cambiar la clave, y una sesión antigua sin el dato tampoco', async () => {
    const store = await cargarStore();
    store.getState().setSession('tok', 900, 'MEDICO', 'Ana');
    expect(store.getState().debeCambiarClave).toBe(false);

    sessionStorage.setItem(KEY, JSON.stringify({ token: 't', expiresAt: Date.now() + 60_000, rol: 'MEDICO', nombre: 'x' }));
    expect((await cargarStore()).getState().debeCambiarClave).toBe(false);
  });

  it('marcarClaveTemporal conserva la sesión y la marca', async () => {
    const store = await cargarStore();
    store.getState().setSession('tok', 900, 'PACIENTE', 'Juan');
    store.getState().marcarClaveTemporal();
    expect(store.getState()).toMatchObject({ token: 'tok', debeCambiarClave: true });
    expect(JSON.parse(sessionStorage.getItem(KEY)!)).toMatchObject({ debeCambiarClave: true });
  });

  it('clear con motivo lo deja para que el login lo muestre una vez', async () => {
    vi.resetModules();
    const mod = await import('./auth.store');
    mod.useAuthStore.getState().setSession('tok', 900, 'MEDICO', 'Ana');
    mod.useAuthStore.getState().clear('inactividad');
    expect(mod.consultarMotivoSalida()).toBe('inactividad');
    expect(mod.consultarMotivoSalida()).toBe('inactividad'); // consultar no lo borra
    mod.descartarMotivoSalida();
    expect(mod.consultarMotivoSalida()).toBeNull();
  });

  it('clear sin motivo no deja ningún aviso, y un motivo desconocido se ignora', async () => {
    vi.resetModules();
    const mod = await import('./auth.store');
    mod.useAuthStore.getState().clear();
    expect(mod.consultarMotivoSalida()).toBeNull();
    sessionStorage.setItem('pacs_motivo_salida', 'cualquier-cosa');
    expect(mod.consultarMotivoSalida()).toBeNull();
  });
});
