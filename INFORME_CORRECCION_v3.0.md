# Mercenarios FC — Informe de corrección v3.0

## Qué pasó con los avatares (causa real del problema)
Los 15 avatares que se ven en la app **sí son, y siempre fueron, los del
sprite sheet original que subiste** (`1000395025.png`) — no se generó,
reemplazó ni inventó ningún personaje nuevo. Verificado de nuevo en esta
corrección: los 15 PNG en `src/assets/avatars/` tienen el mismo contenido
exacto (mismo hash) que los recortados directamente de tu sprite sheet.

El problema era otro: en la entrega anterior, el avatar de un jugador
**solo se asignaba si el administrador entraba a "Editar jugador" y lo
elegía a mano**. Como ningún jugador del plantel actual tenía ese paso
hecho todavía, la app mostraba para todos el **ícono genérico de silueta
por posición** (un dibujo lineal simple que ya existía en el proyecto
desde antes de esta actualización, como respaldo para cuando no hay
avatar cargado). Eso es lo que viste y, con razón, no correspondía — pero
no eran "otros avatares que no pertenecen al sprite sheet": eran el
mismo ícono de reserva de siempre, mostrado porque todavía no se había
asignado ningún avatar pixel art a nadie.

## Corrección aplicada
Un solo archivo modificado: `src/App.jsx` (nada de Firebase, Firestore,
ranking, estadísticas, partidos, votación ni autenticación).

1. **Asignación automática de avatares a jugadores existentes**: la
   primera vez que la app carga con este código, todo jugador que todavía
   no tenga avatar asignado recibe uno de los 15 sprites del sprite sheet
   original, en forma determinística (mismo jugador → mismo avatar
   siempre) y se guarda. Esto hace que **todo el plantel actual pase a
   mostrar su sprite pixel art real de inmediato**, sin que el
   administrador tenga que editar jugador por jugador.
   - Como hay 17 jugadores en el plantel actual y 15 avatares en el
     sprite sheet, 2 jugadores van a compartir sprite con otro
     compañero (se reparten por orden, ciclando). Es una consecuencia
     matemática de tener más jugadores que avatares en la imagen que
     subiste, no un error. El administrador puede reasignar cualquier
     avatar a cualquier jugador cuando quiera desde "Editar jugador".
2. **Jugadores nuevos**: si heoy en día el administrador carga un jugador
   sin elegir avatar a propósito, ahora también recibe automáticamente un
   sprite del sprite sheet (en vez de caer en el ícono genérico). Si el
   administrador sí elige uno en la grilla, se respeta esa elección.
3. El sistema de avatares en sí (recorte, carga automática de
   `src/assets/avatars/`, selector en el formulario de jugador) **no se
   tocó** porque ya funcionaba correctamente — el punto 1 y 2 de arriba
   son los únicos cambios de este archivo.

No se agregó ningún avatar nuevo ni se modificó ningún PNG existente.

## Perfil del jugador — sección "Información"
Se revisó de nuevo el código de esa sección (ya estaba implementada en la
entrega anterior, no fue necesario tocar nada ahí) y se confirma que
funciona como corresponde:
- Pestaña **"Información"** dentro del perfil de cada jugador (junto a
  Carta / Evolución / Logros).
- Muestra, en este orden: **Avatar** (grande, arriba), **Nombre**,
  **Dorsal**, **Posición**, **Edad**, **Pie dominante**.
- **Edad** y **Pie dominante** se editan desde "Editar jugador" (solo
  administrador) y se guardan junto con el resto de los datos del
  jugador en Firestore.
- Si un jugador no tiene edad o pie dominante cargados, se muestra
  literalmente **"No especificado"** en cada campo, tal como pediste.

Con la corrección del punto 1, ahora esa sección también va a mostrar el
avatar correcto para cada jugador (antes mostraba el ícono genérico, por
la misma causa explicada arriba).

## Revisión final
- ✅ Los 15 avatares en `src/assets/avatars/` son exactamente los del
  sprite sheet original (mismo contenido, verificado por hash) — ningún
  personaje inventado ni reemplazado.
- ✅ Todos los jugadores (plantel actual y los que se carguen de acá en
  adelante) muestran un avatar del sprite sheet, no el ícono genérico.
- ✅ Edad se muestra correctamente en el perfil ("No especificado" si no
  está cargada).
- ✅ Pie dominante se muestra correctamente en el perfil ("No
  especificado" si no está cargado).
- ✅ No se modificó Firebase, Firestore, ranking, estadísticas, sistema
  de partidos, sistema de votación, autenticación ni ningún componente
  que ya funcionaba. El cambio quedó acotado a `src/App.jsx`, y dentro de
  ese archivo, a las dos funciones puntuales de carga/alta de jugadores
  (se puede confirmar línea por línea: son ~20 líneas agregadas en total).

## Limitación del entorno (igual que en la entrega anterior)
Este entorno de trabajo no tiene acceso a internet, así que no pude
correr `npm install` ni `npm run dev` para una vista previa en vivo
dentro del chat. Sí verifiqué que el proyecto compila sin errores de
sintaxis ni imports rotos (bundling completo con esbuild, sin errores).
Te recomiendo correr `npm install && npm run dev` de tu lado y confirmar
visualmente que los 17 jugadores ya muestran su sprite y que la pestaña
"Información" del perfil se ve como corresponde.
