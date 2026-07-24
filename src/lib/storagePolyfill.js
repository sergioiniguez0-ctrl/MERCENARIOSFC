import { db } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
} from "firebase/firestore";

async function get(key, shared = false) {
  const ref = doc(
    db,
    "mercenarios",
    shared ? "shared" : "personal",
    "storage",
    key
  );

  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error(`storage: key not found "${key}"`);
  }

  return {
    key,
    value: snap.data().value,
    shared,
  };
}

async function set(key, value, shared = false) {
  const ref = doc(
    db,
    "mercenarios",
    shared ? "shared" : "personal",
    "storage",
    key
  );

  await setDoc(ref, {
    value,
    updatedAt: Date.now(),
  });

  return {
    key,
    value,
    shared,
  };
}

async function del(key, shared = false) {
  const ref = doc(
    db,
    "mercenarios",
    shared ? "shared" : "personal",
    "storage",
    key
  );

  await deleteDoc(ref);

  return {
    key,
    deleted: true,
    shared,
  };
}

async function list(prefix = "", shared = false) {
  const ref = collection(
    db,
    "mercenarios",
    shared ? "shared" : "personal",
    "storage"
  );

  const snapshot = await getDocs(ref);

  const keys = snapshot.docs
    .map((d) => d.id)
    .filter((k) => k.startsWith(prefix));

  return {
    keys,
    prefix,
    shared,
  };
}

if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    get,
    set,
    delete: del,
    list,
  };
}