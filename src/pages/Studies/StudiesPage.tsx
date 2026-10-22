import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Eye, RefreshCw, LogOut, Activity, Layers, FileText, KeyRound } from 'lucide-react';

import leesLogo from '../../assets/logo-lees.png';
import { logout, mensajeDeError } from '../../services/auth.service';
import { listarEstudios } from '../../services/studies.service';
import { estudioEnRango, type Study } from '../../services/studies.mapper';
import { useAuthStore } from '../../store/auth.store';
import { ETIQUETA_ROL } from '../../types/auth.types';


function iniciales(nombre: string): string {
  const letras = nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase());
  return letras.join('') || '?';
}

function hoyISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export const StudiesPage: React.FC = () => {
  const navigate = useNavigate();
  const nombre = useAuthStore((s) => s.nombre) ?? '';
  const rol = useAuthStore((s) => s.rol);
  const esPaciente = rol === 'PACIENTE';

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModality, setSelectedModality] = useState<string>('TODAS');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [studies, setStudies] = useState<Study[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setStudies(await listarEstudios());
    } catch (err) {
      setStudies([]);
      setError(mensajeDeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const modalidades = useMemo(
    () => ['TODAS', ...Array.from(new Set(studies.flatMap((s) => s.modalities))).sort()],
    [studies],
  );

  const filteredStudies = studies.filter((s) => {
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      s.patientName.toLowerCase().includes(q) ||
      s.patientId.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q);
    const matchesModality = selectedModality === 'TODAS' || s.modalities.includes(selectedModality);
    return matchesSearch && matchesModality && estudioEnRango(s.studyDate, desde, hasta);
  });

  const estudiosHoy = studies.filter((s) => s.studyDate.startsWith(hoyISO())).length;
  const totalImagenes = studies.reduce((acc, s) => acc + (s.instances ?? 0), 0);

  const handleOpenViewer = (studyUid: string) => {
    navigate(`/viewer/${studyUid}`);
  };

  return (
    <div className="min-h-screen bg-[#070b11] text-slate-100 flex flex-col font-sans select-none">

      {/* HEADER SUPERIOR */}
      <header className="h-16 bg-[#09101d] border-b border-slate-800/80 px-3 sm:px-6 flex items-center justify-between gap-2 sticky top-0 z-30 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <img src={leesLogo} alt="LEES PACS" className="h-8 sm:h-9 w-auto min-w-0 shrink object-contain" />
          <div className="hidden sm:block h-5 w-px bg-slate-800" />
          <span className="shrink-0 whitespace-nowrap text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-sky-400 bg-sky-950/60 border border-sky-500/30 px-2 sm:px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            {esPaciente ? 'MIS ESTUDIOS' : 'PACS WORKLIST'}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-5">
          <div className="hidden min-[420px]:flex items-center gap-3 text-xs border-r border-slate-800 pr-5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold">
              {iniciales(nombre)}
            </div>
            <div className="hidden sm:block">
              <p className="font-semibold text-slate-200">{nombre}</p>
              <p className="text-[10px] text-slate-400">{rol ? ETIQUETA_ROL[rol] : ''}</p>
            </div>
          </div>

          <button
            onClick={() => navigate('/cambiar-clave')}
            className="flex min-h-11 min-w-11 items-center justify-center text-slate-400 hover:text-sky-400 transition-colors rounded-lg hover:bg-sky-500/10"
            title="Cambiar clave"
            aria-label="Cambiar clave"
          >
            <KeyRound className="w-4 h-4" />
          </button>

          <button
            onClick={async () => { await logout(); navigate('/login'); }}
            className="flex min-h-11 min-w-11 items-center justify-center text-slate-400 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 p-6 max-w-[1600px] w-full mx-auto space-y-6">

        {/* TARJETAS RESUMEN (calculadas con los estudios cargados) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[#0d1522] border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Estudios</p>
              <p className="text-2xl font-bold text-white mt-1" data-testid="stat-total">{studies.length}</p>
            </div>
            <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl text-sky-400">
              <Activity className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0d1522] border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Estudios de hoy</p>
              <p className="text-2xl font-bold text-amber-400 mt-1" data-testid="stat-hoy">{estudiosHoy}</p>
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0d1522] border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Imágenes</p>
              <p className="text-2xl font-bold text-white mt-1" data-testid="stat-imagenes">{totalImagenes}</p>
            </div>
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
              <FileText className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* BARRA DE BÚSQUEDA Y FILTROS */}
        <div className="p-4 bg-[#0d1522] border border-slate-800 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between">

          {/* Campo de búsqueda */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={esPaciente ? 'Buscar por estudio...' : 'Buscar por Paciente, ID o Estudio...'}
              className="w-full min-h-11 pl-10 pr-4 py-2.5 bg-[#070b11] border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition-all"
            />
          </div>

          {/* Filtro por fecha o rango de fechas (CA05.2) */}
          <div className="flex items-center gap-2 w-full md:w-auto text-xs text-slate-400">
            <label className="flex items-center gap-1.5 shrink-0">
              Desde
              <input
                type="date"
                value={desde}
                max={hasta || undefined}
                onChange={(e) => setDesde(e.target.value)}
                aria-label="Fecha desde"
                className="min-h-11 min-w-0 px-2 py-2 bg-[#070b11] border border-slate-800 rounded-lg text-xs text-slate-200 [color-scheme:dark] focus:outline-none focus:border-sky-400"
              />
            </label>
            <label className="flex items-center gap-1.5 shrink-0">
              Hasta
              <input
                type="date"
                value={hasta}
                min={desde || undefined}
                onChange={(e) => setHasta(e.target.value)}
                aria-label="Fecha hasta"
                className="min-h-11 min-w-0 px-2 py-2 bg-[#070b11] border border-slate-800 rounded-lg text-xs text-slate-200 [color-scheme:dark] focus:outline-none focus:border-sky-400"
              />
            </label>
            {(desde || hasta) && (
              <button
                type="button"
                onClick={() => { setDesde(''); setHasta(''); }}
                className="min-h-11 px-2 py-2 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200"
              >
                Quitar fechas
              </button>
            )}
          </div>

          {/* Filtro por Modalidad (solo las que existen en los estudios cargados) */}
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0 mr-1">
              <Filter className="w-3.5 h-3.5" /> Modalidad:
            </span>
            {modalidades.map((mod) => (
              <button
                key={mod}
                onClick={() => setSelectedModality(mod)}
                className={`min-h-11 min-w-11 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  selectedModality === mod
                    ? 'bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-500/20'
                    : 'bg-[#070b11] text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                {mod}
              </button>
            ))}

            <button
              onClick={() => void cargar()}
              disabled={loading}
              className="flex min-h-11 min-w-11 items-center justify-center bg-[#070b11] border border-slate-800 rounded-lg text-slate-400 hover:text-sky-400 transition-colors ml-2 disabled:opacity-60"
              title="Recargar estudios"
              aria-label="Recargar estudios"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center font-medium"
          >
            {error}
          </div>
        )}

        {/* TABLA DE ESTUDIOS RADIOLÓGICOS */}
        <div className="bg-[#0d1522] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#070b11] text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4">ID Paciente</th>
                  <th className="py-3.5 px-4">Nombre del Paciente</th>
                  <th className="py-3.5 px-4">Edad/Sexo</th>
                  <th className="py-3.5 px-4">Mod.</th>
                  <th className="py-3.5 px-4">Descripción del Estudio</th>
                  <th className="py-3.5 px-4">Fecha / Hora</th>
                  <th className="py-3.5 px-4 text-center">Imágenes</th>
                  <th className="py-3.5 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">Cargando estudios…</td>
                  </tr>
                )}
                {!loading && !error && filteredStudies.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      {studies.length === 0
                        ? 'No hay estudios disponibles.'
                        : 'Ningún estudio coincide con la búsqueda.'}
                    </td>
                  </tr>
                )}
                {!loading && filteredStudies.map((study) => (
                  <tr
                    key={study.uid}
                    className="hover:bg-slate-800/30 transition-colors group cursor-pointer"
                    onClick={() => handleOpenViewer(study.uid)}
                  >
                    <td className="py-3.5 px-4 font-mono text-sky-400 font-medium">
                      {study.patientId}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-white group-hover:text-sky-300 transition-colors">
                      {study.patientName}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">{study.ageSex}</td>
                    <td className="py-3.5 px-4">
                      <span className="bg-sky-950 border border-sky-500/30 text-sky-400 px-2 py-0.5 rounded text-[11px] font-mono font-bold">
                        {study.modalities.join('/') || '—'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-medium">
                      {study.description || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono">
                      {study.studyDate || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-300">
                      {study.instances ?? '—'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenViewer(study.uid)}
                          className="min-h-11 px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-lg shadow-md shadow-sky-500/20 transition-all flex items-center gap-1 text-[11px]"
                        >
                          <Eye className="w-3.5 h-3.5" /> Ver DICOM
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};
