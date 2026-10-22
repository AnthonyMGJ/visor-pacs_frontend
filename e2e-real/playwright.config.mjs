// Pruebas de punta a punta contra el stack REAL. Las claves se leen de variables de entorno; nunca se escriben aquí.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.e2e.mjs',        // el sufijo .e2e.mjs evita que Vitest las recoja
  timeout: 90_000,
  expect: { timeout: 20_000 },
  workers: 1,                        // en serie: el login tiene límite por IP (30 por minuto)
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },          // motor de Safari
    { name: 'celular-android', use: { ...devices['Pixel 7'] } },        // Chromium con pantalla y toques de celular
    { name: 'iphone', use: { ...devices['iPhone 14'] } },               // WebKit con pantalla y toques de iPhone
  ],
});
