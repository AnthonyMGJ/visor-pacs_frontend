import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { SesionVigilante } from '../components/SesionVigilante';
import { useAuthStore } from '../store/auth.store';
import { ROLES_VALIDOS, type Rol } from '../types/auth.types';

interface Props {
  /** Roles que pueden entrar a estas rutas. Por defecto, todos los que maneja la aplicación. */
  roles?: readonly Rol[];
}

/**
 * Exige sesión vigente y, además, que el rol de la sesión esté permitido.
 * Si la cuenta tiene una clave temporal, solo deja ver la pantalla de cambio de clave.
 * Mientras la sesión está abierta, SesionVigilante la mantiene viva con la actividad y avisa antes de vencer.
 */
export function RequireAuth({ roles = ROLES_VALIDOS }: Props) {
  const location = useLocation();
  const permitido = useAuthStore(
    (s) => !!s.token && !!s.expiresAt && s.expiresAt > Date.now() && !!s.rol && roles.includes(s.rol),
  );
  const claveTemporal = useAuthStore((s) => s.debeCambiarClave);

  if (!permitido) return <Navigate to="/login" replace />;
  if (claveTemporal && location.pathname !== '/cambiar-clave') {
    return <Navigate to="/cambiar-clave" replace />;
  }
  return (
    <>
      <SesionVigilante />
      <Outlet />
    </>
  );
}
