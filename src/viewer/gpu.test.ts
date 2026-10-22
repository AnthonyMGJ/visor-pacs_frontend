import { describe, expect, it } from 'vitest';
import { decidirTexturaLiviana, type Almacen, modoTexturaForzado, necesitaTexturaLiviana, sondearGl, usarTexturaLiviana, type ContextoGl } from './gpu';

const glCon = (extensiones: string[]): ContextoGl => ({
  getExtension: (n) => (extensiones.includes(n) ? {} : null),
});

describe('necesitaTexturaLiviana', () => {
  it('si la GPU filtra texturas decimales de 32 bits no hace falta', () => {
    expect(necesitaTexturaLiviana(glCon(['OES_texture_float_linear']))).toBe(false);
  });

  it('si la GPU no las filtra (típico de celulares) se piden las livianas', () => {
    expect(necesitaTexturaLiviana(glCon(['EXT_color_buffer_float']))).toBe(true);
  });

  it('sin WebGL no se toca nada (Cornerstone usa la CPU)', () => {
    expect(necesitaTexturaLiviana(null)).toBe(false);
    expect(necesitaTexturaLiviana(undefined)).toBe(false);
  });

  it('si consultar la extensión falla, no rompe y no cambia el modo', () => {
    const gl: ContextoGl = {
      getExtension: () => {
        throw new Error('contexto perdido');
      },
    };
    expect(necesitaTexturaLiviana(gl)).toBe(false);
  });
});

describe('modoTexturaForzado', () => {
  it.each([
    ['?gpu=liviana', 'liviana'],
    ['?x=1&gpu=normal', 'normal'],
    ['?gpu=otra', undefined],
    ['', undefined],
  ])('%s → %s', (busqueda, esperado) => {
    expect(modoTexturaForzado(busqueda)).toBe(esperado);
  });
});

const almacenEnMemoria = (): Almacen & { datos: Map<string, string> } => {
  const datos = new Map<string, string>();
  return { datos, getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => void datos.set(k, v) };
};

describe('modoTexturaForzado con almacenamiento de la pestaña', () => {
  it('lo que viene en la dirección se guarda y sigue valiendo cuando la dirección ya no lo trae', () => {
    const almacen = almacenEnMemoria();
    expect(modoTexturaForzado('?gpu=liviana', almacen)).toBe('liviana');
    expect(modoTexturaForzado('', almacen)).toBe('liviana');
    expect(modoTexturaForzado('?gpu=normal', almacen)).toBe('normal');
    expect(modoTexturaForzado('', almacen)).toBe('normal');
  });

  it('un valor guardado que no es válido se ignora', () => {
    const almacen = almacenEnMemoria();
    almacen.setItem('visor.gpu', 'basura');
    expect(modoTexturaForzado('', almacen)).toBeUndefined();
  });

  it('si el almacenamiento falla, se usa solo lo de la dirección', () => {
    const roto: Almacen = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    expect(modoTexturaForzado('?gpu=liviana', roto)).toBe('liviana');
    expect(modoTexturaForzado('', roto)).toBeUndefined();
  });
});

describe('usarTexturaLiviana', () => {
  it('lo forzado en la dirección manda sobre la GPU', () => {
    expect(usarTexturaLiviana('liviana', glCon(['OES_texture_float_linear']))).toBe(true);
    expect(usarTexturaLiviana('normal', glCon([]))).toBe(false);
  });

  it('sin forzar, decide la GPU', () => {
    expect(usarTexturaLiviana(undefined, glCon([]))).toBe(true);
    expect(usarTexturaLiviana(undefined, glCon(['OES_texture_float_linear']))).toBe(false);
  });
});

describe('sondearGl', () => {
  it('sin WebGL (como en las pruebas) devuelve null en vez de lanzar error', () => {
    expect(sondearGl()).toBeNull();
  });
});

describe('decidirTexturaLiviana', () => {
  it('sin WebGL no cambia el modo; lo forzado en la dirección sí manda', () => {
    expect(decidirTexturaLiviana('')).toBe(false);
    expect(decidirTexturaLiviana('?gpu=liviana')).toBe(true);
    expect(decidirTexturaLiviana('?gpu=normal')).toBe(false);
  });
});
