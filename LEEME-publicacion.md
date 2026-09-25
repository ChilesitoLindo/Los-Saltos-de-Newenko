# Publicación en GitHub Pages — carpeta `deploy/`

Carpeta limpia que contiene **solo los archivos de la app** para subir a un hosting estático con HTTPS. No incluye copias de seguridad, interconsultas, specs ni materiales internos del proyecto.

---

## Qué contiene

| Archivo / carpeta | Para qué sirve |
|---|---|
| `index.html` | Punto de entrada de la app |
| `manifest.json` | PWA instalable (iconos, nombre) |
| `sw.js` | Service worker: offline y caché de mosaicos (`CACHE_VERSION`) |
| `.nojekyll` | Evita que GitHub Pages procese los archivos con Jekyll |
| `src/` | Toda la lógica (módulos ES6) |
| `styles/` | Tokens, estilos y responsive |
| `data/` | Ruta GeoJSON, estaciones, sendero y seguridad |
| `assets/` | Iconos, logo, fotos del sendero y jsQR |

**Total: ~9 MB.** No hay backend, no hay claves, no hay base de datos.

---

## Pasos para publicar

1. **Crear el repositorio** en GitHub (cuenta propia): botón *New repository*, nombre sugerido `sendero-newenko`, público, sin README inicial.
2. **Subir el contenido de esta carpeta** (el contenido de `deploy/`, no la carpeta en sí) a la **raíz** del repositorio:
   - *Opción A (web):* `Add file → Upload files` → arrastrar `index.html`, `manifest.json`, `sw.js`, `.nojekyll` y las carpetas `src/`, `styles/`, `data/`, `assets/`.
   - *Opción B (git):* copiar el contenido a una carpeta nueva, `git init` → `git add .` → `git commit -m "inicio"` → `git remote add origin <url>` → `git push -u origin main`.
   - **Además (para que Dependabot y el CI funcionen, ver «Seguridad»):** subir también `package.json`, `scripts/security-check.mjs` y la carpeta `.github/` a la raíz del repositorio. Sin esto el workflow no existe en la rama.
3. **Activar Pages:** en el repo → `Settings → Pages` → *Source:* `Deploy from a branch` → *Branch:* `main` / `(root)` → `Save`.
4. **Esperar ~1 minuto.** La app queda en:
   `https://USUARIO.github.io/REPO/`
5. **Probar en el celular** abriendo esa URL:
   - HTTPS = contexto seguro → **el GPS sí funciona** (a diferencia de abrir el HTML como archivo).
   - Se puede instalar como PWA y el mapa/guía quedan cacheados para offline.

---

## Seguridad (resumen)

- **No hay API keys, tokens ni secretos** en la app — no hay nada que robar del código.
- **Sin backend:** el GPS y el `localStorage` de cada visitante **nunca salen de su teléfono**.
- El único dominio externo al que habla la app es el clima (Open-Meteo, público y sin clave) y los mosaicos OSM/Esri.
- **CSP estricta** (meta en `index.html`) con los dominios exactos de la app; **fuentes self-hosted** (`assets/fonts/`); **SRI + versión fija** para Leaflet; **`no-referrer`** para que `?station=` nunca llegue a terceros; service worker con **allowlist de tiles** (sin cachear cross-origin arbitrarios).
- **Tras el primer push, activar en GitHub Settings (no se puede hacer desde código):** 2FA obligatorio, proteger `main` (PR + revisión, sin push directo), Dependabot alerts y secret scanning. El repositorio incluye `package.json` (manifiesto) y el workflow `.github/workflows/security-check.yml` para que Dependabot y el CI funcionen.
- **Publicar siempre solo esta carpeta**, nunca la raíz del proyecto completo (donde viven copias de seguridad y materiales internos).

---

## Si se cambia código más adelante

Volver a copiar los archivos modificados al repo (`src/`, `styles/`, `sw.js`, `assets/fonts/`, etc.) y hacer push. Si se modifica `sw.js`, **incrementar `CACHE_VERSION`** (p. ej. `newenko-v15` → `newenko-v16`) para que los teléfonos descarguen la versión nueva. El CI `security-check` valida en cada push: sin `eval`/`new Function`/`document.write`, recursos remotos con SRI + versión, whitelist de estaciones y esquema de `data/*.json`. Se puede correr local: `node scripts/security-check.mjs`.

---

## Pendientes antes del lanzamiento oficial (no bloquean la prueba)

- Texto institucional de la pantalla 00 (hoy es de ejemplo).
- Ruta real del sendero (GPX del colega) y coordenadas definitivas de estaciones.
- Dominio definitivo para los QR (la URL de Pages sirve para probar; el QR apunta a la URL final que se decida).
- Confirmar que las fotos de `assets/images/` estén autorizadas para publicación.
