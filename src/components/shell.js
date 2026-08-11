// ============================================================
// GR Spektrumm Tools — App Shell (Sidebar + Topbar + Command Bar)
// ============================================================
import {
  state,
  logout,
  navigate,
  isAdmin,
  isAdminOrManager,
  toast,
  playPingSound,
  unlockNotificationSound,
} from "../modules/core.js";
import { watchMyNotifications, markNotificationRead } from "../modules/notifications.js";
import { mountPrayerWidget } from "../modules/prayerTimes.js";
import { getAllOnce, watchCollection } from "../modules/db.js";

const NAV = [
  { path: "dashboard", icon: "🛰️", label: "الرئيسية" },
  { path: "tasks", icon: "🗂️", label: "المهام", countKey: "tasks" },
  { path: "team", icon: "👥", label: "متابعة الفريق", roles: ["admin", "manager"] },
  { path: "chat", icon: "💬", label: "الدردشة العامة" },
  { path: "tools", icon: "🧰", label: "أدواتي", countKey: "tools" },
  { path: "excel", icon: "📊", label: "ملفات Excel", countKey: "excelFiles" },
  { path: "solutions", icon: "🧩", label: "حلول ومعادلات", countKey: "solutions" },
  { path: "guides", icon: "📘", label: "شروحات", countKey: "guides" },
  { path: "settings", icon: "⚙️", label: "الإعدادات", roles: ["admin"] },
  { path: "help", icon: "❓", label: "طريقة الاستخدام" },
];

export function renderShell(rootEl) {
  rootEl.innerHTML = `
    <div id="bg-canvas"></div><div id="bg-grid"></div>
    <div id="app-shell">
      <aside id="sidebar">
        <div class="brand">
          <div class="brand-glyph">GR</div>
          <div class="brand-text">SPEKTRUMM<small>OMEGA X CORE</small></div>
        </div>
        <nav id="nav-list"></nav>
        <div class="nav-spacer"></div>
        <div class="glass-card card" style="font-size:12px;">
          <div style="font-weight:700;">${escapeName()}</div>
          <div class="text-muted" style="text-transform:capitalize;">${roleLabel()}</div>
          <button class="btn btn-ghost btn-sm" id="logout-btn" style="margin-top:10px;width:100%;">🚪 تسجيل الخروج</button>
        </div>
      </aside>
      <div id="main-col">
        <header id="topbar">
          <div style="display:flex;align-items:center;gap:10px;">
            <button class="btn btn-icon btn-ghost" id="menu-toggle">☰</button>
            <div id="prayer-mount"></div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <button class="btn btn-icon btn-ghost" id="cmdbar-btn" title="Ctrl+K">🔍</button>
            <button class="btn btn-icon btn-ghost" id="theme-toggle" title="تبديل المظهر">🌓</button>
            <div style="position:relative;">
              <button class="btn btn-icon btn-ghost" id="bell-btn">🔔<span id="bell-count" class="badge badge-high" style="position:absolute;top:-4px;left:-4px;display:none;"></span></button>
              <div id="notif-panel" class="glass-card" style="display:none;position:absolute;left:0;top:44px;width:300px;max-height:360px;overflow:auto;padding:10px;z-index:50;"></div>
            </div>
            <button class="btn btn-ghost btn-sm" id="about-dev-btn">عن المطور</button>
          </div>
        </header>
        <main id="app-view"></main>
      </div>
    </div>
    <button class="fab" id="fab-add" title="إضافة سريعة">+</button>
  `;

  buildNav();
  wireTopbar();
  mountPrayerWidget(document.getElementById("prayer-mount"));

  // Unlock browser audio after the user's first interaction.
  document.addEventListener(
    "click",
    () => {
      unlockNotificationSound();
    },
    { once: true }
  );

  // Ask for browser notification permission once.
  if (
    "Notification" in window &&
    Notification.permission === "default"
  ) {
    setTimeout(() => {
      Notification.requestPermission().catch(() => {});
    }, 1200);
  }

  wireNotifications();
  wireCommandBar();
  wireNavCounts();
}

function escapeName() {
  return state.profile?.name || "—";
}
function roleLabel() {
  const map = { admin: "Admin — تحكم كامل", manager: "Manager — متابعة الفريق", user: "User" };
  return map[state.profile?.role] || "";
}

