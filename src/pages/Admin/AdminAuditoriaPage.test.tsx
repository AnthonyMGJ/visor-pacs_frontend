import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, type AxiosResponse } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAuditoriaPage, formatearFecha } from './AdminAuditoriaPage';
import * as admin from '../../services/admin.service';
import type { EventoAuditoria, Pagina } from '../../types/admin.types';

function evento(parcial: Partial<EventoAuditoria>): EventoAuditoria {
  return {
    id: 1, fecha: '2026-10-16T15:00:00Z', tipo: 'INICIO_SESION', resultado: 'EXITO', idUsuario: 7,
    username: 'ana.perez', rol: 'MEDICO', estudio: null, ip: '10.0.0.5', detalle: null, ...parcial,
  };
}

function pagina(contenido: EventoAuditoria[], extra: Partial<Pagina<EventoAuditoria>> = {}): Pagina<EventoAuditoria> {
  return { contenido, pagina: 0, tamano: 20, total: contenido.length, totalPaginas: 1, ...extra };
}

describe('AdminAuditoriaPage', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('lista los eventos con etiquetas legibles', async () => {
    vi.spyOn(admin, 'listarAuditoria').mockResolvedValue(pagina([
      evento({}),
      evento({ id: 2, tipo: 'APERTURA_ESTUDIO', estudio: '1.2.840.113619.2.1', ip: '10.0.0.6' }),
      evento({ id: 3, tipo: 'INICIO_SESION', resultado: 'FALLO', username: 'desconocido', rol: null, detalle: 'clave incorrecta' }),
    ]));
    render(<AdminAuditoriaPage />);
    expect(await screen.findByText('Apertura de estudio')).toBeInTheDocument();
    expect(screen.getByText('1.2.840.113619.2.1')).toBeInTheDocument();
    const filas = screen.getAllByRole('row');
    expect(within(filas[3]!).getByText('Fallo')).toBeInTheDocument();
    expect(within(filas[3]!).getByText('clave incorrecta')).toBeInTheDocument();
    expect(within(filas[1]!).getByText('Éxito')).toBeInTheDocument();
    expect(within(filas[1]!).getByText('(MEDICO)')).toBeInTheDocument();
  });

  it('un tipo de evento desconocido se muestra tal cual', async () => {
    vi.spyOn(admin, 'listarAuditoria').mockResolvedValue(pagina([evento({ tipo: 'EVENTO_FUTURO' })]));
    render(<AdminAuditoriaPage />);
    expect(await screen.findByText('EVENTO_FUTURO')).toBeInTheDocument();
  });

  it('sin eventos muestra el mensaje vacío', async () => {
    vi.spyOn(admin, 'listarAuditoria').mockResolvedValue(pagina([]));
    render(<AdminAuditoriaPage />);
    expect(await screen.findByText('No hay eventos con esos filtros.')).toBeInTheDocument();
  });

  it('si falla la consulta muestra el error', async () => {
    vi.spyOn(admin, 'listarAuditoria').mockRejectedValue(
      new AxiosError('x', 'ERR', undefined, undefined, { status: 403, data: null } as AxiosResponse),
    );
    render(<AdminAuditoriaPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permiso para esta operación.');
  });

  it('aplica los filtros al buscar y los limpia con Limpiar', async () => {
    const listar = vi.spyOn(admin, 'listarAuditoria').mockResolvedValue(pagina([evento({})]));
    render(<AdminAuditoriaPage />);
    await screen.findByText('ana.perez');

    await userEvent.type(screen.getByLabelText('Usuario'), 'ana');
    await userEvent.selectOptions(screen.getByLabelText('Evento'), 'APERTURA_ESTUDIO');
    await userEvent.selectOptions(screen.getByLabelText('Resultado'), 'FALLO');
    await userEvent.type(screen.getByLabelText('Estudio (UID)'), '1.2.3');
    await userEvent.type(screen.getByLabelText('Desde'), '2026-10-16T08:00');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({
      usuario: 'ana', tipo: 'APERTURA_ESTUDIO', resultado: 'FALLO', estudio: '1.2.3', desde: '2026-10-16T08:00', pagina: 0,
    })));

    await userEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    await waitFor(() => expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ usuario: '', tipo: '', pagina: 0 })));
    expect(screen.getByLabelText('Usuario')).toHaveValue('');
  });

  it('cambiar de página conserva los filtros ya aplicados', async () => {
    const listar = vi.spyOn(admin, 'listarAuditoria').mockResolvedValue(pagina([evento({})], { total: 60, totalPaginas: 3 }));
    render(<AdminAuditoriaPage />);
    await screen.findByText('ana.perez');
    await userEvent.type(screen.getByLabelText('Usuario'), 'ana');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ usuario: 'ana' })));

    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await waitFor(() => expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ usuario: 'ana', pagina: 1 })));
  });

  it('no ofrece ninguna acción de edición o borrado: la auditoría es de solo lectura', async () => {
    vi.spyOn(admin, 'listarAuditoria').mockResolvedValue(pagina([evento({})]));
    render(<AdminAuditoriaPage />);
    await screen.findByText('ana.perez');
    expect(screen.queryByRole('button', { name: /Editar|Eliminar|Borrar/ })).not.toBeInTheDocument();
  });

  it('formatearFecha deja pasar un texto que no es fecha', () => {
    expect(formatearFecha('no-es-fecha')).toBe('no-es-fecha');
    expect(formatearFecha('2026-10-16T15:00:00Z')).not.toBe('2026-10-16T15:00:00Z');
  });
});
