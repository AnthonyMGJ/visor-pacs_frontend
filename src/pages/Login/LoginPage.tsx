import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, User, Eye, EyeOff, CheckCircle2, ShieldCheck, Database, Headphones } from 'lucide-react';

// Importa las imágenes guardadas en tu proyecto (ajusta la ruta según tu carpeta de assets)
import doctorImage from '../../assets/doctor-pacs.jpg';
import leesLogo from '../../assets/logo-lees.png';
import { login, mensajeDeError } from '../../services/auth.service';
import { recuperacionHabilitada } from '../../config/funciones';
import { rutaInicio } from '../../routes/rutas';
import { consultarMotivoSalida, descartarMotivoSalida, useAuthStore, type MotivoSalida } from '../../store/auth.store';

const AVISO_SALIDA: Record<MotivoSalida, string> = {
  sesion: 'Tu sesión terminó. Inicia sesión nuevamente.',
  inactividad: 'Tu sesión se cerró por inactividad. Inicia sesión nuevamente.',
};

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Aviso de por qué volvió al login (sesión vencida, revocada o por inactividad); se muestra una sola vez.
  const [aviso] = useState<MotivoSalida | null>(() => consultarMotivoSalida());
  useEffect(() => {
    descartarMotivoSalida();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Por favor, ingresa tus credenciales completas.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login({ username, password });
      const { rol, debeCambiarClave } = useAuthStore.getState();
      // Clave temporal (restablecida por el administrador): primero debe cambiarla.
      navigate(debeCambiarClave ? '/cambiar-clave' : rutaInicio(rol));
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#070b11] flex select-none overflow-hidden font-sans">
      {/* SECCIÓN IZQUIERDA: Portada con Imagen de la Radióloga y Escáner LED */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#09101d] flex-col justify-between p-12 overflow-hidden border-r border-slate-800/60">
        
        {/* Imagen Médica de Fondo (Radióloga con Computadora PACS) */}
        <div className="absolute inset-0 z-0">
          <img 
            src={doctorImage} 
            alt="Especialista analizando imagen médica PACS" 
            className="w-full h-full object-cover opacity-35 filter contrast-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#070b11] via-[#09101d]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-sky-950/20 to-[#070b11]" />
        </div>

        {/* LÍNEA DE ESCANEO LED ANIMADA */}
        <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-sky-400 to-transparent z-10 animate-laser shadow-[0_0_15px_#38bdf8,0_0_25px_#38bdf8]">
          <div className="w-full h-12 -mt-6 bg-gradient-to-b from-sky-500/20 to-transparent pointer-events-none" />
        </div>

        {/* Header Superior Izquierdo */}
        <div className="relative z-20 flex items-center gap-3">
          <span className="inline-flex items-center gap-2 bg-sky-950/80 border border-sky-500/30 text-sky-400 px-3.5 py-1 rounded-full text-xs font-semibold tracking-wider uppercase backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            SISTEMA PACS ACTIVO
          </span>
        </div>

        {/* Texto Informativo Principal */}
        <div className="relative z-20 my-auto max-w-lg space-y-6">
          <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight tracking-tight">
            Diagnóstico <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-300 to-blue-500">
              Radiológico Digital 
            </span>
          </h1>
          <p className="text-slate-300 text-sm xl:text-base leading-relaxed">
            Plataforma integral para gestión y diagnóstico de estudios de imágenes médicas con estándares DICOM Nacionales de la marca <strong className="text-sky-400">LEES</strong>
          </p>

          <div className="space-y-3 pt-2">
            {[
              'Visor DICOM avanzado con herramientas de medición',
              'Workflow integrado de diagnóstico radiológico',
              'Notificaciones multicanal a pacientes y médicos',
              'Control de acceso granular por roles y permisos'
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 text-slate-200 text-xs xl:text-sm">
                <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-20 text-xs text-slate-400 font-mono">
          © {new Date().getFullYear()} LEES Salud & Tecnología . Todos los derechos reservados.
        </div>
      </div>

      {/* SECCIÓN DERECHA: Formulario de Login con el Logo Oficial LEES */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-6 sm:p-12 bg-[#070b11] relative z-20">
        <div className="w-full max-w-md mx-auto my-auto space-y-8">
          
          {/* LOGO OFICIAL LEES (ENCIMA DE "BIENVENIDO DE NUEVO") */}
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <img 
                src={leesLogo} 
                alt="Logo LEES" 
                className="h-20 w-auto object-contain drop-shadow-[0_0_12px_rgba(56,189,248,0.3)]"
              />
            </div>

            <h2 className="text-2xl font-bold text-white tracking-tight pt-2">
              Bienvenido de nuevo
            </h2>
            <p className="text-xs text-slate-400">
              Ingresa tus credenciales para continuar al portal
            </p>
          </div>

          {aviso && !error && (
            <div role="status" className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs text-center font-medium">
              {AVISO_SALIDA[aviso]}
            </div>
          )}

          {error && (
            <div role="alert" className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Usuario
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ingresa tu usuario"
                  className="w-full pl-10 pr-4 py-3 bg-[#0d1522] border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 text-sm transition-all shadow-inner"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Contraseña
                </label>
                {recuperacionHabilitada() && (
                  <Link to="/olvide-clave" className="text-xs text-sky-400 hover:text-sky-300 min-h-6 inline-flex items-center">
                    ¿Olvidaste tu contraseña?
                  </Link>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 bg-[#0d1522] border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 text-sm transition-all shadow-inner"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 min-w-11 pr-3.5 flex items-center justify-end text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="disabled:opacity-60 w-full py-3.5 px-4 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-sky-500/20 hover:shadow-sky-500/30 transition-all duration-200 active:scale-[0.99] text-sm flex items-center justify-center gap-2"
            >
              {loading ? 'Ingresando…' : 'Iniciar sesión →'}
            </button>
          </form>

          <div className="pt-6 border-t border-slate-800/80 flex items-center justify-around text-slate-400 text-[11px]">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-400" /> Conexión segura
            </span>
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-sky-400" /> Datos cifrados
            </span>
            <span className="flex items-center gap-1.5">
              <Headphones className="w-3.5 h-3.5 text-sky-400" /> Soporte 24/7
            </span>
          </div>
        </div>

        <div className="text-center text-xs text-slate-500 pt-6 lg:hidden">
          © {new Date().getFullYear()} LEES Salud & Tecnología . Todos los derechos reservados.
        </div>
      </div>
    </div>
  );
};