function buildNav() {
  const list = document.getElementById("nav-list");
  list.innerHTML = NAV.filter((n) => !n.roles || n.roles.includes(state.profile?.role))
    .map(
      (n) =>
        `<div class="nav-item" data-route="${n.path}"><span class="nav-icon">${n.icon}</span><span>${n.label}</span>${
          n.countKey ? `<span class="badge nav-count" data-count-for="${n.path}" style="margin-inline-start:auto;"></span>` : ""
        }</div>`
    )
    .join("");
  list.querySelectorAll(".nav-item").forEach((el) => {
    el.addEventListener("click", () => {
      navigate(el.dataset.route);
      document.getElementById("sidebar").classList.remove("open");
    });
  });
}

let navCountUnsubs = [];
function wireNavCounts() {
  navCountUnsubs.forEach((u) => u());
  navCountUnsubs = [];
  NAV.filter((n) => n.countKey).forEach((n) => {
    const unsub = watchCollection(n.countKey, (items) => {
      const badge = document.querySelector(`[data-count-for="${n.path}"]`);
      if (!badge) return;
      let value = items.length;
      // Tasks: show the number of still-open tasks the user can act on
      // (matches what the tasks page shows by default), not the raw total.
      if (n.path === "tasks") {
        const uid = state.user?.uid;
        const visible = isAdminOrManager()
          ? items
          : items.filter((t) => (t.assignedTo || []).includes(uid) || t.createdBy === uid);
        value = visible.filter((t) => t.status !== "done").length;
      }
      badge.textContent = value > 99 ? "99+" : String(value);
      badge.style.display = value ? "inline-flex" : "none";
    });
    navCountUnsubs.push(unsub);
  });
}

function wireTopbar() {
  document.getElementById("logout-btn").addEventListener("click", async () => {
    await logout();
    toast("تم تسجيل الخروج", "info");
  });
  document.getElementById("menu-toggle").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });
  document.getElementById("theme-toggle").addEventListener("click", () => {
    const html = document.documentElement;
    const next = html.getAttribute("data-theme") === "light" ? "dark" : "light";
    html.setAttribute("data-theme", next);
    localStorage.setItem("gr_theme", next);
  });
  document.getElementById("about-dev-btn").addEventListener("click", () => {
    import("../pages/about.js").then((m) => m.openAboutModal());
  });
  document.getElementById("fab-add").addEventListener("click", () => {
    import("../pages/tasks.js").then((m) => m.openTaskModal());
  });
}

function wireNotifications() {
  const bellBtn = document.getElementById("bell-btn");
  const panel = document.getElementById("notif-panel");
  const countEl = document.getElementById("bell-count");
  let items = [];
  let knownIds = null; // null = first load (don't ding for existing history)

  watchMyNotifications((notifs) => {
    // Play a sound only for notifications that are brand new since the
    // last snapshot (never on first load / page refresh).
    if (knownIds) {
      const newNotifications = notifs.filter(
        (n) => !n.isRead && !knownIds.has(n.id)
      );

      if (newNotifications.length) {
        // In-app sound
        playPingSound();

        // Browser notification
        if (
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          const latest = newNotifications[0];

          try {
            new Notification(
              latest.label || "🔔 Spektrumm",
              {
                body:
                  latest.message ||
                  "لديك إشعار جديد",
                icon: "/icons/icon-192.png",
                tag: latest.id,
              }
            );
          } catch (err) {
            console.warn(
              "Browser notification failed:",
              err
            );
          }
        }
      }
    }

    knownIds = new Set(notifs.map((n) => n.id));

    items = notifs;
    const unread = items.filter((n) => !n.isRead).length;
    countEl.style.display = unread ? "block" : "none";
    countEl.textContent = unread > 9 ? "9+" : unread;
    renderPanel();
  });

  function renderPanel() {
    if (!items.length) {
      panel.innerHTML = `<div class="empty-state" style="padding:16px;">لا توجد إشعارات</div>`;
      return;
    }
    panel.innerHTML = items
      .map(
        (n) => `
      <div class="notif-item" data-id="${n.id}" data-task-id="${n.relatedTaskId || ""}" style="padding:8px 6px;border-bottom:1px solid var(--glass-border);cursor:pointer;${
          n.isRead ? "opacity:.55;" : ""
        }">
        ${n.label ? `<div style="font-size:11px;font-weight:700;color:var(--cyan);">${escapeHtmlLocal(n.label)}</div>` : ""}
        <div style="font-size:12.5px;">${escapeHtmlLocal(n.message)}</div>
        <div class="text-muted" style="font-size:10.5px;">${new Date(n.createdAt).toLocaleString("ar-EG")}${
          n.relatedTaskId ? " · اضغط لفتح المهمة" : ""
        }</div>
      </div>`
      )
      .join("");
    panel.querySelectorAll(".notif-item").forEach((el) =>
      el.addEventListener("click", async () => {
        await markNotificationRead(el.dataset.id);
        const taskId = el.dataset.taskId;
        if (taskId) {
          const { openTaskOnLoad } = await import("../pages/tasks.js");
          openTaskOnLoad(taskId);
          navigate("tasks");
        }
        panel.style.display = "none";
      })
    );
  }

  bellBtn.addEventListener("click", () => {
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#bell-btn") && !e.target.closest("#notif-panel")) {
      panel.style.display = "none";
    }
  });
}

