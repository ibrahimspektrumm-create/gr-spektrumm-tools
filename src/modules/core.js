// ============================================================
// GR Spektrumm Tools — Core: Auth, Router, UI helpers, DB helpers
// ============================================================
import { auth, db } from "../firebase-config.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// ---------- Global state ----------
export const state = {
  user: null, // Firebase Auth user
  profile: null, // { uid, name, email, role, createdAt }
  usersCache: {}, // uid -> profile, populated live
  ready: false,
};

const listeners = new Set();
export function onStateChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emitState() {
  listeners.forEach((fn) => fn(state));
}

// ---------- Auth ----------
export function login(email, password) {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}
export function logout() {
  return signOut(auth);
}

let usersUnsub = null;

onAuthStateChanged(auth, async (user) => {
  state.user = user;
  if (user) {
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        state.profile = { uid: user.uid, ...snap.data() };
      } else {
        // First-ever login safety net: create a basic user profile
        const profile = {
          name: user.email.split("@")[0],
          email: user.email,
          role: "user",
          createdAt: Date.now(),
        };
        await setDoc(doc(db, "users", user.uid), profile);
        state.profile = { uid: user.uid, ...profile };
      }
    } catch (err) {
      console.error("Failed to load user profile:", err);
      toast("تعذّر تحميل بيانات الحساب", "error");
    }

    if (!usersUnsub) {
      usersUnsub = onSnapshot(collection(db, "users"), (qs) => {
        const cache = {};
        qs.forEach((d) => (cache[d.id] = { uid: d.id, ...d.data() }));
        state.usersCache = cache;
        emitState();
      });
    }
  } else {
    state.profile = null;
    if (usersUnsub) {
      usersUnsub();
      usersUnsub = null;
    }
    state.usersCache = {};
  }
  state.ready = true;
  emitState();
});

export function isAdmin() {
  return state.profile?.role === "admin";
}
export function isManager() {
  return state.profile?.role === "manager";
}
export function isAdminOrManager() {
  return isAdmin() || isManager();
}
export function userName(uid) {
  return state.usersCache[uid]?.name || "مستخدم غير معروف";
}

// ---------- Router (hash-based) ----------
const routes = {}; // path -> { render(container), roles: [...] | null }
let currentCleanup = null;

export function registerRoute(path, render, roles = null) {
  routes[path] = { render, roles };
}

export async function navigate(path) {
  if (location.hash.replace("#", "") !== path) {
    location.hash = path;
    return; // hashchange listener will call renderRoute
  }
  await renderRoute();
}

async function renderRoute() {
  const container = document.getElementById("app-view");
  if (!container) return;
  let path = location.hash.replace("#", "") || "dashboard";
  const route = routes[path] || routes["dashboard"];

  if (route.roles && !route.roles.includes(state.profile?.role)) {
    container.innerHTML = `<div class="access-denied glass-card"><h2>🚫 غير مصرح بالدخول</h2><p>ليس لديك صلاحية الوصول لهذا القسم.</p></div>`;
    return;
  }

  if (typeof currentCleanup === "function") {
    try {
      currentCleanup();
    } catch (e) {
      /* noop */
    }
    currentCleanup = null;
  }

  container.classList.add("view-fade");
  const cleanup = await route.render(container);
  if (typeof cleanup === "function") currentCleanup = cleanup;
  requestAnimationFrame(() => container.classList.remove("view-fade"));

  document
    .querySelectorAll(".nav-item")
    .forEach((el) => el.classList.toggle("active", el.dataset.route === path));
}

window.addEventListener("hashchange", renderRoute);
export function initRouter() {
  renderRoute();
}

// ---------- UI helpers ----------
export function toast(message, type = "info", duration = 3800) {
  let host = document.getElementById("toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "toast-host";
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  const icons = { success: "✓", error: "✕", info: "ℹ", warning: "⚠" };
  el.innerHTML = `<span class="toast-icon">${icons[type] || "ℹ"}</span><span>${escapeHtml(
    message
  )}</span>`;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, duration);
}

export function confirmDialog(title, message) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal glass-card">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-act="cancel">إلغاء</button>
          <button class="btn btn-danger" data-act="ok">تأكيد</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("show"));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay || e.target.dataset.act === "cancel") {
        close(false);
      } else if (e.target.dataset.act === "ok") {
        close(true);
      }
    });
    function close(result) {
      overlay.classList.remove("show");
      setTimeout(() => overlay.remove(), 250);
      resolve(result);
    }
  });
}

export function openModal(innerHtml, { onMount } = {}) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<div class="modal glass-card modal-lg">${innerHtml}</div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("show"));
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.closest("[data-close-modal]")) {
      closeModal(overlay);
    }
  });
  if (onMount) onMount(overlay);
  return overlay;
}
export function closeModal(overlay) {
  overlay.classList.remove("show");
  setTimeout(() => overlay.remove(), 250);
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatDate(ts) {
  if (!ts) return "—";
  const d = ts instanceof Date ? ts : new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
export function formatDateTime(ts) {
  if (!ts) return "—";
  const d = ts instanceof Date ? ts : new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function priorityMeta(p) {
  return (
    { high: { icon: "🔴", label: "عالية" }, medium: { icon: "🟠", label: "متوسطة" }, low: { icon: "🟢", label: "منخفضة" } }[
      p
    ] || { icon: "⚪", label: "—" }
  );
}
export function statusMeta(s) {
  return (
    {
      not_started: { label: "لم تبدأ", cls: "status-pending" },
      in_progress: { label: "جارية", cls: "status-progress" },
      done: { label: "مكتملة", cls: "status-done" },
    }[s] || { label: s, cls: "" }
  );
}

// ---------- Notification / message sound (no external audio file needed) ----------
let audioCtx = null;
export function playPingSound() {
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.36);
  } catch (e) {
    /* audio not available — ignore silently */
  }
}

export function debounce(fn, wait = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}
