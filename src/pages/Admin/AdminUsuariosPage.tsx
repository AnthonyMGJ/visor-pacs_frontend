import { Ban, CheckCircle2, Copy, KeyRound, Pencil, Plus, Search, ShieldCheck, ShieldOff } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { Modal } from '../../components/Modal';
import { Paginacion } from '../../components/Paginacion';
import {
  cambiarEstado, crearUsuario, editarUsuario, listarUsuarios, otorgarPermiso, restablecerClave, revocarPermiso,
} from '../../services/admin.service';
import { CLAVE_MINIMA, mensajeDeErrorAdmin } from '../../services/auth.service';
import {
  PERMISO_ACCESO_ESTUDIOS, type EdicionUsuario, type NuevoUsuario, type Pagina, type UsuarioAdmin,
} from '../../types/admin.types';
import { ETIQUETA_ROL, esRolValido } from '../../types/auth.types';

const USUARIO_VALIDO = /^[A-Za-z0-9._-]{3,50}$/;
const CORREO_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const entrada =
  'w-full px-3 py-2 bg-[#070b11] border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400 text-sm';
const etiqueta = 'block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1';
const botonSecundario = 'rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800';
const botonPrimario = 'rounded-lg bg-sky-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-60';
const accion = 'rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100';

export function validarNuevoUsuario(d: NuevoUsuario): string | null {
  if (!USUARIO_VALIDO.test(d.username.trim())) {
    return 'El usuario debe tener de 3 a 50 caracteres: letras, números, punto, guion o guion bajo.';
  }
  if (d.clave.length < CLAVE_MINIMA) return `La clave inicial debe tener al menos ${CLAVE_MINIMA} caracteres.`;
  if (!d.nombres.trim() || !d.apellidos.trim()) return 'Escribe los nombres y los apellidos.';
  if (!CORREO_VALIDO.test(d.email.trim())) return 'El correo no tiene un formato válido.';
  if (d.rol === 'PACIENTE' && !d.dicomPacienteId?.trim()) {
    return 'Para un paciente indica su PatientID DICOM (el de sus estudios en Orthanc).';
  }
  return null;
}

type Confirmacion = { titulo: string; mensaje: string; textoAceptar: string; onAceptar: () => Promise<void> };

