import { create } from 'zustand';
import { esRolValido, type Rol } from '../types/auth.types';

const KEY = 'pacs_session';
const KEY_MOTIVO = 'pacs_motivo_salida';

/** Por qué se cerró la sesión sin que la persona lo pidiera (el login lo muestra una vez). */
export type MotivoSalida = 'sesion' | 'inactividad';

interface Session {
  token: string;
  expiresAt: number; // ms epoch
  rol: Rol;
  nombre: string;
  debeCambiarClave: boolean;
}

function load(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Session>;
    if (
      typeof s.token !== 'string' ||
      typeof s.expiresAt !== 'number' ||
      s.expiresAt <= Date.now() ||
      !esRolValido(s.rol)
    ) {
      return null; // vencida, corrupta o de una versión anterior sin rol
    }
    return {
      token: s.token,
      expiresAt: s.expiresAt,
      rol: s.rol,
      nombre: s.nombre ?? '',
      debeCambiarClave: s.debeCambiarClave === true,
    };
  } catch {
    return null;
  }
}

interface AuthState {
  token: string | null;
  expiresAt: number | null;
  rol: Rol | null;
  nombre: string | null;
  debeCambiarClave: boolean;
  setSession: (token: string, expiresInSeconds: number, rol: Rol, nombre: string, debeCambiarClave?: boolean) => void;
  /** El servidor indicó (403 CLAVE_TEMPORAL) que la cuenta debe cambiar su clave antes de seguir. */
  marcarClaveTemporal: () => void;
  clear: (motivo?: MotivoSalida) => void;
  isValid: () => boolean;
}

const inicial = load();

function guardar(s: Session) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* sin almacenamiento: la sesión vive solo en memoria */
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: inicial?.token ?? null,
  expiresAt: inicial?.expiresAt ?? null,
  rol: inicial?.rol ?? null,
  nombre: inicial?.nombre ?? null,
  debeCambiarClave: inicial?.debeCambiarClave ?? false,
  setSession: (token, expiresInSeconds, rol, nombre, debeCambiarClave = false) => {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    guardar({ token, expiresAt, rol, nombre, debeCambiarClave });
    set({ token, expiresAt, rol, nombre, debeCambiarClave });
  },
  marcarClaveTemporal: () => {
    const { token, expiresAt, rol, nombre } = get();
    if (token && expiresAt && rol) {
      guardar({ token, expiresAt, rol, nombre: nombre ?? '', debeCambiarClave: true });
    }
    set({ debeCambiarClave: true });
  },
  clear: (motivo) => {
    try {
      sessionStorage.removeItem(KEY);
      if (motivo) sessionStorage.setItem(KEY_MOTIVO, motivo);
    } catch {
      /* nada */
    }
    set({ token: null, expiresAt: null, rol: null, nombre: null, debeCambiarClave: false });
  },
  isValid: () => {
    const { token, expiresAt, rol } = get();
    return !!token && !!expiresAt && expiresAt > Date.now() && !!rol;
  },
}));

/** Lee el motivo de la última salida involuntaria sin borrarlo (borrarlo es descartarMotivoSalida). */
export function consultarMotivoSalida(): MotivoSalida | null {
  try {
    const m = sessionStorage.getItem(KEY_MOTIVO);
    return m === 'sesion' || m === 'inactividad' ? m : null;
  } catch {
    return null;
  }
}

export function descartarMotivoSalida(): void {
  try {
    sessionStorage.removeItem(KEY_MOTIVO);
  } catch {
    /* nada */
  }
}
