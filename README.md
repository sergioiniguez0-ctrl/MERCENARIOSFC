# Mercenarios FC — Club semanal, versión 2.0

La app incorpora 50 jugadores, acceso sin correo con nombre y PIN, perfiles personalizables, previa con equipos, convocatoria, reconocimientos y Diario Mercenarios. Las fotos quedaron fuera de esta versión.

El punto de entrada sigue siendo `src/main.jsx`, que importa **`src/App.jsx`**. El `App.jsx` de la raíz es un archivo legado y no se utiliza en el build.

## Funciones

- Hasta 50 jugadores. Dorsales únicos del 1 al 99, con opciones ocupadas bloqueadas y reserva validada en una transacción del servidor.
- 63 avatares: 15 PNG originales y 48 variantes vectoriales pixel de potrero, con diferentes tonos de piel, peinados y colores de camiseta.
- Apodo visible, edad, dorsal, avatar, posición principal y secundaria, pierna hábil, frase de hasta 120 caracteres y seis colores de perfil. El jugador modifica solo su perfil. Nombre legal y estadísticas quedan a cargo del administrador.
- Primer PIN de seis dígitos entregado por el administrador desde Ajustes. El jugador puede cambiarlo en Mi perfil → Info. Restablecer un PIN invalida sus sesiones anteriores. No hay registro por mail ni posibilidad de reclamar un perfil ajeno simplemente eligiendo el nombre.
- Previa pública con fecha, modalidad, convocados, respuestas Voy/No voy/Por confirmar y equipos A/B.
- Equipos manuales o automáticos: promedian el nivel estimado por rendimiento y confianza, equilibran posiciones y distribuyen arqueros. Muestran promedio oficial, nivel estimado, total de Valor Mercenario y cantidad de jugadores. El nivel sin datos oficiales parte de 6. El valor total se indica como parcial si faltan cotizaciones.
- Cambio de equipo e intercambio de dos jugadores; diferencia de nivel recalculada al instante. Historial de cruce solo si los planteles son exactamente los mismos, incluso con A/B invertidos.
- Confirmar una previa vincula las misiones existentes a los convocados. Al cargar el resultado, los participantes y equipos se traen desde esa previa. La fecha y modalidad de una convocatoria confirmada no se cambian: se descarta y se crea otra si hace falta. Los convocados sí pueden ajustarse.
- Gol del partido, atajada de la fecha, asistencia del partido, defensor, goleador, motor, revelación y jugada. El MVP mantiene su votación existente. Un voto por jugador y categoría, solo de participantes, mientras la votación esté abierta. Gol/asistencia/atajadas/defensor/goleador limitan candidatos según los datos registrados. Los empates se muestran explícitamente.
- Cerrar la votación fija las distinciones de la comunidad en una transacción. Aparecen en el partido, perfil y diario. Reabrir vuelve a habilitar votos pendientes y retira las distinciones comunitarias definitivas hasta el nuevo cierre.
- Las nuevas distinciones no agregan puntos a la Nota ni al Valor Mercenario. Los reconocimientos históricos mantienen el cálculo anterior. Las misiones y logros pueden reconocer distinciones, sin inventar acciones.
- Diario semanal por semanas de lunes a domingo en horario argentino. Titular, resultados, goles/asistencias registrados, MVP provisional o definitivo, reconocimientos, podio, movimientos respecto del inicio de semana, hasta seis rachas/marcas relevantes y próxima fecha. Ediciones anteriores consultables; se actualizan si se corrigen datos. F5/F6 no se suman a goles/asistencias oficiales. No se narran acciones que no están registradas.
- Actualización al volver a la pestaña, cada 45 segundos y con el botón Actualizar. Una falla de red no borra el estado visible ni crea datos de ejemplo.

## Activar antes de publicar

**Subir únicamente el frontend no activa el PIN.** La misma publicación en Vercel debe incluir `api/club.js` y `server/`, las variables privadas y las reglas de Firestore. Consultar `ACTIVACION.md`.

Los registros existentes se conservan en `mercenarios/shared/storage`: `players`, `matches`, `votes` y `upcomingMatchday`. Las asignaciones usan el prefijo existente `missionAssignment:`. No se renumeran IDs ni se insertan jugadores/partidos de ejemplo en producción.

## Desarrollo y validación

Requiere Node 22 o superior.

```bash
npm ci
npm run dev
npm test
npm run verify:legacy
npm run build
```

El servidor de desarrollo abre `http://127.0.0.1:5173` y atiende tanto Vite como `/api/club`. Carga variables privadas desde `.env`. Sin esa configuración, muestra que falta activar el servidor.

`npm test` prueba permisos, PIN, sesiones, concurrencia de dorsales, cupo, votos, asistencia, cierre atómico de reconocimientos, equipo equilibrado y generación del diario con una base en memoria. No es una prueba contra el Firebase publicado.

Las capturas de `docs/preview/` usan jugadores y partidos de prueba. La aplicación real no recibe esos datos.