export const AdminUsuariosPage: React.FC = () => {
  const [pagina, setPagina] = useState<Pagina<UsuarioAdmin> | null>(null);
  const [nroPagina, setNroPagina] = useState(0);
  const [q, setQ] = useState('');
  const [rol, setRol] = useState('');
  const [estado, setEstado] = useState(''); // '' | 'true' | 'false'
  const [filtro, setFiltro] = useState({ q: '', rol: '', estado: '' });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<UsuarioAdmin | null>(null);
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
  const [claveTemporal, setClaveTemporal] = useState<{ usuario: string; clave: string } | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      setPagina(await listarUsuarios({
        q: filtro.q, rol: filtro.rol, activo: filtro.estado === '' ? undefined : filtro.estado === 'true', pagina: nroPagina,
      }));
    } catch (err) {
      setError(mensajeDeErrorAdmin(err));
    } finally {
      setCargando(false);
    }
  }, [filtro, nroPagina]);

  useEffect(() => { void cargar(); }, [cargar]);

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    setNroPagina(0);
    setFiltro({ q, rol, estado });
  };

  const reemplazar = (u: UsuarioAdmin) =>
    setPagina((p) => (p ? { ...p, contenido: p.contenido.map((x) => (x.id === u.id ? u : x)) } : p));

  /** Ejecuta una acción sobre una cuenta y muestra el error del servidor si falla. */
  const ejecutar = async (accionAsync: () => Promise<void>, exito?: string) => {
    setError('');
    setAviso('');
    try {
      await accionAsync();
      if (exito) setAviso(exito);
    } catch (err) {
      setError(mensajeDeErrorAdmin(err));
    }
  };

  const pedirCambioDeEstado = (u: UsuarioAdmin) => {
    const activar = !u.activo;
    const hacer = () => ejecutar(async () => reemplazar(await cambiarEstado(u.id, activar)),
      activar ? `Cuenta ${u.username} activada.` : `Cuenta ${u.username} desactivada: su sesión abierta se cierra en su siguiente solicitud.`);
    if (activar) { void hacer(); return; }
    setConfirmacion({
      titulo: 'Desactivar cuenta',
      mensaje: `¿Desactivar la cuenta ${u.username}? No podrá iniciar sesión y su sesión abierta dejará de valer.`,
      textoAceptar: 'Desactivar',
      onAceptar: hacer,
    });
  };

  const alternarAcceso = (u: UsuarioAdmin) => {
    const tiene = u.permisos.includes(PERMISO_ACCESO_ESTUDIOS);
    void ejecutar(async () => reemplazar(tiene
      ? await revocarPermiso(u.id, PERMISO_ACCESO_ESTUDIOS)
      : await otorgarPermiso(u.id, PERMISO_ACCESO_ESTUDIOS)),
    tiene ? `Se revocó el acceso a estudios de ${u.username}.` : `Se otorgó el acceso a estudios a ${u.username}.`);
  };

  const pedirRestablecer = (u: UsuarioAdmin) =>
    setConfirmacion({
      titulo: 'Restablecer clave',
      mensaje: `Se generará una clave temporal para ${u.username}, se cerrarán sus sesiones y deberá cambiarla al entrar. ¿Continuar?`,
      textoAceptar: 'Restablecer',
      onAceptar: () => ejecutar(async () => {
        const clave = await restablecerClave(u.id);
        setClaveTemporal({ usuario: u.username, clave });
        await cargar();
      }),
    });

  return (
    <section aria-labelledby="titulo-cuentas" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="titulo-cuentas" className="text-xl font-bold text-white">Cuentas</h1>
        <button type="button" className={`${botonPrimario} flex items-center gap-2`} onClick={() => setCreando(true)}>
          <Plus className="h-4 w-4" /> Nueva cuenta
        </button>
      </div>

      <form onSubmit={buscar} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-800 bg-[#0d1522] p-4 sm:grid-cols-[2fr_1fr_1fr_auto]">
        <div>
          <label htmlFor="f-q" className={etiqueta}>Buscar</label>
          <input id="f-q" className={entrada} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Usuario, nombre o correo" />
        </div>
        <div>
          <label htmlFor="f-rol" className={etiqueta}>Rol</label>
          <select id="f-rol" className={entrada} value={rol} onChange={(e) => setRol(e.target.value)}>
            <option value="">Todos</option>
            <option value="MEDICO">Médico</option>
            <option value="PACIENTE">Paciente</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-estado" className={etiqueta}>Estado</label>
          <select id="f-estado" className={entrada} value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option>
            <option value="true">Activas</option>
            <option value="false">Inactivas</option>
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" className={`${botonSecundario} flex w-full items-center justify-center gap-2`}>
            <Search className="h-4 w-4" /> Buscar
          </button>
        </div>
      </form>

      {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-medium text-red-400">{error}</div>}
      {aviso && <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-medium text-emerald-300">{aviso}</div>}

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0d1522]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Correo</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Acceso a estudios</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Cargando…</td></tr>}
            {!cargando && pagina?.contenido.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">No hay cuentas con esos filtros.</td></tr>
            )}
            {!cargando && pagina?.contenido.map((u) => {
              const esMedico = u.rol === 'MEDICO';
              const tieneAcceso = u.permisos.includes(PERMISO_ACCESO_ESTUDIOS);
              return (
                <tr key={u.id} className="border-b border-slate-800/60 last:border-0">
                  <td className="px-4 py-3 font-semibold text-slate-100">{u.username}</td>
                  <td className="px-4 py-3">{u.nombres} {u.apellidos}</td>
                  <td className="px-4 py-3 text-slate-300">{u.email}</td>
                  <td className="px-4 py-3">{esRolValido(u.rol) ? ETIQUETA_ROL[u.rol] : u.rol}</td>
                  <td className="px-4 py-3">
                    <span className={u.activo ? 'text-emerald-400' : 'text-slate-400'}>{u.activo ? 'Activa' : 'Inactiva'}</span>
                    {u.bloqueado && <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">Bloqueada</span>}
                  </td>
                  <td className="px-4 py-3">{esMedico ? (tieneAcceso ? 'Sí' : 'No') : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" className={accion} title="Editar" aria-label={`Editar ${u.username}`} onClick={() => setEditando(u)}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      {esMedico && (
                        <button type="button" className={accion} onClick={() => alternarAcceso(u)}
                          title={tieneAcceso ? 'Revocar acceso a estudios' : 'Otorgar acceso a estudios'}
                          aria-label={`${tieneAcceso ? 'Revocar' : 'Otorgar'} acceso a estudios de ${u.username}`}>
                          {tieneAcceso ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                        </button>
                      )}
                      <button type="button" className={accion} title="Restablecer clave" aria-label={`Restablecer clave de ${u.username}`}
                        onClick={() => pedirRestablecer(u)}>
                        <KeyRound className="h-4 w-4" />
                      </button>
                      <button type="button" className={accion} onClick={() => pedirCambioDeEstado(u)}
                        title={u.activo ? 'Desactivar' : 'Activar'} aria-label={`${u.activo ? 'Desactivar' : 'Activar'} ${u.username}`}>
                        {u.activo ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pagina && <Paginacion pagina={pagina.pagina} totalPaginas={pagina.totalPaginas} total={pagina.total} onCambiar={setNroPagina} />}

      {creando && (
        <FormularioNuevaCuenta
          onCerrar={() => setCreando(false)}
          onCreada={async (u) => { setCreando(false); setAviso(`Cuenta ${u.username} creada.`); await cargar(); }}
        />
      )}
      {editando && (
        <FormularioEdicion
          usuario={editando}
          onCerrar={() => setEditando(null)}
          onGuardada={(u) => { reemplazar(u); setEditando(null); setAviso(`Cuenta ${u.username} actualizada.`); }}
        />
      )}
      {confirmacion && (
        <Modal titulo={confirmacion.titulo} onCerrar={() => setConfirmacion(null)}>
          <p className="text-sm text-slate-300">{confirmacion.mensaje}</p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className={botonSecundario} onClick={() => setConfirmacion(null)}>Cancelar</button>
            <button type="button" className={botonPrimario}
              onClick={async () => { const c = confirmacion; setConfirmacion(null); await c.onAceptar(); }}>
              {confirmacion.textoAceptar}
            </button>
          </div>
        </Modal>
      )}
      {claveTemporal && (
        <Modal titulo="Clave temporal" onCerrar={() => setClaveTemporal(null)}>
          <p className="text-sm text-slate-300">
            Entrega esta clave a <strong>{claveTemporal.usuario}</strong> por un canal seguro. Se muestra una sola vez y el sistema no la conserva;
            deberá cambiarla al iniciar sesión.
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-700 bg-[#070b11] p-3">
            <code data-testid="clave-temporal" className="flex-1 select-all break-all font-mono text-base text-sky-300">{claveTemporal.clave}</code>
            <button type="button" className={`${botonSecundario} flex items-center gap-1.5`}
              onClick={() => { void navigator.clipboard?.writeText(claveTemporal.clave); }}>
              <Copy className="h-3.5 w-3.5" /> Copiar
            </button>
          </div>
          <div className="mt-5 flex justify-end">
            <button type="button" className={botonPrimario} onClick={() => setClaveTemporal(null)}>Listo</button>
          </div>
        </Modal>
      )}
    </section>
  );
};

function FormularioNuevaCuenta({ onCerrar, onCreada }: { onCerrar: () => void; onCreada: (u: UsuarioAdmin) => Promise<void> }) {
  const [d, setD] = useState<NuevoUsuario>({ username: '', clave: '', nombres: '', apellidos: '', email: '', rol: 'MEDICO', dicomPacienteId: '' });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const poner = (campoNombre: keyof NuevoUsuario) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setD((x) => ({ ...x, [campoNombre]: e.target.value }));

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const problema = validarNuevoUsuario(d);
    if (problema) { setError(problema); return; }
    setError('');
    setGuardando(true);
    try {
      await onCreada(await crearUsuario({ ...d, username: d.username.trim(), email: d.email.trim() }));
    } catch (err) {
      setError(mensajeDeErrorAdmin(err));
      setGuardando(false);
    }
  };

  return (
    <Modal titulo="Nueva cuenta" onCerrar={onCerrar}>
      <form onSubmit={enviar} className="space-y-3" noValidate>
        {error && <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">{error}</div>}
        <div>
          <label htmlFor="n-rol" className={etiqueta}>Rol</label>
          <select id="n-rol" className={entrada} value={d.rol} onChange={poner('rol')}>
            <option value="MEDICO">Médico</option>
            <option value="PACIENTE">Paciente</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label htmlFor="n-nombres" className={etiqueta}>Nombres</label><input id="n-nombres" className={entrada} value={d.nombres} onChange={poner('nombres')} /></div>
          <div><label htmlFor="n-apellidos" className={etiqueta}>Apellidos</label><input id="n-apellidos" className={entrada} value={d.apellidos} onChange={poner('apellidos')} /></div>
        </div>
        <div><label htmlFor="n-email" className={etiqueta}>Correo</label><input id="n-email" type="email" className={entrada} value={d.email} onChange={poner('email')} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label htmlFor="n-usuario" className={etiqueta}>Usuario</label><input id="n-usuario" className={entrada} value={d.username} onChange={poner('username')} autoComplete="off" /></div>
          <div><label htmlFor="n-clave" className={etiqueta}>Clave inicial</label><input id="n-clave" type="password" className={entrada} value={d.clave} onChange={poner('clave')} autoComplete="new-password" /></div>
        </div>
        {d.rol === 'PACIENTE' && (
          <div>
            <label htmlFor="n-dicom" className={etiqueta}>PatientID DICOM</label>
            <input id="n-dicom" className={entrada} value={d.dicomPacienteId ?? ''} onChange={poner('dicomPacienteId')} placeholder="Ej.: PRUEBA-0001" />
            <p className="mt-1 text-[11px] text-slate-500">Debe coincidir exactamente con el PatientID de sus estudios en Orthanc.</p>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={botonSecundario} onClick={onCerrar}>Cancelar</button>
          <button type="submit" className={botonPrimario} disabled={guardando}>{guardando ? 'Guardando…' : 'Crear cuenta'}</button>
        </div>
      </form>
    </Modal>
  );
}

function FormularioEdicion({ usuario, onCerrar, onGuardada }: {
  usuario: UsuarioAdmin; onCerrar: () => void; onGuardada: (u: UsuarioAdmin) => void;
}) {
  const [d, setD] = useState<EdicionUsuario>({ nombres: usuario.nombres, apellidos: usuario.apellidos, email: usuario.email });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!d.nombres.trim() || !d.apellidos.trim()) { setError('Escribe los nombres y los apellidos.'); return; }
    if (!CORREO_VALIDO.test(d.email.trim())) { setError('El correo no tiene un formato válido.'); return; }
    setError('');
    setGuardando(true);
    try {
      onGuardada(await editarUsuario(usuario.id, { ...d, email: d.email.trim() }));
    } catch (err) {
      setError(mensajeDeErrorAdmin(err));
      setGuardando(false);
    }
  };

  return (
    <Modal titulo={`Editar ${usuario.username}`} onCerrar={onCerrar}>
      <form onSubmit={enviar} className="space-y-3" noValidate>
        {error && <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div><label htmlFor="e-nombres" className={etiqueta}>Nombres</label><input id="e-nombres" className={entrada} value={d.nombres} onChange={(e) => setD({ ...d, nombres: e.target.value })} /></div>
          <div><label htmlFor="e-apellidos" className={etiqueta}>Apellidos</label><input id="e-apellidos" className={entrada} value={d.apellidos} onChange={(e) => setD({ ...d, apellidos: e.target.value })} /></div>
        </div>
        <div><label htmlFor="e-email" className={etiqueta}>Correo</label><input id="e-email" type="email" className={entrada} value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} /></div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={botonSecundario} onClick={onCerrar}>Cancelar</button>
          <button type="submit" className={botonPrimario} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </form>
    </Modal>
  );
}
