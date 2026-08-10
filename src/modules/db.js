// ============================================================
// GR Spektrumm Tools — Firestore Data Access Layer
// ============================================================
import { db, storage } from "../firebase-config.js";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  serverTimestamp,
  arrayUnion,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

// ---------- Generic live collection subscription ----------
export function watchCollection(name, cb, orderField = "createdAt") {
  const q = query(collection(db, name), orderBy(orderField, "desc"));
  return onSnapshot(
    q,
    (qs) => {
      const items = [];
      qs.forEach((d) => items.push({ id: d.id, ...d.data() }));
      cb(items);
    },
    (err) => {
      console.error(`watchCollection(${name}) error:`, err);
      cb([], err);
    }
  );
}

export async function getAllOnce(name) {
  const qs = await getDocs(collection(db, name));
  const items = [];
  qs.forEach((d) => items.push({ id: d.id, ...d.data() }));
  return items;
}

export function createDoc(name, data) {
  return addDoc(collection(db, name), { ...data, createdAt: Date.now() });
}
export function updateDocById(name, id, data) {
  return updateDoc(doc(db, name, id), data);
}
export function deleteDocById(name, id) {
  return deleteDoc(doc(db, name, id));
}
export function pushArrayField(name, id, field, value) {
  return updateDoc(doc(db, name, id), { [field]: arrayUnion(value) });
}

// Live comments for a single task — used by the task comments panel so
// new comments appear instantly for everyone without reopening the modal.
// NOTE: this needs a Firestore composite index (taskId ASC, createdAt ASC)
// — Firestore will log a console link to auto-create it the first time
// this runs against real data, or create it via firestore.indexes.json.
export function watchTaskComments(taskId, cb) {
  const q = query(collection(db, "taskComments"), where("taskId", "==", taskId), orderBy("createdAt", "asc"));
  return onSnapshot(
    q,
    (qs) => {
      const items = [];
      qs.forEach((d) => items.push({ id: d.id, ...d.data() }));
      cb(items);
    },
    (err) => {
      console.error("watchTaskComments error:", err);
      cb([], err);
    }
  );
}

// ---------- Storage helpers ----------
export async function uploadFile(path, file) {
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}
export async function deleteFileByPath(path) {
  try {
    await deleteObject(ref(storage, path));
  } catch (err) {
    console.warn("Storage delete skipped (may not exist):", err.message);
  }
}

export { serverTimestamp, doc, collection };
