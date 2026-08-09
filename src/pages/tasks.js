import {
  state,
  isAdminOrManager,
  userName,
  toast,
  confirmDialog,
  openModal,
  closeModal,
  escapeHtml,
  formatDate,
  priorityMeta,
  statusMeta,
} from "../modules/core.js";
import { watchCollection, createDoc, updateDocById, deleteDocById } from "../modules/db.js";
import { sendNotification } from "../modules/notifications.js";

let allTasks = [];
let filters = { status: "all", mine: false, tag: "" };

export function renderTasks(container) {
  container.innerHTML = `
    <div class="section-title">🗂️ المهام</div>
    <div class="glass-card card" style="margin-bottom:16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
      <select id="f-status">
        <option value="all">كل الحالات</option>
        <option value="not_started">لم تبدأ</option>
        <option value="in_progress">جارية</option>
        <option value="done">مكتملة</option>
      </select>
      <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-1);"><input type="checkbox" id="f-mine" style="width:auto;" /> مهامي فقط</label>
      <input id="f-tag" placeholder="فلترة بالـ Tag" style="max-width:180px;" />
      <div class="nav-spacer"></div>
      <button class="btn btn-primary" id="add-task-btn">+ إضافة مهمة</button>
    </div>
    <div id="tasks-list" class="grid grid-cols-3"></div>
  `;

  container.querySelector("#add-task-btn").addEventListener("click", () => openTaskModal());
  container.querySelector("#f-status").addEventListener("change", (e) => {
    filters.status = e.target.value;
    renderList();
  });
  container.querySelector("#f-mine").addEventListener("change", (e) => {
    filters.mine = e.target.checked;
    renderList();
  });
  container.querySelector("#f-tag").addEventListener(
    "input",
    debounce((e) => {
      filters.tag = e.target.value.trim().toLowerCase();
      renderList();
    }, 250)
  );

  const unsub = watchCollection("tasks", (items) => {
    allTasks = items;
    renderList();
  });
  return unsub;
}

function debounce(fn, wait) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), wait);
  };
}

function renderList() {
  const listEl = document.getElementById("tasks-list");
  if (!listEl) return;
  const uid = state.user?.uid;
  let items = allTasks.filter((t) => {
    if (filters.status !== "all" && t.status !== filters.status) return false;
    if (filters.mine && !(t.assignedTo || []).includes(uid) && t.createdBy !== uid) return false;
    if (filters.tag && !(t.tags || []).some((tag) => tag.toLowerCase().includes(filters.tag))) return false;
    return true;
  });

  if (!isAdminOrManager()) {
    items = items.filter((t) => (t.assignedTo || []).includes(uid) || t.createdBy === uid);
  }

  if (!items.length) {
    listEl.innerHTML = `<div class="empty-state">لا توجد مهام مطابقة</div>`;
    return;
  }

  listEl.innerHTML = items.map((t) => taskCardHtml(t)).join("");
  listEl.querySelectorAll(".task-card").forEach((el) => {
    const id = el.dataset.id;
    const task = items.find((t) => t.id === id);
    el.querySelector(".task-open")?.addEventListener("click", () => openTaskModal(task));
    el.querySelector(".task-complete")?.addEventListener("click", (e) => {
      e.stopPropagation();
      completeTask(task);
    });
    el.querySelector(".task-delete")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (await confirmDialog("حذف المهمة", "هل أنت متأكد من حذف هذه المهمة؟")) {
        await deleteDocById("tasks", task.id);
        toast("تم حذف المهمة", "success");
      }
    });
  });
}

function taskCardHtml(t) {
  const pr = priorityMeta(t.priority);
  const st = statusMeta(t.status);
  const canManage = isAdminOrManager() || t.createdBy === state.user?.uid;
  const isAssignee = (t.assignedTo || []).includes(state.user?.uid);
  const overdue = t.dueDate && t.status !== "done" && new Date(t.dueDate) < new Date();
  return `
    <div class="glass-card card task-card" data-id="${t.id}" style="${overdue ? "border-color:rgba(255,77,109,0.5);" : ""}">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:8px;">
        <div style="font-weight:700;cursor:pointer;" class="task-open">${escapeHtml(t.title)}</div>
        <span class="badge badge-${t.priority}">${pr.icon}</span>
      </div>
      <p class="text-muted" style="font-size:12.5px;min-height:18px;">${escapeHtml((t.description || "").slice(0, 90))}</p>
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:11.5px;">
        <span class="${st.cls}">${st.label}</span>
        <span class="${overdue ? "" : "text-muted"}" style="${overdue ? "color:var(--danger);font-weight:700;" : ""}">${
    t.dueDate ? formatDate(t.dueDate) : "بدون موعد"
  }</span>
      </div>
      <div style="margin-top:8px;font-size:11px;" class="text-muted">مُسندة إلى: ${(t.assignedTo || [])
        .map((u) => userName(u))
        .join("، ") || "—"}</div>
      <div style="display:flex;gap:6px;margin-top:10px;">
        ${
          isAssignee && t.status !== "done"
            ? `<button class="btn btn-primary btn-sm task-complete" style="flex:1;">✓ إتمام التاسك</button>`
            : ""
        }
        ${canManage ? `<button class="btn btn-danger btn-sm task-delete">🗑</button>` : ""}
      </div>
    </div>`;
}

