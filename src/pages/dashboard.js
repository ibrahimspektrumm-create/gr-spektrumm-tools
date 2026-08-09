import { state, navigate, escapeHtml, formatDate, priorityMeta } from "../modules/core.js";
import { watchCollection, getAllOnce } from "../modules/db.js";

export function renderDashboard(container) {
  container.innerHTML = `
    <div class="section-title">🛰️ لوحة القيادة</div>
    <div class="grid grid-cols-4" id="stat-rings" style="margin-bottom:20px;"></div>
    <div class="grid grid-cols-2">
      <div class="glass-card card">
        <div class="section-title" style="font-size:15px;">📅 مهام اليوم والمتأخرة</div>
        <div id="today-tasks"></div>
      </div>
      <div class="glass-card card">
        <div class="section-title" style="font-size:15px;">⏳ المهام القادمة</div>
        <div id="upcoming-tasks"></div>
      </div>
      <div class="glass-card card">
        <div class="section-title" style="font-size:15px;">⭐ الأدوات المفضلة</div>
        <div id="fav-tools"></div>
      </div>
      <div class="glass-card card">
        <div class="section-title" style="font-size:15px;">🆕 آخر الإضافات</div>
        <div id="recent-items"></div>
      </div>
    </div>
  `;

  const unsubTasks = watchCollection("tasks", (tasks) => {
    renderStats(tasks);
    renderTodayAndOverdue(tasks);
    renderUpcoming(tasks);
  });
  const unsubTools = watchCollection("tools", (tools) => renderFavTools(tools));
  loadRecent();

  return () => {
    unsubTasks();
    unsubTools();
  };
}

function renderStats(tasks) {
  const uid = state.user?.uid;
  const mine = tasks.filter((t) => (t.assignedTo || []).includes(uid));
  const overdue = mine.filter((t) => t.dueDate && t.status !== "done" && new Date(t.dueDate) < new Date());
  const done = mine.filter((t) => t.status === "done");
  const stats = [
    { label: "مهامي", value: mine.length, color: "var(--cyan)" },
    { label: "متأخرة", value: overdue.length, color: "var(--danger)" },
    { label: "مكتملة", value: done.length, color: "var(--success)" },
    { label: "الإجمالي", value: tasks.length, color: "var(--purple)" },
  ];
  document.getElementById("stat-rings").innerHTML = stats
    .map(
      (s) => `
    <div class="glass-card card" style="text-align:center;">
      <div style="font-size:30px;font-weight:800;color:${s.color};text-shadow:0 0 16px ${s.color};">${s.value}</div>
      <div class="text-muted" style="font-size:12px;">${s.label}</div>
    </div>`
    )
    .join("");
}

function renderTodayAndOverdue(tasks) {
  const uid = state.user?.uid;
  const now = new Date();
  const items = tasks.filter((t) => {
    if (!(t.assignedTo || []).includes(uid) || t.status === "done") return false;
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate);
    return d < now || d.toDateString() === now.toDateString();
  });
  renderTaskMiniList("today-tasks", items);
}

function renderUpcoming(tasks) {
  const uid = state.user?.uid;
  const now = new Date();
  const items = tasks
    .filter((t) => (t.assignedTo || []).includes(uid) && t.status !== "done" && t.dueDate && new Date(t.dueDate) > now)
    .sort((a, b) => a.dueDate - b.dueDate)
    .slice(0, 6);
  renderTaskMiniList("upcoming-tasks", items);
}

function renderTaskMiniList(id, items) {
  const host = document.getElementById(id);
  if (!host) return;
  if (!items.length) {
    host.innerHTML = `<div class="empty-state" style="padding:14px;">لا شيء هنا 🎉</div>`;
    return;
  }
  host.innerHTML = items
    .map((t) => {
      const pr = priorityMeta(t.priority);
      return `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--glass-border);cursor:pointer;" class="dash-task" data-id="${t.id}">
      <span>${pr.icon} ${escapeHtml(t.title)}</span><span class="text-muted" style="font-size:11.5px;">${formatDate(t.dueDate)}</span>
    </div>`;
    })
    .join("");
  host.querySelectorAll(".dash-task").forEach((el) => el.addEventListener("click", () => navigate("tasks")));
}

function renderFavTools(tools) {
  const host = document.getElementById("fav-tools");
  if (!host) return;
  const favs = tools.filter((t) => t.isFavorite);
  if (!favs.length) {
    host.innerHTML = `<div class="empty-state" style="padding:14px;">لا توجد أدوات مفضلة بعد</div>`;
    return;
  }
  host.innerHTML = favs
    .map((t) => `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--glass-border);"><span>⭐ ${escapeHtml(t.name)}</span><a href="${t.url}" target="_blank" class="text-muted">فتح ↗</a></div>`)
    .join("");
}

async function loadRecent() {
  const host = document.getElementById("recent-items");
  if (!host) return;
  const collections = ["tools", "excelFiles", "solutions", "guides"];
  const all = await Promise.all(collections.map((c) => getAllOnce(c)));
  const flat = all.flat().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 6);
  if (!flat.length) {
    host.innerHTML = `<div class="empty-state" style="padding:14px;">لا إضافات بعد</div>`;
    return;
  }
  host.innerHTML = flat
    .map((it) => `<div style="padding:7px 0;border-bottom:1px solid var(--glass-border);font-size:13px;">${escapeHtml(it.title || it.name)}</div>`)
    .join("");
}
