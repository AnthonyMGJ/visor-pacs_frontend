import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import leesLogo from '../../assets/logo-lees.png';

/** Marco común de las pantallas de recuperación de clave (mismo estilo oscuro del login). */
export const RecuperacionLayout: React.FC<{ titulo: string; subtitulo?: string; children: React.ReactNode }> = ({
  titulo, subtitulo, children,
}) => (
  <div className="min-h-screen w-screen bg-[#070b11] flex items-center justify-center p-6 font-sans text-slate-100">
    <div className="w-full max-w-md space-y-6">
      <div className="text-center space-y-3">
        <img src={leesLogo} alt="Logo LEES" className="h-16 w-auto mx-auto object-contain" />
        <h1 className="text-2xl font-bold text-white tracking-tight">{titulo}</h1>
        {subtitulo && <p className="text-xs text-slate-400">{subtitulo}</p>}
      </div>
      {children}
      <Link to="/login" className="w-full text-xs text-slate-400 hover:text-slate-200 flex items-center justify-center gap-2">
        <ArrowLeft className="w-3.5 h-3.5" /> Volver al inicio de sesión
      </Link>
    </div>
  </div>
);

export const CAMPO =
  'w-full px-4 py-3 bg-[#0d1522] border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 text-sm';
export const BOTON =
  'disabled:opacity-60 w-full py-3.5 px-4 bg-gradient-to-r from-sky-500 to-cyan-500 text-slate-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2';
export const ETIQUETA = 'block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2';
