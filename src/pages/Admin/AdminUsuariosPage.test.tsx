import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, type AxiosResponse } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminUsuariosPage, validarNuevoUsuario } from './AdminUsuariosPage';
import * as admin from '../../services/admin.service';
import type { Pagina, UsuarioAdmin } from '../../types/admin.types';

function usuario(parcial: Partial<UsuarioAdmin>): UsuarioAdmin {
  return {
    id: 1, username: 'ana.perez', nombres: 'Ana', apellidos: 'Pérez', email: 'ana@clinica.pe', rol: 'MEDICO',
    activo: true, bloqueado: false, dicomPacienteId: null, permisos: ['ACCESO_ESTUDIOS'], ...parcial,
  };
}

function pagina(contenido: UsuarioAdmin[], extra: Partial<Pagina<UsuarioAdmin>> = {}): Pagina<UsuarioAdmin> {
  return { contenido, pagina: 0, tamano: 20, total: contenido.length, totalPaginas: 1, ...extra };
}

function errorHttp(status: number, detail?: string) {
  return new AxiosError('x', 'ERR', undefined, undefined, { status, data: detail ? { detail } : null } as AxiosResponse);
}

const ANA = usuario({});
const JUAN = usuario({ id: 2, username: 'juan.diaz', nombres: 'Juan', apellidos: 'Díaz', email: 'juan@correo.pe', rol: 'PACIENTE', dicomPacienteId: 'PRUEBA-0001', permisos: [] });
const LUZ = usuario({ id: 3, username: 'luz.rojas', nombres: 'Luz', apellidos: 'Rojas', email: 'luz@clinica.pe', rol: 'ADMIN', permisos: [] });

describe('validarNuevoUsuario', () => {
  const base = { username: 'ana.perez', clave: 'una-clave-larga-1', nombres: 'Ana', apellidos: 'Pérez', email: 'ana@clinica.pe', rol: 'MEDICO' as const };

  it('acepta un médico completo y rechaza cada dato inválido', () => {
    expect(validarNuevoUsuario(base)).toBeNull();
    expect(validarNuevoUsuario({ ...base, username: 'a b' })).toMatch(/usuario debe tener/);
    expect(validarNuevoUsuario({ ...base, clave: 'corta' })).toMatch(/al menos 12/);
    expect(validarNuevoUsuario({ ...base, nombres: ' ' })).toMatch(/nombres/);
    expect(validarNuevoUsuario({ ...base, email: 'sin-arroba' })).toMatch(/correo/);
  });

  it('un paciente necesita su PatientID', () => {
    expect(validarNuevoUsuario({ ...base, rol: 'PACIENTE', dicomPacienteId: '' })).toMatch(/PatientID/);
    expect(validarNuevoUsuario({ ...base, rol: 'PACIENTE', dicomPacienteId: 'PRUEBA-0001' })).toBeNull();
  });
});