async function completeTask(task) {
  await updateDocById("tasks", task.id, {
    status: "done",
    completedBy: state.user.uid,
    completedAt: Date.now(),
  });
  toast("تم إتمام المهمة", "success");

  if (task.recurrence && task.recurrence !== "none") {
    const nextDue = computeNextDue(task.dueDate, task.recurrence);
    await createDoc("tasks", {
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      status: "not_started",
      dueDate: nextDue,
      recurrence: task.recurrence,
      createdBy: task.createdBy,
      assignedTo: task.assignedTo || [],
      tags: task.tags || [],
    });
  }
}

function computeNextDue(dueDate, recurrence) {
  const base = dueDate ? new Date(dueDate) : new Date();
  if (recurrence === "daily") base.setDate(base.getDate() + 1);
  if (recurrence === "weekly") base.setDate(base.getDate() + 7);
  if (recurrence === "monthly") base.setMonth(base.getMonth() + 1);
  return base.getTime();
}

export function openTaskModal(task = null) {
  const userOptions = Object.values(state.usersCache)
    .map((u) => `<option value="${u.uid}" ${(task?.assignedTo || []).includes(u.uid) ? "selected" : ""}>${escapeHtml(u.name)}</option>`)
    .join("");

  const overlay = openModal(
    `
    <h3>${task ? "تعديل مهمة" : "إضافة مهمة جديدة"}</h3>
    <form id="task-form">
      <div class="field"><label>العنوان</label><input id="tf-title" required value="${escapeHtml(task?.title || "")}" /></div>
      <div class="field"><label>الوصف</label><textarea id="tf-desc" rows="3">${escapeHtml(task?.description || "")}</textarea></div>
      <div class="field-row">
        <div class="field"><label>الأولوية</label>
          <select id="tf-priority">
            <option value="high" ${task?.priority === "high" ? "selected" : ""}>🔴 عالية</option>
            <option value="medium" ${!task || task?.priority === "medium" ? "selected" : ""}>🟠 متوسطة</option>
            <option value="low" ${task?.priority === "low" ? "selected" : ""}>🟢 منخفضة</option>
          </select>
        </div>
        <div class="field"><label>الموعد النهائي</label><input type="date" id="tf-due" value="${
          task?.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ""
        }" /></div>
      </div>
      <div class="field-row">
        <div class="field"><label>التكرار</label>
          <select id="tf-recurrence">
            <option value="none" ${!task || task?.recurrence === "none" ? "selected" : ""}>بدون تكرار</option>
            <option value="daily" ${task?.recurrence === "daily" ? "selected" : ""}>يومي</option>
            <option value="weekly" ${task?.recurrence === "weekly" ? "selected" : ""}>أسبوعي</option>
            <option value="monthly" ${task?.recurrence === "monthly" ? "selected" : ""}>شهري</option>
          </select>
        </div>
        <div class="field"><label>Tags (بفاصلة)</label><input id="tf-tags" value="${(task?.tags || []).join(", ")}" /></div>
      </div>
      <div class="field"><label>إسناد إلى (يمكن اختيار أكثر من مستخدم)</label>
        <select id="tf-assignees" multiple size="4">${userOptions}</select>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-close-modal>إلغاء</button>
        <button type="submit" class="btn btn-primary">${task ? "حفظ التعديلات" : "إضافة المهمة"}</button>
      </div>
    </form>
  `,
    {
      onMount: (ov) => {
        ov.querySelector("#task-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const title = ov.querySelector("#tf-title").value.trim();
          if (!title) return;
          const assignees = Array.from(ov.querySelector("#tf-assignees").selectedOptions).map((o) => o.value);
          const finalAssignees = assignees.length ? assignees : !isAdminOrManager() ? [state.user.uid] : [];
          const payload = {
            title,
            description: ov.querySelector("#tf-desc").value.trim(),
            priority: ov.querySelector("#tf-priority").value,
            dueDate: ov.querySelector("#tf-due").value ? new Date(ov.querySelector("#tf-due").value).getTime() : null,
            recurrence: ov.querySelector("#tf-recurrence").value,
            tags: ov.querySelector("#tf-tags").value.split(",").map((t) => t.trim()).filter(Boolean),
            assignedTo: finalAssignees,
          };
          try {
            if (task) {
              await updateDocById("tasks", task.id, payload);
              toast("تم تحديث المهمة", "success");
            } else {
              await createDoc("tasks", {
                ...payload,
                status: "not_started",
                createdBy: state.user.uid,
                completedBy: null,
                completedAt: null,
              });
              toast("تمت إضافة المهمة", "success");
              for (const uid of finalAssignees) {
                if (uid !== state.user.uid) {
                  await sendNotification({
                    userId: uid,
                    type: "task_reminder",
                    message: `تم إسناد مهمة جديدة لك: ${title}`,
                  });
                }
              }
            }
            closeModal(ov);
          } catch (err) {
            console.error(err);
            toast("حدث خطأ أثناء الحفظ", "error");
          }
        });
      },
    }
  );
}
