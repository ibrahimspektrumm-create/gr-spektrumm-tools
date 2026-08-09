// ============================================================
// GR Spektrumm Tools — In-App Notifications
// ============================================================
import { db } from "../firebase-config.js";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  limit,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { state } from "./core.js";

export function sendNotification({ userId, type, relatedTaskId = null, message }) {
  return addDoc(collection(db, "notifications"), {
    userId,
    type,
    relatedTaskId,
    message,
    isRead: false,
    createdAt: Date.now(),
  });
}

export function watchMyNotifications(cb) {
  if (!state.user) return () => {};
  const q = query(
    collection(db, "notifications"),
    where("userId", "==", state.user.uid),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  return onSnapshot(q, (qs) => {
    const items = [];
    qs.forEach((d) => items.push({ id: d.id, ...d.data() }));
    cb(items);
  });
}

export function markNotificationRead(id) {
  return updateDoc(doc(db, "notifications", id), { isRead: true });
}
