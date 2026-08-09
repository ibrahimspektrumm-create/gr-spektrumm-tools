import { state, userName, toast, escapeHtml, formatDate, priorityMeta, statusMeta, openModal, closeModal } from "../modules/core.js";
import { watchCollection, createDoc, getAllOnce } from "../modules/db.js";
import { sendNotification } from "../modules/notifications.js";

let allTasks = [];
let groupBy = "user";

export function renderTeam(container) {
  container.innerHTML = `
    <div class="section-title">👥 متابعة الفريق</div>
    <div class="glass-card card" style="margin-bottom:16px;display:flex;gap:10px;align-items:center;">
      <span class="text-muted" style="font-size:13px;">التجميع حسب:</span>
      <select id="group-select">
        <option value="user">المستخدم</option>
        <option value="status">الحالة</option>
      </select>
    </div>
    <div id="team-groups"></div>
  `;
  container.querySelector("#group-select").addEventListener("change", (e) => {
    groupBy = e.target.value;
    render();
  });

  const unsub = watchCollection("tasks", (items) => {
    allTasks = items;
    render();
  });
  return unsub;
}

function render() {
  const host = document.getElementById("team-groups");
  if (!host) return;

  let groups = {};
  if (groupBy === "user") {
    Object.values(state.usersCache).forEach((u) => (groups[u.uid] = { label: u.name, items: [] }));
    allTasks.forEach((t) => {
      (t.assignedTo || []).forEach((uid) => {
        if (!groups[uid]) groups[uid] = { label: userName(uid), items: [] };
        groups[uid].items.push(t);
      });
    });
  } else {
    const labels = { not_started: "لم تبدأ", in_progress: "جارية", done: "مكتملة" };
    Object.entries(labels).forEach(([k, v]) => (groups[k] = { label: v, items: [] }));
    allTasks.forEach((t) => groups[t.status]?.items.push(t));
  }

  host.innerHTML = Object.values(groups)
    .filter((g) => g.items.length)
    .map(
      (g) => `
      <div class="glass-card card" style="margin-bottom:14px;">
        <div style="font-weight:700;margin-bottom:10px;">${escapeHtml(g.label)} <span class="text-muted">(${g.items.length})</span></div>
        <div class="grid grid-cols-3">${g.items.map(taskRow).join("")}</div>
      </div>`
    )
    .join("") || `<div class="empty-state">لا توجد مهام</div>`;

  host.querySelectorAll(".remind-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const taskId = btn.dataset.taskId;
      const task = allTasks.find((t) => t.id === taskId);
      for (const uid of task.assignedTo || []) {
        await sendNotification({
          userId: uid,
          type: "deadline",
          relatedTaskId: task.id,
          message: `تذكير: مهمة "${task.title}" قربت على الموعد النهائي`,
        });
      }
      toast("تم إرسال التذكير", "success");
    });
  });
  host.querySelectorAll(".comment-btn").forEach((btn) => {
    btn.addEventListener("click", () => openCommentModal(allTasks.find((t) => t.id === btn.dataset.taskId)));
  });
}

function taskRow(t) {
  const pr = priorityMeta(t.priority);
  const st = statusMeta(t.status);
  const overdue = t.dueDate && t.status !== "done" && new Date(t.dueDate) < new Date();
  return `
    <div class="glass-card card" style="${overdue ? "border-color:rgba(255,77,109,0.5);" : ""}">
      <div style="font-weight:700;">${pr.icon} ${escapeHtml(t.title)}</div>
      <div style="font-size:11.5px;" class="${st.cls}">${st.label} · ${t.dueDate ? formatDate(t.dueDate) : "بدون موعد"}</div>
      <div style="display:flex;gap:6px;margin-top:8px;">
        <button class="btn btn-sm btn-ghost remind-btn" data-task-id="${t.id}">🔔 تذكير</button>
        <button class="btn btn-sm btn-ghost comment-btn" data-task-id="${t.id}">💬 كومنت</button>
      </div>
    </div>`;
}

async function openCommentModal(task) {
  const comments = (await getAllOnce("taskComments")).filter((c) => c.taskId === task.id);
  const overlay = openModal(
    `
    <h3>تعليقات: ${escapeHtml(task.title)}</h3>
    <div id="comments-list" style="max-height:220px;overflow:auto;margin:14px 0;">
      ${
        comments.length
          ? comments.map((c) => `<div style="padding:8px 0;border-bottom:1px solid var(--glass-border);"><b>${escapeHtml(userName(c.authorId))}</b>: ${escapeHtml(c.text)}</div>`).join("")
          : `<div class="text-muted">لا توجد تعليقات بعد</div>`
      }
    </div>
    <div class="field-row">
      <input id="comment-input" placeholder="أضف تعليقًا..." style="flex:1;" />
      <button class="btn btn-primary" id="comment-send">إرسال</button>
    </div>
  `,
    {
      onMount: (ov) => {
        ov.querySelector("#comment-send").addEventListener("click", async () => {
          const text = ov.querySelector("#comment-input").value.trim();
          if (!text) return;
          await createDoc("taskComments", { taskId: task.id, authorId: state.user.uid, text });
          toast("تم إضافة التعليق", "success");
          closeModal(ov);
        });
      },
    }
  );
}
