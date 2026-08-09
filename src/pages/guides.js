import { state, isAdmin, userName, toast, confirmDialog, openModal, closeModal, escapeHtml, formatDateTime } from "../modules/core.js";
import { watchCollection, createDoc, updateDocById, deleteDocById } from "../modules/db.js";

let allGuides = [];

export function renderGuides(container) {
  container.innerHTML = `
    <div class="section-title">📘 شروحات</div>
    <div style="margin-bottom:16px;display:flex;justify-content:flex-end;">
      <button class="btn btn-primary" id="add-guide-btn">+ إضافة شرح</button>
    </div>
    <div id="guides-list" class="grid grid-cols-2"></div>
  `;
  container.querySelector("#add-guide-btn").addEventListener("click", () => openGuideModal());
  const unsub = watchCollection("guides", (items) => {
    allGuides = items;
    render();
  });
  return unsub;
}

function render() {
  const host = document.getElementById("guides-list");
  if (!host) return;
  if (!allGuides.length) {
    host.innerHTML = `<div class="empty-state">لا توجد شروحات مضافة بعد</div>`;
    return;
  }
  host.innerHTML = allGuides.map(guideCard).join("");
  host.querySelectorAll("[data-edit]").forEach((el) => el.addEventListener("click", () => openGuideModal(allGuides.find((g) => g.id === el.dataset.edit))));
  host.querySelectorAll("[data-del]").forEach((el) =>
    el.addEventListener("click", async () => {
      if (await confirmDialog("حذف الشرح", "تأكيد الحذف؟")) {
        await deleteDocById("guides", el.dataset.del);
        toast("تم الحذف", "success");
      }
    })
  );
}

function guideCard(g) {
  const canManage = isAdmin() || g.ownerId === state.user?.uid;
  return `
    <div class="glass-card card">
      <div style="font-weight:700;">${escapeHtml(g.title)}</div>
      <ol style="font-size:12.5px;padding-inline-start:18px;">
        ${(g.steps || [])
          .map((s) =>
            s.startsWith("```") || s.startsWith("$") || s.startsWith(">")
              ? `<li><code style="background:rgba(0,0,0,0.35);padding:2px 6px;border-radius:6px;direction:ltr;display:inline-block;">${escapeHtml(s.replace(/^```/, ""))}</code></li>`
              : `<li>${escapeHtml(s)}</li>`
          )
          .join("")}
      </ol>
      <div class="text-muted" style="font-size:10.5px;margin-bottom:8px;">${g.lastEditedBy ? `آخر تعديل بواسطة ${escapeHtml(userName(g.lastEditedBy))} في ${formatDateTime(g.lastEditedAt)}` : ""}</div>
      ${canManage ? `<div style="display:flex;gap:6px;"><button class="btn btn-ghost btn-sm" data-edit="${g.id}">✎ تعديل</button><button class="btn btn-danger btn-sm" data-del="${g.id}">🗑 حذف</button></div>` : ""}
    </div>`;
}

function openGuideModal(guide = null) {
  const ov = openModal(
    `
    <h3>${guide ? "تعديل شرح" : "إضافة شرح"}</h3>
    <form id="guide-form">
      <div class="field"><label>العنوان</label><input id="gd-title" required value="${escapeHtml(guide?.title || "")}" /></div>
      <div class="field"><label>الخطوات (سطر لكل خطوة — ابدأ السطر بـ $ لأمر Terminal)</label><textarea id="gd-steps" rows="6">${(guide?.steps || []).join("\n")}</textarea></div>
      <div class="field"><label>Tags (بفاصلة)</label><input id="gd-tags" value="${(guide?.tags || []).join(", ")}" /></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-close-modal>إلغاء</button>
        <button type="submit" class="btn btn-primary">حفظ</button>
      </div>
    </form>`,
    {
      onMount: (ov) =>
        ov.querySelector("#guide-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const payload = {
            title: ov.querySelector("#gd-title").value.trim(),
            steps: ov.querySelector("#gd-steps").value.split("\n").map((s) => s.trim()).filter(Boolean),
            tags: ov.querySelector("#gd-tags").value.split(",").map((t) => t.trim()).filter(Boolean),
            lastEditedBy: state.user.uid,
            lastEditedAt: Date.now(),
          };
          try {
            if (guide) await updateDocById("guides", guide.id, payload);
            else await createDoc("guides", { ...payload, ownerId: state.user.uid });
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
