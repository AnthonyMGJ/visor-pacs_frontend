# Visor PACS – frontend (base reconstruida)

Requisitos: Node 20+ y el backend en http://localhost:8080 (Docker levantado).

    npm install
    npx tsc --noEmit
    npm test
    npm run build
    npm run dev        # http://localhost:5173  (proxy /api -> http://localhost:8080)

- Variables: copia `.env.example` a `.env` solo si necesitas cambiar `VITE_PROXY_TARGET` o `VITE_API_URL`.
- Reemplaza `src/assets/logo-lees.png` y `src/assets/doctor-pacs.jpg`: son imagenes de relleno generadas.
- El visor es solo de referencia, no apto para diagnostico.
