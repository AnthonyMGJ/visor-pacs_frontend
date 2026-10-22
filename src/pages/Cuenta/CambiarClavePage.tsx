import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, LogOut } from 'lucide-react';

import leesLogo from '../../assets/logo-lees.png';
import { CLAVE_MINIMA, cambiarClave, logout, mensajeDeErrorClave } from '../../services/auth.service';
import { rutaInicio } from '../../routes/rutas';
import { useAuthStore } from '../../store/auth.store';

/** Validación del formulario antes de llamar al servidor (el servidor repite estas reglas). */
export function validarClaveNueva(actual: string, nueva: string, repetida: string): string | null {
  if (!actual) return 'Escribe tu clave actual.';
  if (nueva.length < CLAVE_MINIMA) return `La clave nueva debe tener al menos ${CLAVE_MINIMA} caracteres.`;
  if (nueva === actual) return 'La clave nueva debe ser distinta de la actual.';
  if (nueva !== repetida) return 'La confirmación no coincide con la clave nueva.';
  return null;
}

const campo =
  'w-full px-4 py-3 bg-[#0d1522] border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 text-sm';

export const CambiarClavePage: React.FC = () => {
  const navigate = useNavigate();
  const forzado = useAuthStore((s) => s.debeCambiarClave);
  const rol = useAuthStore((s) => s.rol);
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const problema = validarClaveNueva(actual, nueva, repetida);
    if (problema) {
      setError(problema);
      return;
    }
    setError('');
    setGuardando(true);
    try {
      await cambiarClave(actual, nueva);
      navigate(rutaInicio(useAuthStore.getState().rol), { replace: true });
    } catch (err) {
      setError(mensajeDeErrorClave(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#070b11] flex items-center justify-center p-6 font-sans text-slate-100">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <img src={leesLogo} alt="Logo LEES" className="h-16 w-auto mx-auto object-contain" />
          <h1 className="text-2xl font-bold text-white tracking-tight">Cambiar clave</h1>
          {forzado ? (
            <p role="status" className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
              Tu clave es temporal. Elige una clave nueva para continuar.
            </p>
          ) : (
            <p className="text-xs text-slate-400">Al cambiarla se cerrarán tus sesiones abiertas en otros dispositivos.</p>
          )}
        </div>

        {error && (
          <div role="alert" className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={enviar} className="space-y-4" noValidate>
          <div>
            <label htmlFor="clave-actual" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              {forzado ? 'Clave temporal' : 'Clave actual'}
            </label>
            <input id="clave-actual" type="password" autoComplete="current-password" value={actual}
              onChange={(e) => setActual(e.target.value)} className={campo} />
          </div>
          <div>
            <label htmlFor="clave-nueva" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Clave nueva
            </label>
            <input id="clave-nueva" type="password" autoComplete="new-password" value={nueva}
              onChange={(e) => setNueva(e.target.value)} className={campo} />
            <p className="mt-1 text-[11px] text-slate-500">Mínimo {CLAVE_MINIMA} caracteres.</p>
          </div>
          <div>
            <label htmlFor="clave-repetida" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Repite la clave nueva
            </label>
            <input id="clave-repetida" type="password" autoComplete="new-password" value={repetida}
              onChange={(e) => setRepetida(e.target.value)} className={campo} />
          </div>

          <button type="submit" disabled={guardando}
            className="disabled:opacity-60 w-full py-3.5 px-4 bg-gradient-to-r from-sky-500 to-cyan-500 text-slate-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2">
            <KeyRound className="w-4 h-4" />
            {guardando ? 'Guardando…' : 'Guardar clave nueva'}
          </button>
        </form>

        {forzado ? (
          <button type="button" onClick={async () => { await logout(); navigate('/login', { replace: true }); }}
            className="w-full text-xs text-slate-400 hover:text-red-400 flex items-center justify-center gap-2">
            <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
          </button>
        ) : (
          <button type="button" onClick={() => navigate(rutaInicio(rol))}
            className="w-full text-xs text-slate-400 hover:text-slate-200 flex items-center justify-center gap-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Volver
          </button>
        )}
      </div>
    </div>
  );
};
