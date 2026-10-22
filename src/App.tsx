import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/Login/LoginPage';
import { StudiesPage } from './pages/Studies/StudiesPage';
import { ViewerPage } from './pages/Viewer/ViewerPage';
import { CambiarClavePage } from './pages/Cuenta/CambiarClavePage';
import { AdminLayout } from './pages/Admin/AdminLayout';
import { AdminUsuariosPage } from './pages/Admin/AdminUsuariosPage';
import { AdminAuditoriaPage } from './pages/Admin/AdminAuditoriaPage';
import { OlvideClavePage } from './pages/Recuperacion/OlvideClavePage';
import { NuevaClavePage } from './pages/Recuperacion/NuevaClavePage';
import { recuperacionHabilitada } from './config/funciones';
import { RequireAuth } from './routes/RequireAuth';
import { ROLES_CON_IMAGENES } from './types/auth.types';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirige de la raíz al login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/login" element={<LoginPage />} />

        {/* RF-09: recuperación de clave por correo (públicas). Solo existen con VITE_RECUPERACION_HABILITADA=true. */}
        {recuperacionHabilitada() && <Route path="/olvide-clave" element={<OlvideClavePage />} />}
        {recuperacionHabilitada() && <Route path="/nueva-clave" element={<NuevaClavePage />} />}

        {/* Cualquier rol con sesión: cambiar la clave (obligatorio si la clave es temporal). */}
        <Route element={<RequireAuth />}>
          <Route path="/cambiar-clave" element={<CambiarClavePage />} />
        </Route>

        {/* Imágenes: solo médico y paciente. El administrador nunca ve imágenes. */}
        <Route element={<RequireAuth roles={ROLES_CON_IMAGENES} />}>
          <Route path="/studies" element={<StudiesPage />} />
          <Route path="/viewer/:studyId" element={<ViewerPage />} />
        </Route>

        {/* Administración: cuentas, permisos y auditoría. */}
        <Route element={<RequireAuth roles={['ADMIN']} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminUsuariosPage />} />
            <Route path="/admin/auditoria" element={<AdminAuditoriaPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
