import React, { useState } from 'react';
import { Mail } from 'lucide-react';

import { mensajeDeErrorRecuperacion, solicitarRecuperacion } from '../../services/auth.service';
import { BOTON, CAMPO, ETIQUETA, RecuperacionLayout } from './RecuperacionLayout';

/**
 * RF-09, paso 1: la persona escribe su correo. La pantalla siguiente es idéntica exista o no la cuenta
 * (el servidor responde igual); solo un error de red o un límite de intentos se muestra como error.
 */
export const OlvideClavePage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    if (!email.trim()) {
      setError('Escribe el correo de tu cuenta.');
      return;
    }
    setError('');
    setEnviando(true);
    try {
      setMensaje(await solicitarRecuperacion(email));
    } catch (err) {
      setError(mensajeDeErrorRecuperacion(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <RecuperacionLayout titulo="Recuperar clave" subtitulo="Te enviaremos un enlace al correo registrado en tu cuenta.">
      {mensaje ? (
        <div role="status" className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-200 text-sm text-center">
          {mensaje}
        </div>
      ) : (
        <>
          {error && (
            <div role="alert" className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center font-medium">
              {error}
            </div>
          )}
          <form onSubmit={enviar} className="space-y-4" noValidate>
            <div>
              <label htmlFor="correo" className={ETIQUETA}>Correo</label>
              <input id="correo" type="email" autoComplete="email" inputMode="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="tu.correo@ejemplo.com" className={CAMPO} />
            </div>
            <button type="submit" disabled={enviando} className={BOTON}>
              <Mail className="w-4 h-4" />
              {enviando ? 'Enviando…' : 'Enviar enlace'}
            </button>
          </form>
          <p className="text-[11px] text-slate-500 text-center">
            Los administradores no usan este medio: su clave la restablece otro administrador.
          </p>
        </>
      )}
    </RecuperacionLayout>
  );
};
