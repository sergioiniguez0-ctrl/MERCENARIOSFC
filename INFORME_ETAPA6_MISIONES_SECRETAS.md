# Mercenarios FC — Informe de la etapa 6 (Misiones Secretas) — entrega FINAL

## 1. Qué se corrigió en esta última vuelta

Respecto de la entrega anterior de la etapa 6 (que ya había corregido rachas,
tipos mal conectados y textos no demostrables), esta entrega agrega lo que
faltaba para que el sistema esté realmente conectado y sea seguro de usar:

1. **Conectado con la aplicación.** `assignMissionIfNeeded` y `evaluateAssignment`
   ahora se llaman desde `src/App.jsx`, no solo existen como funciones sueltas.
2. **Flujo administrativo "Próxima fecha"** (pestaña Configuración, solo admin):
   fecha, modalidad F8/F9, selección de convocados, y un botón "Confirmar y
   asignar misiones" que dispara una asignación por convocado. Sin capitanes,
   presupuesto, draft ni equipos — eso es de otra etapa.
3. **Vínculo con el partido disputado.** Al cargar el resultado real desde
   "Partidos", si hay una convocatoria confirmada pendiente, aparece un
   checkbox para vincularlo; al guardar, se evalúan (una sola vez) las
   misiones de esos convocados.
4. **Bloqueo real, no solo de interfaz.** `assignMissionIfNeeded` ahora
   RECHAZA (con excepción) cualquier intento de asignar sobre un partido que
   no sea F8/F9, que ya tenga estadísticas cargadas, o cuya fecha no sea
   estrictamente posterior a todos los partidos oficiales ya guardados.
5. **Persistencia sin condición de carrera.** Cada asignación vive en su
   propia clave de Firestore (`missionAssignment:<matchId>_<playerId>`), no en
   un array único compartido. Procesar varios convocados en paralelo (por
   ejemplo con `Promise.all`) ya no puede perder asignaciones.
6. **Rachas sobre el calendario ordenado.** `buildSquadFacts` ordena por fecha
   internamente, sin confiar en el orden de entrada del array.

## 2. Cómo funciona el flujo completo ahora

1. El administrador entra a **Configuración → Próxima fecha**, carga fecha,
   modalidad y convocados, y presiona **"Confirmar y asignar misiones"**.
   Ahí (y solo ahí) se llama a `assignMissionIfNeeded` para cada convocado.
2. Cada jugador ve, en su perfil (pestaña Misiones), únicamente el aviso
   discreto **"Tenés una misión activa para la próxima fecha"** — nunca el
   contenido.
3. Cuando el partido se juega, el administrador lo carga desde **Partidos →
   Agregar partido**, tildando **"Vincular con la convocatoria pendiente"**.
   Al guardar, se llama a `evaluateAssignment` una vez por convocado.
4. Si la misión se cumplió, pasa a `completed` y recién ahí aparece en el
   perfil del jugador, con su nombre, descripción y texto de revelación. Si no
   se cumplió, pasa a `expired` y no se muestra nunca en ningún lado.
5. Falta un partido de vincular pero no se marca el checkbox: el partido se
   guarda igual, normalmente, y la convocatoria sigue pendiente hasta que se
   la vincule o el administrador la descarte a mano.

## 3. Nivel de secreto real (sin cambios respecto a la entrega anterior)

Este proyecto **no tiene Firebase Auth**. El "administrador" es una
contraseña verificada en el navegador (`src/lib/auth.js`), y todas las
lecturas/escrituras a Firestore pasan por `window.storage`
(`src/lib/storagePolyfill.js`) sin ningún token de identidad. **Las reglas de
Firestore actuales, sean cuales sean, no pueden distinguir administrador de
jugador ni de cualquier visitante.**

En la práctica: la interfaz normal de la app **nunca** muestra el contenido
de una misión activa (el código lo oculta con `toPublicView` y con las
funciones que solo devuelven misiones `completed`). Pero alguien que abra la
consola del navegador y consulte Firestore directamente con el SDK (usando el
mismo `firebaseConfig` que ya viaja público en el build, como en cualquier
app cliente de Firebase) **sí podría leer el documento completo**, incluido
el título y la condición de la misión — exactamente igual que hoy puede leer
`players` o `matches`. No es un control de acceso real, es una convención de
interfaz. Esta entrega **no modifica Firebase Auth ni las reglas de
Firestore**, tal como se pidió.

### Propuesta de reglas futuras (NO aplicada — requiere Firebase Auth real)

```
match /mercenarios/shared/missionAssignment/{assignmentId} {
  // Documento "público": sin missionSnapshot, solo estado.
  allow read: if true;
}
match /mercenarios/shared/missionAssignmentPrivate/{assignmentId} {
  // Documento con el contenido real de la misión.
  allow read, write: if request.auth != null && request.auth.token.admin == true;
}
```
Esto requeriría separar cada asignación en dos documentos y agregar sign-in
real para el administrador — ninguna de las dos cosas está hecha ni se aplicó
en esta entrega.

## 4. Archivos modificados y nuevos

- **Nuevo:** `src/lib/upcomingMatchday.js` — borrador de convocatoria.
- **Reescrito:** `src/lib/secretMissionsStore.js` — persistencia por registro
  independiente, bloqueo de partidos históricos/jugados/no-oficiales.
- **Modificado:** `src/lib/secretMissions.js` — `buildSquadFacts` ahora ordena
  internamente; se agregó `sortOfficialMatches` reutilizable.
- **Modificado:** `src/App.jsx` — conecta el flujo (`addMatch`,
  `saveUpcomingDraft`, `confirmUpcomingDraft`, `discardUpcomingDraft`), agrega
  el panel "Próxima fecha" y el checkbox de vínculo en "Agregar partido".
- **Reemplazado:** este informe (antes describía una corrección de avatares
  que no correspondía a esta etapa).

## 5. Firestore: qué cambia

Una clave nueva por asignación: `missionAssignment:<matchId>_<playerId>`
(documento compartido, mismo patrón que `players`/`matches`/`votes`) y una
clave única `upcomingMatchday` para el borrador de convocatoria. Nada
existente se modifica, ni se cambian reglas de seguridad.

## 6. Resultado de las pruebas y del build

Ver el resumen exacto en la respuesta del chat que acompaña este ZIP —
incluye la salida real de cada uno de los 6 scripts de verificación pedidos,
y el estado exacto de `npm install`/`npm run build` en este entorno.
