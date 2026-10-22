import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { modoTexturaForzado } from './viewer/gpu';

// Si la dirección trae ?gpu=liviana|normal, se recuerda en la pestaña antes de que la app cambie de dirección.
try {
  modoTexturaForzado(window.location.search, window.sessionStorage);
} catch {
  /* almacenamiento bloqueado: se ignora */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
