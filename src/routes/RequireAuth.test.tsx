import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { RequireAuth } from './RequireAuth';
import { useAuthStore } from '../store/auth.store';
import type { Rol } from '../types/auth.types';

function montar(roles?: readonly Rol[], inicial = '/privada') {
  render(
    <MemoryRouter initialEntries={[inicial]}>
      <Routes>
        <Route path="/login" element={<div>pantalla login</div>} />
        <Route element={<RequireAuth roles={roles} />}>
          <Route path="/privada" element={<div>contenido privado</div>} />
          <Route path="/cambiar-clave" element={<div>pantalla cambiar clave</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAuth', () => {
  beforeEach(() => useAuthStore.getState().clear());

  it('sin sesión manda al login', () => {
    montar();
    expect(screen.getByText('pantalla login')).toBeInTheDocument();
  });

  it('con sesión de médico deja pasar', () => {
    useAuthStore.getState().setSession('t', 900, 'MEDICO', 'Ana');
    montar();
    expect(screen.getByText('contenido privado')).toBeInTheDocument();
  });

  it('con sesión de paciente deja pasar por defecto', () => {
    useAuthStore.getState().setSession('t', 900, 'PACIENTE', 'Juan');
    montar();
    expect(screen.getByText('contenido privado')).toBeInTheDocument();
  });

  it('con sesión vencida manda al login', () => {
    useAuthStore.getState().setSession('t', -1, 'MEDICO', 'Ana');
    montar();
    expect(screen.getByText('pantalla login')).toBeInTheDocument();
  });

  it('si el rol no está en la lista permitida manda al login', () => {
    useAuthStore.getState().setSession('t', 900, 'PACIENTE', 'Juan');
    montar(['MEDICO']);
    expect(screen.getByText('pantalla login')).toBeInTheDocument();
    expect(screen.queryByText('contenido privado')).not.toBeInTheDocument();
  });

  it('un ADMIN entra a las rutas de administración y no a las de médicos y pacientes', () => {
    useAuthStore.getState().setSession('t', 900, 'ADMIN', 'Luz');
    montar(['ADMIN']);
    expect(screen.getByText('contenido privado')).toBeInTheDocument();
  });

  it('un ADMIN no entra a las rutas de imágenes', () => {
    useAuthStore.getState().setSession('t', 900, 'ADMIN', 'Luz');
    montar(['MEDICO', 'PACIENTE']);
    expect(screen.getByText('pantalla login')).toBeInTheDocument();
    expect(screen.queryByText('contenido privado')).not.toBeInTheDocument();
  });

  it('un médico o un paciente no entran a las rutas de administración', () => {
    useAuthStore.getState().setSession('t', 900, 'MEDICO', 'Ana');
    montar(['ADMIN']);
    expect(screen.getByText('pantalla login')).toBeInTheDocument();
  });

  it('con clave temporal todo lleva a cambiar la clave', () => {
    useAuthStore.getState().setSession('t', 900, 'MEDICO', 'Ana', true);
    montar();
    expect(screen.getByText('pantalla cambiar clave')).toBeInTheDocument();
    expect(screen.queryByText('contenido privado')).not.toBeInTheDocument();
  });

  it('con clave temporal la pantalla de cambiar la clave sí se muestra', () => {
    useAuthStore.getState().setSession('t', 900, 'MEDICO', 'Ana', true);
    montar(undefined, '/cambiar-clave');
    expect(screen.getByText('pantalla cambiar clave')).toBeInTheDocument();
  });
});
