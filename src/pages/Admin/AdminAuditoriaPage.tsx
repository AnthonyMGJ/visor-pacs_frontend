import { Search } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { Paginacion } from '../../components/Paginacion';
import { listarAuditoria } from '../../services/admin.service';
import { mensajeDeErrorAdmin } from '../../services/auth.service';
import { ETIQUETA_EVENTO, TIPOS_EVENTO, type EventoAuditoria, type FiltroAuditoria, type Pagina } from '../../types/admin.types';

const entrada =
  'w-full px-3 py-2 bg-[#070b11] border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400 text-sm';
const etiqueta = 'block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1';

const FILTRO_VACIO: FiltroAuditoria = { usuario: '', tipo: '', resultado: '', estudio: '', desde: '', hasta: '' };

export function formatearFecha(iso: string): string {
  const f = new Date(iso);
  return Number.isNaN(f.getTime()) ? iso : f.toLocaleString('es-PE');
}

/** Consulta del registro de auditoría (solo lectura): quién entró, qué estudios abrió y qué cambió el administrador. */
export const AdminAuditoriaPage: React.FC = () => {
  const [form, setForm] = useState<FiltroAuditoria>(FILTRO_VACIO);
  const [filtro, setFiltro] = useState<FiltroAuditoria>(FILTRO_VACIO);
  const [nroPagina, setNroPagina] = useState(0);
  const [pagina, setPagina] = useState<Pagina<EventoAuditoria> | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      setPagina(await listarAuditoria({ ...filtro, pagina: nroPagina }));
    } catch (err) {
      setError(mensajeDeErrorAdmin(err));
    } finally {
      setCargando(false);
    }
  }, [filtro, nroPagina]);

  useEffect(() => { void cargar(); }, [cargar]);

  const poner = (campo: keyof FiltroAuditoria) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((x) => ({ ...x, [campo]: e.target.value }));

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    setNroPagina(0);
    setFiltro(form);
  };

  return (
    <section aria-labelledby="titulo-auditoria" className="space-y-4">
      <h1 id="titulo-auditoria" className="text-xl font-bold text-white">Auditoría</h1>

      <form onSubmit={buscar} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-800 bg-[#0d1522] p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div><label htmlFor="a-usuario" className={etiqueta}>Usuario</label><input id="a-usuario" className={entrada} value={form.usuario} onChange={poner('usuario')} /></div>
        <div>
          <label htmlFor="a-tipo" className={etiqueta}>Evento</label>
          <select id="a-tipo" className={entrada} value={form.tipo} onChange={poner('tipo')}>
            <option value="">Todos</option>
            {TIPOS_EVENTO.map((t) => <option key={t} value={t}>{ETIQUETA_EVENTO[t] ?? t}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="a-resultado" className={etiqueta}>Resultado</label>
          <select id="a-resultado" className={entrada} value={form.resultado} onChange={poner('resultado')}>
            <option value="">Todos</option>
            <option value="EXITO">Éxito</option>
            <option value="FALLO">Fallo</option>
          </select>
        </div>
        <div><label htmlFor="a-estudio" className={etiqueta}>Estudio (UID)</label><input id="a-estudio" className={entrada} value={form.estudio} onChange={poner('estudio')} /></div>
        <div><label htmlFor="a-desde" className={etiqueta}>Desde</label><input id="a-desde" type="datetime-local" className={entrada} value={form.desde} onChange={poner('desde')} /></div>
        <div><label htmlFor="a-hasta" className={etiqueta}>Hasta</label><input id="a-hasta" type="datetime-local" className={entrada} value={form.hasta} onChange={poner('hasta')} /></div>
        <div className="flex items-end gap-2 lg:col-span-2">
          <button type="submit" className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800">
            <Search className="h-4 w-4" /> Buscar
          </button>
          <button type="button" className="rounded-lg px-3 py-2 text-xs text-slate-400 hover:text-slate-200"
            onClick={() => { setForm(FILTRO_VACIO); setFiltro(FILTRO_VACIO); setNroPagina(0); }}>
            Limpiar
          </button>
        </div>
      </form>

      {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-medium text-red-400">{error}</div>}

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0d1522]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Evento</th><th className="px-4 py-3">Resultado</th>
              <th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Estudio</th><th className="px-4 py-3">IP</th><th className="px-4 py-3">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {cargando && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Cargando…</td></tr>}
            {!cargando && pagina?.contenido.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">No hay eventos con esos filtros.</td></tr>
            )}
            {!cargando && pagina?.contenido.map((e) => (
              <tr key={e.id} className="border-b border-slate-800/60 last:border-0 align-top">
                <td className="px-4 py-3 whitespace-nowrap text-slate-300">{formatearFecha(e.fecha)}</td>
                <td className="px-4 py-3">{ETIQUETA_EVENTO[e.tipo] ?? e.tipo}</td>
                <td className="px-4 py-3">
                  <span className={e.resultado === 'EXITO' ? 'text-emerald-400' : 'text-red-400'}>{e.resultado === 'EXITO' ? 'Éxito' : 'Fallo'}</span>
                </td>
                <td className="px-4 py-3">{e.username ?? '—'}{e.rol && <span className="ml-1 text-slate-500">({e.rol})</span>}</td>
                <td className="px-4 py-3 max-w-[18rem] break-all font-mono text-[11px] text-slate-400">{e.estudio ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-slate-400">{e.ip ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400">{e.detalle ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagina && <Paginacion pagina={pagina.pagina} totalPaginas={pagina.totalPaginas} total={pagina.total} onCambiar={setNroPagina} />}
    </section>
  );
};
