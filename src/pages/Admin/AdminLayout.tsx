import { KeyRound, LogOut, ScrollText, Users } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import leesLogo from '../../assets/logo-lees.png';
import { logout } from '../../services/auth.service';
import { useAuthStore } from '../../store/auth.store';

const enlace = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
    isActive ? 'bg-sky-500/15 text-sky-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
  }`;

/** Marco del panel de administración: cuentas y permisos, y auditoría. El ADMIN nunca ve imágenes. */
export function AdminLayout() {
  const navigate = useNavigate();
  const nombre = useAuthStore((s) => s.nombre) ?? '';

  return (
    <div className="min-h-screen bg-[#070b11] text-slate-100 flex flex-col font-sans">
      <header className="min-h-16 bg-[#09101d] border-b border-slate-800/80 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 sticky top-0 z-30">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <img src={leesLogo} alt="LEES PACS" className="h-9 w-auto object-contain" />
          <span className="text-xs font-semibold uppercase tracking-wider text-sky-400 bg-sky-950/60 border border-sky-500/30 px-2.5 py-0.5 rounded-full">
            Administración
          </span>
          <nav aria-label="Administración" className="flex items-center gap-1 sm:ml-2">
            <NavLink to="/admin" end className={enlace}><Users className="h-3.5 w-3.5" /> Cuentas</NavLink>
            <NavLink to="/admin/auditoria" className={enlace}><ScrollText className="h-3.5 w-3.5" /> Auditoría</NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="hidden sm:block text-slate-300 font-semibold">{nombre}</span>
          <button type="button" onClick={() => navigate('/cambiar-clave')} title="Cambiar clave" aria-label="Cambiar clave"
            className="p-2 text-slate-400 hover:text-sky-400 rounded-lg hover:bg-sky-500/10">
            <KeyRound className="h-4 w-4" />
          </button>
          <button type="button" onClick={async () => { await logout(); navigate('/login'); }} title="Cerrar sesión" aria-label="Cerrar sesión"
            className="p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-500/10">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>
      <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
