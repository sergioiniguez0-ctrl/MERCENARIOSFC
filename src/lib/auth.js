// Acceso de administrador para Mercenarios FC.
//
// La app es 100% frontend (no tiene servidor propio), así que esta
// verificación corre en el navegador. No es un sistema de seguridad de
// nivel bancario: alguien con muchos conocimientos técnicos y ganas
// podría inspeccionar el código del build. Para el uso normal (que los
// visitantes del grupo no carguen ni editen datos sin querer, o por
// curiosidad) alcanza y sobra.
//
// Para cambiar el usuario/contraseña del administrador SIN tocar código,
// configurá estas variables de entorno antes de compilar (`npm run build`)
// — por ejemplo en Vercel: Settings → Environment Variables:
//
//   VITE_ADMIN_USER       -> nombre de usuario del admin
//   VITE_ADMIN_PASS_HASH  -> hash SHA-256 (hexadecimal) de la contraseña
//
// Para generar el hash de una contraseña nueva, abrí la consola del
// navegador (F12) en cualquier página y ejecutá:
//
//   crypto.subtle.digest("SHA-256", new TextEncoder().encode("tu-contraseña-nueva"))
//     .then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2,"0")).join("")))
//
// y copiá el resultado como valor de VITE_ADMIN_PASS_HASH.
//
// Usuario y contraseña por defecto (si no configurás las variables de
// entorno de arriba):
//   usuario:     admin
//   contraseña:  mercenarios2026
// Te recomendamos cambiarla antes de compartir el link del sitio.

export const ADMIN_USER = import.meta.env.VITE_ADMIN_USER || "admin";

// SHA-256 de "mercenarios2026"
const DEFAULT_ADMIN_PASS_HASH =
  "284f4ca746acfb3fc033ffe0624b15c8c9d6e7be1eafd1b1334ddcae8a53bb98";

export const ADMIN_PASS_HASH =
  import.meta.env.VITE_ADMIN_PASS_HASH || DEFAULT_ADMIN_PASS_HASH;

export async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyAdminCredentials(user, pass) {
  if (!user || !pass) return false;
  if (user.trim().toLowerCase() !== ADMIN_USER.trim().toLowerCase()) return false;
  const hash = await sha256Hex(pass);
  return hash === ADMIN_PASS_HASH;
}