function escapeHtmlLocal(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}

function wireCommandBar() {
  document.getElementById("cmdbar-btn").addEventListener("click", openCommandBar);
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      openCommandBar();
    }
  });
}

async function openCommandBar() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay show";
  overlay.innerHTML = `
    <div class="modal glass-card modal-lg">
      <input id="cmd-input" placeholder="ابحث في كل الأقسام أو اكتب 'مهمة: ...' لإضافة سريعة" autofocus />
      <div id="cmd-results" style="margin-top:14px;max-height:340px;overflow:auto;"></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") {
      overlay.remove();
      document.removeEventListener("keydown", esc);
    }
  });

  const input = overlay.querySelector("#cmd-input");
  const resultsEl = overlay.querySelector("#cmd-results");
  input.addEventListener(
    "input",
    debounceLocal(async () => {
      const q = input.value.trim();
      if (!q) {
        resultsEl.innerHTML = "";
        return;
      }
      resultsEl.innerHTML = `<div class="text-muted">جارِ البحث…</div>`;
      const results = await globalSearch(q);
      renderResults(results, resultsEl, overlay);
    }, 300)
  );
}

function debounceLocal(fn, wait) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), wait);
  };
}

export async function globalSearch(qStr) {
  const q = qStr.toLowerCase();
  const collections = [
    { name: "tasks", label: "مهمة", fields: ["title", "description"] },
    { name: "tools", label: "أداة", fields: ["name", "description"] },
    { name: "excelFiles", label: "ملف Excel", fields: ["name", "description"] },
    { name: "solutions", label: "حل", fields: ["title", "problem"] },
    { name: "guides", label: "شرح", fields: ["title"] },
  ];
  const all = await Promise.all(
    collections.map(async (c) => {
      const items = await getAllOnce(c.name);
      return items
        .filter((it) =>
          c.fields.some((f) => (it[f] || "").toString().toLowerCase().includes(q)) ||
          (it.tags || []).some((t) => t.toLowerCase().includes(q))
        )
        .map((it) => ({ ...it, __col: c.name, __label: c.label }));
    })
  );
  return all.flat().slice(0, 30);
}

function renderResults(results, resultsEl, overlay) {
  if (!results.length) {
    resultsEl.innerHTML = `<div class="empty-state">لا نتائج</div>`;
    return;
  }
  resultsEl.innerHTML = results
    .map(
      (r) => `
      <div class="cmd-result glass-card" style="padding:10px 12px;margin-bottom:8px;cursor:pointer;">
        <span class="tag">${r.__label}</span>
        <div style="margin-top:4px;font-weight:600;">${escapeHtmlLocal(r.title || r.name)}</div>
      </div>`
    )
    .join("");
  resultsEl.querySelectorAll(".cmd-result").forEach((el, i) => {
    el.addEventListener("click", () => {
      const r = results[i];
      const routeMap = {
        tasks: "tasks",
        tools: "tools",
        excelFiles: "excel",
        solutions: "solutions",
        guides: "guides",
      };
      navigate(routeMap[r.__col]);
      overlay.remove();
    });
  });
}