describe('AdminUsuariosPage', () => {
  beforeEach(() => vi.restoreAllMocks());

  async function montar(usuarios: UsuarioAdmin[] = [ANA, JUAN, LUZ]) {
    const listar = vi.spyOn(admin, 'listarUsuarios').mockResolvedValue(pagina(usuarios));
    render(<AdminUsuariosPage />);
    await screen.findByText(usuarios[0]?.username ?? 'No hay cuentas con esos filtros.');
    return listar;
  }

  it('lista las cuentas con rol, estado y acceso a estudios', async () => {
    await montar();
    const filaAna = screen.getByText('ana.perez').closest('tr')!;
    expect(within(filaAna).getByText('Médico')).toBeInTheDocument();
    expect(within(filaAna).getByText('Activa')).toBeInTheDocument();
    expect(within(filaAna).getByText('Sí')).toBeInTheDocument();
    const filaJuan = screen.getByText('juan.diaz').closest('tr')!;
    expect(within(filaJuan).getByText('Paciente')).toBeInTheDocument();
    expect(within(filaJuan).getByText('—')).toBeInTheDocument(); // el paciente no tiene "acceso a estudios"
    expect(within(screen.getByText('luz.rojas').closest('tr')!).getByText('Administrador')).toBeInTheDocument();
  });

  it('marca las cuentas bloqueadas e inactivas', async () => {
    await montar([usuario({ bloqueado: true, activo: false })]);
    expect(screen.getByText('Bloqueada')).toBeInTheDocument();
    expect(screen.getByText('Inactiva')).toBeInTheDocument();
  });

  it('sin resultados muestra el mensaje vacío', async () => {
    await montar([]);
    expect(screen.getByText('No hay cuentas con esos filtros.')).toBeInTheDocument();
  });

  it('si falla la carga muestra el error', async () => {
    vi.spyOn(admin, 'listarUsuarios').mockRejectedValue(errorHttp(403));
    render(<AdminUsuariosPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permiso para esta operación.');
  });

  it('los filtros se aplican al buscar y vuelven a la primera página', async () => {
    const listar = await montar();
    await userEvent.type(screen.getByLabelText('Buscar'), 'ana');
    await userEvent.selectOptions(screen.getByLabelText('Rol'), 'MEDICO');
    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'false');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(listar).toHaveBeenLastCalledWith({ q: 'ana', rol: 'MEDICO', activo: false, pagina: 0 }));
  });

  it('la paginación pide la página siguiente', async () => {
    const listar = vi.spyOn(admin, 'listarUsuarios').mockResolvedValue(pagina([ANA], { total: 45, totalPaginas: 3 }));
    render(<AdminUsuariosPage />);
    await screen.findByText('ana.perez');
    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await waitFor(() => expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ pagina: 1 })));
  });

  // ---- activar / desactivar ----

  it('desactivar pide confirmación y luego actualiza la fila', async () => {
    await montar();
    const cambiar = vi.spyOn(admin, 'cambiarEstado').mockResolvedValue({ ...ANA, activo: false });
    await userEvent.click(screen.getByRole('button', { name: 'Desactivar ana.perez' }));
    expect(cambiar).not.toHaveBeenCalled();
    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveTextContent(/¿Desactivar la cuenta ana.perez\?/);
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Desactivar' }));
    await waitFor(() => expect(cambiar).toHaveBeenCalledWith(1, false));
    expect(await screen.findByText('Inactiva')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/desactivada/);
  });

  it('cancelar la confirmación no cambia nada', async () => {
    await montar();
    const cambiar = vi.spyOn(admin, 'cambiarEstado');
    await userEvent.click(screen.getByRole('button', { name: 'Desactivar ana.perez' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(cambiar).not.toHaveBeenCalled();
  });

  it('activar una cuenta inactiva no pide confirmación', async () => {
    await montar([usuario({ activo: false })]);
    const cambiar = vi.spyOn(admin, 'cambiarEstado').mockResolvedValue(ANA);
    await userEvent.click(screen.getByRole('button', { name: 'Activar ana.perez' }));
    await waitFor(() => expect(cambiar).toHaveBeenCalledWith(1, true));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('si el servidor rechaza (p. ej. desactivarse a sí mismo) muestra su explicación y deja la fila igual', async () => {
    await montar([LUZ]);
    vi.spyOn(admin, 'cambiarEstado').mockRejectedValue(errorHttp(409, 'No puedes desactivar tu propia cuenta.'));
    await userEvent.click(screen.getByRole('button', { name: 'Desactivar luz.rojas' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desactivar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No puedes desactivar tu propia cuenta.');
    expect(screen.getByText('Activa')).toBeInTheDocument();
  });

  // ---- permisos ----

  it('revocar el acceso a estudios de un médico actualiza la fila', async () => {
    await montar();
    const revocar = vi.spyOn(admin, 'revocarPermiso').mockResolvedValue({ ...ANA, permisos: [] });
    await userEvent.click(screen.getByRole('button', { name: 'Revocar acceso a estudios de ana.perez' }));
    await waitFor(() => expect(revocar).toHaveBeenCalledWith(1, 'ACCESO_ESTUDIOS'));
    expect(within(screen.getByText('ana.perez').closest('tr')!).getByText('No')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Otorgar acceso a estudios de ana.perez' })).toBeInTheDocument();
  });

  it('otorgar el acceso a un médico que no lo tiene', async () => {
    await montar([usuario({ permisos: [] })]);
    const otorgar = vi.spyOn(admin, 'otorgarPermiso').mockResolvedValue(ANA);
    await userEvent.click(screen.getByRole('button', { name: 'Otorgar acceso a estudios de ana.perez' }));
    await waitFor(() => expect(otorgar).toHaveBeenCalledWith(1, 'ACCESO_ESTUDIOS'));
  });

  it('solo los médicos tienen botón de permisos', async () => {
    await montar();
    expect(screen.queryByRole('button', { name: /acceso a estudios de juan.diaz/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /acceso a estudios de luz.rojas/ })).not.toBeInTheDocument();
  });

  // ---- restablecer clave ----

  it('restablecer la clave muestra la temporal una sola vez', async () => {
    await montar();
    const restablecer = vi.spyOn(admin, 'restablecerClave').mockResolvedValue('Temporal23456789');
    await userEvent.click(screen.getByRole('button', { name: 'Restablecer clave de ana.perez' }));
    expect(restablecer).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Restablecer' }));

    const dialogo = await screen.findByRole('dialog', { name: 'Clave temporal' });
    expect(within(dialogo).getByTestId('clave-temporal')).toHaveTextContent('Temporal23456789');
    expect(restablecer).toHaveBeenCalledWith(1);

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Listo' }));
    expect(screen.queryByText('Temporal23456789')).not.toBeInTheDocument();
  });

  it('si no se puede restablecer (p. ej. tu propia clave) muestra el motivo y no abre la clave', async () => {
    await montar([LUZ]);
    vi.spyOn(admin, 'restablecerClave').mockRejectedValue(errorHttp(409, 'Para cambiar tu propia clave usa la opción de cambiar clave.'));
    await userEvent.click(screen.getByRole('button', { name: 'Restablecer clave de luz.rojas' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Restablecer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/cambiar tu propia clave/);
    expect(screen.queryByTestId('clave-temporal')).not.toBeInTheDocument();
  });

  // ---- crear ----

  async function abrirNueva() {
    await userEvent.click(screen.getByRole('button', { name: /Nueva cuenta/ }));
    return screen.getByRole('dialog', { name: 'Nueva cuenta' });
  }

  async function llenarNueva(d: HTMLElement, v: { nombres?: string; apellidos?: string; email?: string; usuario?: string; clave?: string }) {
    if (v.nombres) await userEvent.type(within(d).getByLabelText('Nombres'), v.nombres);
    if (v.apellidos) await userEvent.type(within(d).getByLabelText('Apellidos'), v.apellidos);
    if (v.email) await userEvent.type(within(d).getByLabelText('Correo'), v.email);
    if (v.usuario) await userEvent.type(within(d).getByLabelText('Usuario'), v.usuario);
    if (v.clave) await userEvent.type(within(d).getByLabelText('Clave inicial'), v.clave);
  }

  it('crear un médico envía los datos y recarga la lista', async () => {
    const listar = await montar();
    const crear = vi.spyOn(admin, 'crearUsuario').mockResolvedValue(usuario({ id: 9, username: 'nuevo.medico' }));
    const d = await abrirNueva();
    await llenarNueva(d, { nombres: 'Carlos', apellidos: 'Mendoza', email: 'carlos@clinica.pe', usuario: 'nuevo.medico', clave: 'una-clave-larga-1' });
    await userEvent.click(within(d).getByRole('button', { name: 'Crear cuenta' }));

    await waitFor(() => expect(crear).toHaveBeenCalledWith(expect.objectContaining({
      username: 'nuevo.medico', rol: 'MEDICO', nombres: 'Carlos', apellidos: 'Mendoza', email: 'carlos@clinica.pe',
    })));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent('Cuenta nuevo.medico creada.');
    expect(listar.mock.calls.length).toBeGreaterThanOrEqual(2); // se recargó
  });

  it('crear un paciente pide el PatientID', async () => {
    await montar();
    const crear = vi.spyOn(admin, 'crearUsuario').mockResolvedValue(JUAN);
    const d = await abrirNueva();
    await userEvent.selectOptions(within(d).getByLabelText('Rol'), 'PACIENTE');
    await llenarNueva(d, { nombres: 'Juan', apellidos: 'Díaz', email: 'juan@correo.pe', usuario: 'juan.diaz', clave: 'una-clave-larga-1' });
    await userEvent.click(within(d).getByRole('button', { name: 'Crear cuenta' }));
    expect(await within(d).findByRole('alert')).toHaveTextContent(/PatientID/);
    expect(crear).not.toHaveBeenCalled();

    await userEvent.type(within(d).getByLabelText('PatientID DICOM'), 'PRUEBA-0001');
    await userEvent.click(within(d).getByRole('button', { name: 'Crear cuenta' }));
    await waitFor(() => expect(crear).toHaveBeenCalledWith(expect.objectContaining({ rol: 'PACIENTE', dicomPacienteId: 'PRUEBA-0001' })));
  });

  it('un médico no muestra el campo de PatientID', async () => {
    await montar();
    const d = await abrirNueva();
    expect(within(d).queryByLabelText('PatientID DICOM')).not.toBeInTheDocument();
  });

  it('con datos inválidos no llama al servidor', async () => {
    await montar();
    const crear = vi.spyOn(admin, 'crearUsuario');
    const d = await abrirNueva();
    await llenarNueva(d, { nombres: 'Carlos', apellidos: 'Mendoza', email: 'carlos@clinica.pe', usuario: 'nuevo.medico', clave: 'corta' });
    await userEvent.click(within(d).getByRole('button', { name: 'Crear cuenta' }));
    expect(await within(d).findByRole('alert')).toHaveTextContent(/al menos 12/);
    expect(crear).not.toHaveBeenCalled();
  });

  it('si el servidor dice que el usuario ya existe, lo muestra y deja el formulario abierto', async () => {
    await montar();
    vi.spyOn(admin, 'crearUsuario').mockRejectedValue(errorHttp(409, 'Ya existe un usuario con ese nombre de usuario.'));
    const d = await abrirNueva();
    await llenarNueva(d, { nombres: 'Carlos', apellidos: 'Mendoza', email: 'carlos@clinica.pe', usuario: 'ana.perez', clave: 'una-clave-larga-1' });
    await userEvent.click(within(d).getByRole('button', { name: 'Crear cuenta' }));
    expect(await within(d).findByRole('alert')).toHaveTextContent('Ya existe un usuario con ese nombre de usuario.');
    expect(screen.getByRole('dialog', { name: 'Nueva cuenta' })).toBeInTheDocument();
  });

  it('Esc cierra el formulario', async () => {
    await montar();
    await abrirNueva();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // ---- editar ----

  it('editar precarga los datos y actualiza la fila', async () => {
    await montar();
    const editar = vi.spyOn(admin, 'editarUsuario').mockResolvedValue({ ...ANA, nombres: 'Ana María' });
    await userEvent.click(screen.getByRole('button', { name: 'Editar ana.perez' }));
    const d = screen.getByRole('dialog', { name: 'Editar ana.perez' });
    expect(within(d).getByLabelText('Nombres')).toHaveValue('Ana');
    expect(within(d).getByLabelText('Correo')).toHaveValue('ana@clinica.pe');

    await userEvent.clear(within(d).getByLabelText('Nombres'));
    await userEvent.type(within(d).getByLabelText('Nombres'), 'Ana María');
    await userEvent.click(within(d).getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(editar).toHaveBeenCalledWith(1, { nombres: 'Ana María', apellidos: 'Pérez', email: 'ana@clinica.pe' }));
    expect(await screen.findByText('Ana María Pérez')).toBeInTheDocument();
  });

  it('editar con un correo inválido no llama al servidor', async () => {
    await montar();
    const editar = vi.spyOn(admin, 'editarUsuario');
    await userEvent.click(screen.getByRole('button', { name: 'Editar ana.perez' }));
    const d = screen.getByRole('dialog');
    await userEvent.clear(within(d).getByLabelText('Correo'));
    await userEvent.type(within(d).getByLabelText('Correo'), 'sin-arroba');
    await userEvent.click(within(d).getByRole('button', { name: 'Guardar cambios' }));
    expect(await within(d).findByRole('alert')).toHaveTextContent(/correo/);
    expect(editar).not.toHaveBeenCalled();
  });
});
