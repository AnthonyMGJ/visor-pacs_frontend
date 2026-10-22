import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';

import {
  CLAVE_MINIMA, esEnlaceInvalido, mensajeDeErrorRecuperacion, restablecerClave,
} from '../../services/auth.service';
import { BOTON, CAMPO, ETIQUETA, RecuperacionLayout } from './RecuperacionLayout';

/** El token viaja en el fragmento (#token=...): el navegador no lo manda al servidor ni lo deja en registros ni en el Referer. */
export function tokenDelFragmento(hash: string): string | null {
  const valor = new URLSearchParams(hash.replace(/^#/, '')).get('token');
  return valor && valor.trim() ? valor.trim() : null;
}

export function validarClaves(nueva: string, repetida: string): string | null {
  if (nueva.length < CLAVE_MINIMA) return `La clave nueva debe tener al menos ${CLAVE_MINIMA} caracteres.`;
  if (nueva !== repetida) return 'La confirmación no coincide con la clave nueva.';
  return null;
}

/** RF-09, paso 2: clave nueva con el enlace recibido por correo. Al terminar NO inicia sesión. */
export const NuevaClavePage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  // El token se guarda en memoria y se borra de la URL en cuanto carga la página.
  const [token] = useState<string | null>(() => tokenDelFragmento(location.hash));
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState('');
  const [enlaceInvalido, setEnlaceInvalido] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (location.hash) navigate({ pathname: location.pathname, search: location.search, hash: '' }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guardando || !token) return;
    const problema = validarClaves(nueva, repetida);
    if (problema) {
      setError(problema);
      return;
    }
    setError('');
    setGuardando(true);
    try {
      await restablecerClave(token, nueva);
      setListo(true);
    } catch (err) {
      if (esEnlaceInvalido(err)) setEnlaceInvalido(true);
      else setError(mensajeDeErrorRecuperacion(err));
    } finally {
      setGuardando(false);
    }
  };

  if (listo) {
    return (
      <RecuperacionLayout titulo="Clave cambiada">
        <div role="status" className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-sm text-center">
          Tu clave fue cambiada y se cerraron tus sesiones abiertas. Inicia sesión con la clave nueva.
        </div>
        <button type="button" onClick={() => navigate('/login', { replace: true })} className={BOTON}>
          Ir a iniciar sesión
        </button>
      </RecuperacionLayout>
    );
  }

  if (!token || enlaceInvalido) {
    return (
      <RecuperacionLayout titulo="Enlace no válido">
        <div role="alert" className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm text-center">
          El enlace no es válido o ya venció. Solicita uno nuevo.
        </div>
        <Link to="/olvide-clave" className={BOTON}>Solicitar un enlace nuevo</Link>
      </RecuperacionLayout>
    );
  }

  return (
    <RecuperacionLayout titulo="Elige tu clave nueva" subtitulo="Al guardarla se cerrarán tus sesiones abiertas.">
      {error && (
        <div role="alert" className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center font-medium">
          {error}
        </div>
      )}
      <form onSubmit={enviar} className="space-y-4" noValidate>
        <div>
          <label htmlFor="clave-nueva" className={ETIQUETA}>Clave nueva</label>
          <input id="clave-nueva" type="password" autoComplete="new-password" value={nueva}
            onChange={(e) => setNueva(e.target.value)} className={CAMPO} />
          <p className="mt-1 text-[11px] text-slate-500">Mínimo {CLAVE_MINIMA} caracteres.</p>
        </div>
        <div>
          <label htmlFor="clave-repetida" className={ETIQUETA}>Repite la clave nueva</label>
          <input id="clave-repetida" type="password" autoComplete="new-password" value={repetida}
            onChange={(e) => setRepetida(e.target.value)} className={CAMPO} />
        </div>
        <button type="submit" disabled={guardando} className={BOTON}>
          <KeyRound className="w-4 h-4" />
          {guardando ? 'Guardando…' : 'Guardar clave nueva'}
        </button>
      </form>
    </RecuperacionLayout>
  );
};
