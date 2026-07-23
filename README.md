# Mercenarios FC — Estadísticas

App de estadísticas para el equipo amateur "Mercenarios FC": ranking individual,
partidos, perfiles de jugador estilo ficha, estadísticas del plantel y votación
de figura del partido. Hecha con React + Vite + Tailwind.

## Estructura del proyecto

```
mercenarios-fc-app/
├── index.html              # HTML raíz (viewport mobile, título, favicon)
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── src/
│   ├── main.jsx             # Punto de entrada, monta <App />
│   ├── App.jsx               # Toda la app (lógica + interfaz)
│   ├── index.css             # Directivas de Tailwind
│   └── lib/
│       └── storagePolyfill.js  # Ver nota abajo
```

## Sobre el guardado de datos

La app guarda jugadores, partidos, votos y "quién sos" usando una API
`window.storage`. Esa API es propia del entorno de Artifacts de Claude.ai y
**no existe en un navegador común**. Para que el proyecto funcione igual en
Vercel o en tu celular, `src/lib/storagePolyfill.js` implementa la misma
interfaz (`get/set/delete/list`) usando `localStorage` del navegador.

No se tocó ninguna línea de lógica de `App.jsx`: el polyfill se carga antes
de montar la app y `App.jsx` sigue llamando a `window.storage` exactamente
igual que antes.

**Importante:** con `localStorage`, los datos quedan guardados en el
navegador/dispositivo de cada persona, no en un servidor compartido. Si dos
personas entran desde celulares distintos, cada una tiene su propia copia de
los datos (jugadores, partidos, votos). Si más adelante querés que todo el
equipo vea los mismos datos en tiempo real, hay que sumar un backend (por
ejemplo Supabase, Firebase o una API propia) — avisame y lo armamos.

## Acceso de administrador

La app tiene un login simple para que solo el administrador pueda cargar y
editar jugadores y partidos. Cualquier visitante puede seguir viendo todo
(ranking, estadísticas, partidos, votar la figura del partido) sin iniciar
sesión — el login solo desbloquea los botones de "Sumar jugador", "Cargar
partido", editar/borrar y cerrar votación.

**Usuario y contraseña por defecto:**
- Usuario: `admin`
- Contraseña: `mercenarios2026`

Se accede desde la pestaña **Ajustes → Acceso administrador**, o tocando el
candado que aparece arriba a la derecha en el encabezado.

**Importante:** esta es una app 100% frontend, sin servidor propio, así que
esta verificación corre en el navegador — no es un login de nivel bancario.
Alcanza para que el grupo no edite datos sin querer o por curiosidad, pero
alguien con muchos conocimientos técnicos podría revisar el código del
build. Te recomendamos cambiar la contraseña por defecto antes de compartir
el link, configurando estas variables de entorno antes de compilar (por
ejemplo en Vercel → Settings → Environment Variables):

```
VITE_ADMIN_USER=tu-usuario
VITE_ADMIN_PASS_HASH=hash-sha256-de-tu-contraseña
```

Para generar el hash, abrí la consola del navegador (F12) en cualquier
página y ejecutá:

```js
crypto.subtle.digest("SHA-256", new TextEncoder().encode("tu-contraseña-nueva"))
  .then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2,"0")).join("")))
```

y copiá el resultado como valor de `VITE_ADMIN_PASS_HASH`.

La sesión de administrador se guarda solo en el navegador/dispositivo desde
el que se inició sesión (igual que "quién sos"), así que cada dispositivo
necesita loguearse por separado.

## Desarrollo local

Requisitos: Node.js 18 o superior.

```bash
npm install
npm run dev
```

Abre la URL que te muestra la terminal (por defecto `http://localhost:5173`).

Para probarla desde tu celular en la misma red Wi-Fi, `vite.config.js` ya
tiene `server.host = true`: correla con `npm run dev` y entrá desde el
celular a `http://<IP-de-tu-compu>:5173`.

## Build de producción

```bash
npm run build
npm run preview   # para revisar el build localmente
```

El build queda en `dist/`.

## Desplegar en Vercel

Opción A — CLI (la más rápida):

```bash
npm i -g vercel
vercel login
vercel        # deploy de prueba
vercel --prod # deploy definitivo
```

Vercel detecta automáticamente que es un proyecto Vite (build command
`vite build`, output `dist`), no hace falta configurar nada más.

Opción B — Dashboard de Vercel:

1. Subí esta carpeta a un repositorio de GitHub/GitLab/Bitbucket.
2. En [vercel.com](https://vercel.com) → "Add New… → Project" → importá el repo.
3. Framework Preset: "Vite" (se detecta solo). Deploy.
4. Vercel te da un enlace (`https://tu-proyecto.vercel.app`) que podés abrir
   directamente desde el navegador del celular — no hace falta instalar nada.

## Notas

- Los íconos son de [lucide-react](https://lucide.dev) y los gráficos de
  [recharts](https://recharts.org), ambos ya declarados en `package.json`.
- La tipografía usa Google Fonts (Rajdhani, Oswald, Bebas Neue) cargadas por
  `@import` dentro de `App.jsx`, así que la primera carga necesita conexión
  a internet para verse con esas fuentes (si no hay conexión, cae a las
  fuentes del sistema).
