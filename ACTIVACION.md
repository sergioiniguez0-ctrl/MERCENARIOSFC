# Activación en Vercel y Firebase

El código está preparado, pero esta entrega no publica la app ni cambia el Firebase existente. Esta guía activa el acceso por PIN sin correo.

## 1. Resguardar datos

Antes de la publicación, exportar o respaldar los documentos existentes de `mercenarios/shared/storage`. La versión nueva usa los mismos documentos e IDs. No ejecutar inicializaciones con datos de ejemplo ni copiar las capturas de prueba a la base.

Si existieran dorsales duplicados, Ajustes del administrador muestra una herramienta para revisar una propuesta y aplicar números disponibles. Conserva los IDs y las estadísticas. No hace cambios automáticos al abrir la app.

## 2. Variables del servidor

En el proyecto Vercel, configurar para los entornos donde se vaya a probar/publicar:

| Variable | Valor |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | JSON completo de una cuenta de servicio de Firebase del proyecto `mercenariosfc`. |
| `CLUB_SESSION_SECRET` | Secreto aleatorio de al menos 32 caracteres. |
| `CLUB_ADMIN_USER` | Nombre de acceso del administrador; por defecto `admin`. |
| `CLUB_ADMIN_PASSWORD` | Contraseña nueva de al menos 12 caracteres. |
| `CLUB_ORIGIN` | Opcional: origen exacto como `https://mercenariosfc.vercel.app`. Si se omite, se valida el origen contra el dominio de la petición. |

Estas variables **no llevan el prefijo `VITE_`** y no deben guardarse en Git. El archivo `.env.example` contiene únicamente marcadores. El secreto de sesión se puede generar localmente con:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

La cuenta de servicio se obtiene en Firebase → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada. Guardarla solo como variable privada del servidor. La contraseña anterior del frontend no se utiliza ni se distribuye en el nuevo build.

Fuentes técnicas: [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup) y [Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js).

## 3. Publicar el proyecto completo

Subir todos los archivos del proyecto, incluidos `api/`, `server/`, `src/`, `scripts/dev-server.mjs`, `package.json`, `package-lock.json` y `vercel.json`. Vercel usa el build de Vite y publica la función `/api/club`.

Probar primero la URL de preview de Vercel con las variables privadas configuradas. Si se usa `CLUB_ORIGIN`, dejarlo sin definir para previews con dominio distinto o darle el dominio correspondiente a ese entorno.

Abrir `/api/club?action=session`: con configuración válida debe responder con una sesión nula para un visitante. No debe exponer credenciales, PIN ni contraseñas.

## 4. Cerrar el acceso directo de Firestore

Publicar `firestore.rules` desde la consola Firebase o con el CLI del proyecto correcto:

```bash
firebase deploy --only firestore:rules --project mercenariosfc
```

Las reglas bloquean el acceso directo del navegador. La API usa Firebase Admin y valida permisos antes de leer o escribir. **Mientras sigan existiendo reglas abiertas de escritura, el PIN no protege la base frente a llamadas directas a Firestore.** Revisar reglas adicionales de cualquier otra aplicación que comparta el proyecto antes de sustituirlas.

Coordinar este cambio con la publicación del nuevo frontend: el frontend anterior accedía directamente a Firestore y dejará de funcionar al cerrar las reglas. La nueva API ya debe estar disponible antes de cambiar las reglas.

No se necesita habilitar inicio de sesión por correo de Firebase Authentication.

## 5. Dar acceso al plantel

1. Entrar como administrador desde Ajustes usando las variables del servidor.
2. Revisar plantel, estadísticas y dorsales existentes.
3. En Ajustes → PIN de jugadores, seleccionar un jugador y generar su PIN.
4. Entregar el PIN de forma privada. Se muestra una sola vez; no se guarda en texto plano.
5. El jugador entra con su nombre y esos seis dígitos y puede cambiar el PIN en Mi perfil → Info.

El PIN se almacena con sal y `scrypt` en `clubCredentials`. La sesión usa una cookie HttpOnly y SameSite Strict; en producción también Secure. Los intentos de ingreso tienen límites por cuenta e IP. Restablecer o cambiar el PIN rota la versión de credenciales y anula sesiones anteriores.

## 6. Comprobación final con datos reales

- Dos jugadores distintos no pueden tomar el mismo dorsal ni editar el perfil ajeno.
- Un visitante consulta estadísticas, previa y diario, pero no edita ni vota.
- El administrador arma/guarda una previa y los jugadores responden a la convocatoria.
- Equilibrar no duplica ni pierde convocados y reparte los arqueros cuando hay más de uno.
- Cargar partido trae los equipos de la previa confirmada.
- Cerrar votos muestra las distinciones en partido/perfil/diario sin inflar puntajes.
- Comparar totales y ranking con el registro anterior para confirmar la conservación de datos.

## Alcance de la entrega

Se validó el build, las pruebas existentes, 18 pruebas nuevas y los flujos de interfaz en Chromium con datos de prueba en memoria. No se conectó la cuenta de servicio real, no se publicaron reglas, no se desplegó Vercel y no se modificaron los datos existentes. La prueba de conexión real queda para la activación.

El build conserva la advertencia de un paquete JavaScript grande. No impide compilar, pero se puede dividir en otra etapa para reducir la descarga inicial.
