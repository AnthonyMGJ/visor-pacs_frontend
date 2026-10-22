import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Backend al que el servidor de desarrollo reenvía "/api". Se puede cambiar con VITE_PROXY_TARGET.
const BACKEND = process.env.VITE_PROXY_TARGET ?? 'http://localhost:8080';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true, // permite abrir desde el celular por la IP de la PC
    // Con el proxy, el navegador habla solo con este origen: no hace falta CORS ni VITE_API_URL.
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
    },
  },
  // Cornerstone: el cargador DICOM usa web workers y WASM, así que no se pre-empaqueta; pero sus códecs son
  // módulos antiguos (UMD) y sí necesitan pre-empaquetarse para que el navegador pueda importarlos.
  optimizeDeps: {
    exclude: ['@cornerstonejs/dicom-image-loader'],
    include: [
      'dicom-parser',
      '@cornerstonejs/dicom-image-loader > @cornerstonejs/codec-charls/decodewasmjs',
      '@cornerstonejs/dicom-image-loader > @cornerstonejs/codec-libjpeg-turbo-8bit/decodewasmjs',
      '@cornerstonejs/dicom-image-loader > @cornerstonejs/codec-openjpeg/decodewasmjs',
      '@cornerstonejs/dicom-image-loader > @cornerstonejs/codec-openjph/wasmjs',
    ],
  },
  worker: { format: 'es' },
  build: {
    // El visor (Cornerstone) pesa ~1,6 MB, pero se descarga aparte y solo al abrir un estudio.
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
