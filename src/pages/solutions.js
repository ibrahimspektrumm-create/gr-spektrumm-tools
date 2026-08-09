import { state, isAdmin, userName, toast, confirmDialog, openModal, closeModal, escapeHtml, formatDateTime } from "../modules/core.js";
import { watchCollection, createDoc, updateDocById, deleteDocById } from "../modules/db.js";

let allSolutions = [];
const TYPE_LABEL = { formula: "معادلة", vba: "VBA", powerquery: "Power Query", snippet: "Snippet" };

export function renderSolutions(container) {
  container.innerHTML = `
    <div class="section-title">🧩 حلول ومعادلات</div>
    <div style="margin-bottom:16px;display:flex;justify-content:flex-end;">
      <button class="btn btn-primary" id="add-sol-btn">+ إضافة حل</button>
    </div>
    <div id="sol-grid" class="grid grid-cols-2"></div>
  `;
  container.querySelector("#add-sol-btn").addEventListener("click", () => openSolModal());
  const unsub = watchCollection("solutions", (items) => {
    allSolutions = items;
    render();
  });
  return unsub;
}

function render() {
  const host = document.getElementById("sol-grid");
  if (!host) return;
  if (!allSolutions.length) {
    host.innerHTML = `<div class="empty-state">لا توجد حلول مضافة بعد</div>`;
    return;
  }
  host.innerHTML = allSolutions.map(solCard).join("");
  host.querySelectorAll("[data-copy]").forEach((el) =>
    el.addEventListener("click", async () => {
      await navigator.clipboard.writeText(el.dataset.copy);
      toast("تم نسخ الحل", "success");
    })
  );
  host.querySelectorAll("[data-edit]").forEach((el) => el.addEventListener("click", () => openSolModal(allSolutions.find((s) => s.id === el.dataset.edit))));
  host.querySelectorAll("[data-del]").forEach((el) =>
    el.addEventListener("click", async () => {
      if (await confirmDialog("حذف الحل", "تأكيد الحذف؟")) {
        await deleteDocById("solutions", el.dataset.del);
        toast("تم الحذف", "success");
      }
    })
  );
}

function solCard(s) {
  const canManage = isAdmin() || s.ownerId === state.user?.uid;
  return `
    <div class="glass-card card">
      <div style="display:flex;justify-content:space-between;">
        <div style="font-weight:700;">${escapeHtml(s.title)}</div>
        <span class="tag">${TYPE_LABEL[s.type] || s.type}</span>
      </div>
      <p class="text-muted" style="font-size:12.5px;">${escapeHtml(s.problem)}</p>
      <pre style="background:rgba(0,0,0,0.35);padding:10px;border-radius:8px;font-size:12px;overflow:auto;white-space:pre-wrap;direction:ltr;text-align:left;">${escapeHtml(s.solution)}</pre>
      ${s.explanation ? `<p style="font-size:12px;" class="text-muted">${escapeHtml(s.explanation)}</p>` : ""}
      <div class="text-muted" style="font-size:10.5px;margin-bottom:8px;">${s.lastEditedBy ? `آخر تعديل بواسطة ${escapeHtml(userName(s.lastEditedBy))} في ${formatDateTime(s.lastEditedAt)}` : ""}</div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-primary btn-sm" style="flex:1;" data-copy="${escapeHtml(s.solution)}">📋 نسخ الحل</button>
        ${canManage ? `<button class="btn btn-ghost btn-sm" data-edit="${s.id}">✎</button><button class="btn btn-danger btn-sm" data-del="${s.id}">🗑</button>` : ""}
      </div>
    </div>`;
}

function openSolModal(sol = null) {
  const ov = openModal(
    `
    <h3>${sol ? "تعديل حل" : "إضافة حل / معادلة"}</h3>
    <form id="sol-form">
      <div class="field"><label>العنوان</label><input id="sl-title" required value="${escapeHtml(sol?.title || "")}" /></div>
      <div class="field"><label>المشكلة</label><textarea id="sl-problem" rows="2" required>${escapeHtml(sol?.problem || "")}</textarea></div>
      <div class="field"><label>الحل (كود/معادلة)</label><textarea id="sl-solution" rows="4" required style="direction:ltr;text-align:left;font-family:monospace;">${escapeHtml(sol?.solution || "")}</textarea></div>
      <div class="field"><label>الشرح (اختياري)</label><textarea id="sl-explain" rows="2">${escapeHtml(sol?.explanation || "")}</textarea></div>
      <div class="field-row">
        <div class="field"><label>النوع</label>
          <select id="sl-type">
            ${Object.entries(TYPE_LABEL).map(([k, v]) => `<option value="${k}" ${sol?.type === k ? "selected" : ""}>${v}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>Tags (بفاصلة)</label><input id="sl-tags" value="${(sol?.tags || []).join(", ")}" /></div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-close-modal>إلغاء</button>
        <button type="submit" class="btn btn-primary">حفظ</button>
      </div>
    </form>`,
    {
      onMount: (ov) =>
        ov.querySelector("#sol-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const payload = {
            title: ov.querySelector("#sl-title").value.trim(),
            problem: ov.querySelector("#sl-problem").value.trim(),
            solution: ov.querySelector("#sl-solution").value.trim(),
            explanation: ov.querySelector("#sl-explain").value.trim(),
            type: ov.querySelector("#sl-type").value,
            tags: ov.querySelector("#sl-tags").value.split(",").map((t) => t.trim()).filter(Boolean),
            lastEditedBy: state.user.uid,
            lastEditedAt: Date.now(),
          };
          try {
            if (sol) await updateDocById("solutions", sol.id, payload);
            else await createDoc("solutions", { ...payload, ownerId: state.user.uid });
            toast("تم الحفظ", "success");
            closeModal(ov);
          } catch (err) {
            console.error(err);
            toast("حدث خطأ", "error");
          }
        }),
    }
  );
}
