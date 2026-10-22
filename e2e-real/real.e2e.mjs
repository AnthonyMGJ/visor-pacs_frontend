
// Pruebas contra el stack REAL: frontend (5173) + backend + Orthanc.
// Variables (opcionales; si faltan, esa prueba se omite):
//   E2E_MEDICO_USER / E2E_MEDICO_PASS      cuenta de médico con acceso a estudios
//   E2E_PACIENTE_USER / E2E_PACIENTE_PASS  cuenta de paciente
// El caso de clave incorrecta usa un usuario que NO existe, para no bloquear ninguna cuenta real.
import { test, expect } from '@playwright/test';

const MEDICO = { u: process.env.E2E_MEDICO_USER, p: process.env.E2E_MEDICO_PASS };
const PACIENTE = { u: process.env.E2E_PACIENTE_USER, p: process.env.E2E_PACIENTE_PASS };

async function entrar(page, usuario, clave) {
  await page.goto('/login');
  await page.getByPlaceholder('Ingresa tu usuario').fill(usuario);
  await page.getByPlaceholder('••••••••').fill(clave);
  await page.getByRole('button', { name: /Iniciar sesión/ }).click();
}

/** Mide cuántos píxeles del lienzo NO son negros. Usa una captura del elemento, que funciona igual en los tres navegadores. */
async function pixelesNoNegros(page, lienzo) {
  const png = await lienzo.screenshot();
  return page.evaluate(async (b64) => {
    const img = new Image();
    await new Promise((ok, mal) => { img.onload = ok; img.onerror = mal; img.src = 'data:image/png;base64,' + b64; });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 30) n++;
    return { noNegros: n, total: d.length / 4 };
  }, png.toString('base64'));
}

test.beforeEach(async ({ page }) => {
  page.errores = [];
  page.on('pageerror', (e) => page.errores.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(page.errores, 'errores de JavaScript en la página').toEqual([]);
});

test('CP-02: usuario o clave incorrectos muestran el mismo mensaje y no entran', async ({ page }) => {
  await entrar(page, 'usuario.inexistente.e2e', 'Clave-Incorrecta-123');
  await expect(page.getByText('Usuario o contraseña incorrectos.')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test('CP-10: el login no tiene scroll horizontal en esta pantalla', async ({ page }) => {
  await page.goto('/login');
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(sobra).toBeLessThanOrEqual(0);
});

test('CP-08: el médico ve la lista de estudios de Orthanc', async ({ page }) => {
  test.skip(!MEDICO.u || !MEDICO.p, 'faltan E2E_MEDICO_USER y E2E_MEDICO_PASS');
  await entrar(page, MEDICO.u, MEDICO.p);
  await page.waitForURL('**/studies');
  await expect(page.getByRole('button', { name: /Ver DICOM/ }).first()).toBeVisible();
  const filas = await page.getByRole('button', { name: /Ver DICOM/ }).count();
  console.log(`   estudios en la lista: ${filas}`);
  expect(filas).toBeGreaterThan(0);
});

test('CP-09: el médico abre un estudio y la imagen se dibuja (no sale en negro)', async ({ page }) => {
  test.skip(!MEDICO.u || !MEDICO.p, 'faltan E2E_MEDICO_USER y E2E_MEDICO_PASS');
  await entrar(page, MEDICO.u, MEDICO.p);
  await page.waitForURL('**/studies');
  await page.getByRole('button', { name: /Ver DICOM/ }).first().click();
  await page.waitForURL('**/viewer/**');
  // Con una sola serie el visor la abre solo; con varias muestra primero la lista (CA02.4) y hay que elegir una.
  const indice = page.getByTestId('visor-indice');
  const botonesSerie = page.getByRole('navigation', { name: 'Series del estudio' }).getByRole('button');
  await Promise.race([
    indice.waitFor({ timeout: 30_000 }),
    botonesSerie.first().waitFor({ timeout: 30_000 }),
  ]).catch(() => {});
  if (!(await indice.isVisible())) {
    console.log(`   el estudio tiene ${await botonesSerie.count()} series: se elige la primera`);
    await botonesSerie.first().click();
  }
  await expect(indice).toBeVisible({ timeout: 45_000 });
  const lienzo = page.getByTestId('lienzo');
  await expect(lienzo).toBeVisible();
  await page.waitForTimeout(2500); // deja terminar la carga y el dibujo
  const { noNegros, total } = await pixelesNoNegros(page, lienzo);
  const pct = ((noNegros / total) * 100).toFixed(1);
  console.log(`   píxeles no negros: ${noNegros} de ${total} (${pct} %)`);
  expect(noNegros / total).toBeGreaterThan(0.01);
});

test('CP-04: el paciente llega a su lista de estudios', async ({ page }) => {
  test.skip(!PACIENTE.u || !PACIENTE.p, 'faltan E2E_PACIENTE_USER y E2E_PACIENTE_PASS');
  await entrar(page, PACIENTE.u, PACIENTE.p);
  await page.waitForURL('**/studies');
  // Espera a que termine la carga: o aparece un estudio, o el aviso de lista vacía. Contar antes daba 0 falso.
  const ver = page.getByRole('button', { name: /Ver DICOM/ });
  await expect(ver.first().or(page.getByText(/No hay estudios disponibles/))).toBeVisible();
  const filas = await ver.count();
  console.log(`   estudios del paciente: ${filas} (a mano: deben ser un subconjunto de los del médico)`);
});

test('RF-09: /olvide-clave muestra el mismo mensaje genérico para un correo inexistente', async ({ page }) => {
  await page.goto('/login');
  const enlace = page.getByRole('link', { name: '¿Olvidaste tu contraseña?' });
  test.skip(!(await enlace.isVisible().catch(() => false)), 'la recuperación de clave está apagada en este stack');
  await enlace.click();
  await page.getByLabel(/correo/i).fill('nadie.e2e@correo.pe');
  await page.getByRole('button', { name: /Enviar enlace/ }).click();
  await expect(page.getByText(/Si el correo está registrado/)).toBeVisible();
});
