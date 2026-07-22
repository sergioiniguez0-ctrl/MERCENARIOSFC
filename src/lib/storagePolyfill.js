// Mercenarios FC guarda jugadores, partidos y votos usando la API
// window.storage.get/set/delete/list, que solo existe dentro del entorno
// de Artifacts de Claude.ai. Este archivo implementa esa misma interfaz
// usando localStorage, para que la app funcione igual en cualquier
// navegador (Vercel, celular, etc.) sin tocar la lógica de App.jsx.
//
// Reglas que replica del original:
// - get(key, shared) devuelve { key, value, shared } o LANZA un error si
//   la clave no existe (App.jsx ya espera esto y lo captura con try/catch).
// - set(key, value, shared) guarda un string y devuelve { key, value, shared }.
// - delete(key, shared) borra la clave.
// - list(prefix, shared) devuelve { keys, prefix, shared }.
//
// "shared" separa un namespace "compartido" de uno "personal", igual que
// en el entorno original (acá viven en el mismo localStorage del
// dispositivo, ya que esta app no tiene backend propio).

const ROOT_KEY = "mercenarios-fc:storage";

function readRoot() {
  try {
    const raw = localStorage.getItem(ROOT_KEY);
    return raw ? JSON.parse(raw) : { shared: {}, personal: {} };
  } catch (e) {
    return { shared: {}, personal: {} };
  }
}

function writeRoot(root) {
  localStorage.setItem(ROOT_KEY, JSON.stringify(root));
}

function scopeOf(root, shared) {
  const name = shared ? "shared" : "personal";
  if (!root[name]) root[name] = {};
  return root[name];
}

async function get(key, shared = false) {
  const root = readRoot();
  const scope = scopeOf(root, shared);
  if (!(key in scope)) {
    throw new Error(`storage: key not found "${key}"`);
  }
  return { key, value: scope[key], shared };
}

async function set(key, value, shared = false) {
  const root = readRoot();
  const scope = scopeOf(root, shared);
  scope[key] = value;
  writeRoot(root);
  return { key, value, shared };
}

async function del(key, shared = false) {
  const root = readRoot();
  const scope = scopeOf(root, shared);
  const existed = key in scope;
  delete scope[key];
  writeRoot(root);
  return { key, deleted: existed, shared };
}

async function list(prefix = "", shared = false) {
  const root = readRoot();
  const scope = scopeOf(root, shared);
  const keys = Object.keys(scope).filter((k) => k.startsWith(prefix));
  return { keys, prefix, shared };
}

if (typeof window !== "undefined" && !window.storage) {
  window.storage = { get, set, delete: del, list };
}
