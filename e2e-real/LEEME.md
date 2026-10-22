# Pruebas de punta a punta contra el stack real

Corren el frontend real (puerto 5173), el backend real y Orthanc, en Chromium, Firefox, WebKit (motor de Safari),
y en emulación de celular Android y de iPhone. No usan servidor simulado.

## Antes de correrlas
1. Backend y Orthanc arriba (`docker compose --profile correo-dev start` en `C:\dev\visor-pacs`).
2. Frontend arriba (`npm run dev` en `C:\dev\visor-pacs_frontend`), en otra terminal.

## Instalar (una sola vez)
```powershell
cd C:\dev\visor-pacs_frontend\e2e-real
npm install
npx playwright install chromium firefox webkit
```

## Claves (solo en esta terminal; no se guardan en ningún archivo)
```powershell
$env:E2E_MEDICO_USER = "tu-usuario-medico"
$env:E2E_MEDICO_PASS = Read-Host "Clave del medico"
$env:E2E_PACIENTE_USER = "tu-usuario-paciente"
$env:E2E_PACIENTE_PASS = Read-Host "Clave del paciente"
```
Si no defines una cuenta, las pruebas que la necesitan se omiten.

## Correr
```powershell
npx playwright test 2>&1 | Tee-Object -FilePath ..\salida-e2e-real.txt
```
Solo un navegador: `npx playwright test --project=chromium`. Informe visual: `npx playwright show-report`.

## Qué prueban
| Prueba | Caso |
|---|---|
| Usuario o clave incorrectos: mismo mensaje y no entra (usa un usuario inexistente, no bloquea cuentas reales) | CP-02 |
| El login no tiene scroll horizontal | CP-10 |
| El médico ve la lista de estudios de Orthanc | CP-08 |
| El médico abre un estudio y la imagen se dibuja (más del 1 % de píxeles no negros) | CP-09 |
| El paciente llega a su lista (el conteo se imprime para compararlo a mano con el del médico) | CP-04 |
| /olvide-clave muestra el mensaje genérico (se omite si la recuperación está apagada) | RF-09 |

Cada prueba también falla si hay errores de JavaScript en la página.

## Límites
- WebKit y la emulación de iPhone usan el motor de Safari, pero NO son un iPhone real: CP-17 sigue necesitando un dispositivo físico.
- No reemplazan la prueba manual de gestos táctiles ni los tiempos (CP-15, CP-16).
