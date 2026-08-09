import { state, isAdmin, toast, confirmDialog, openModal, closeModal, escapeHtml } from "../modules/core.js";
import { watchCollection, createDoc, updateDocById, deleteDocById } from "../modules/db.js";

let allTools = [];

export function renderTools(container) {
  container.innerHTML = `
    <div class="section-title">🧰 أدواتي</div>
    <div style="margin-bottom:16px;display:flex;justify-content:flex-end;">
      <button class="btn btn-primary" id="add-tool-btn">+ إضافة أداة</button>
    </div>
    <div id="tools-grid" class="grid grid-cols-4"></div>
  `;
  container.querySelector("#add-tool-btn").addEventListener("click", () => openToolModal());
  const unsub = watchCollection("tools", (items) => {
    allTools = items;
    render();
  });
  return unsub;
}

function render() {
  const host = document.getElementById("tools-grid");
  if (!host) return;
  if (!allTools.length) {
    host.innerHTML = `<div class="empty-state">لا توجد أدوات مضافة بعد</div>`;
    return;
  }
  host.innerHTML = allTools.map(toolCard).join("");
  host.querySelectorAll("[data-open]").forEach((el) => el.addEventListener("click", () => window.open(el.dataset.open, "_blank")));
  host.querySelectorAll("[data-fav]").forEach((el) =>
    el.addEventListener("click", async () => {
      const tool = allTools.find((t) => t.id === el.dataset.fav);
      await updateDocById("tools", tool.id, { isFavorite: !tool.isFavorite });
    })
  );
  host.querySelectorAll("[data-edit]").forEach((el) => el.addEventListener("click", () => openToolModal(allTools.find((t) => t.id === el.dataset.edit))));
  host.querySelectorAll("[data-del]").forEach((el) =>
    el.addEventListener("click", async () => {
      if (await confirmDialog("حذف الأداة", "تأكيد حذف هذه الأداة؟")) {
        await deleteDocById("tools", el.dataset.del);
        toast("تم الحذف", "success");
      }
    })
  );
}

function toolCard(t) {
  const canManage = isAdmin() || t.ownerId === state.user?.uid;
  return `
    <div class="glass-card card">
      <div style="display:flex;justify-content:space-between;">
        <div style="font-weight:700;">${escapeHtml(t.name)}</div>
        <span data-fav="${t.id}" style="cursor:pointer;">${t.isFavorite ? "⭐" : "☆"}</span>
      </div>
      <p class="text-muted" style="font-size:12.5px;min-height:34px;">${escapeHtml(t.description || "")}</p>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">${(t.tags || []).map((tg) => `<span class="tag">${escapeHtml(tg)}</span>`).join("")}</div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-primary btn-sm" style="flex:1;" data-open="${escapeHtml(t.url)}">فتح الأداة ↗</button>
        ${canManage ? `<button class="btn btn-ghost btn-sm" data-edit="${t.id}">✎</button><button class="btn btn-danger btn-sm" data-del="${t.id}">🗑</button>` : ""}
      </div>
    </div>`;
}

function openToolModal(tool = null) {
  const ov = openModal(
    `
    <h3>${tool ? "تعديل أداة" : "إضافة أداة"}</h3>
    <form id="tool-form">
      <div class="field"><label>الاسم</label><input id="tl-name" required value="${escapeHtml(tool?.name || "")}" /></div>
      <div class="field"><label>الوصف</label><textarea id="tl-desc" rows="2">${escapeHtml(tool?.description || "")}</textarea></div>
      <div class="field"><label>الرابط</label><input id="tl-url" type="url" required value="${escapeHtml(tool?.url || "")}" /></div>
      <div class="field"><label>رابط الصورة (اختياري)</label><input id="tl-img" value="${escapeHtml(tool?.imageUrl || "")}" /></div>
      <div class="field"><label>Tags (بفاصلة)</label><input id="tl-tags" value="${(tool?.tags || []).join(", ")}" /></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-close-modal>إلغاء</button>
        <button type="submit" class="btn btn-primary">حفظ</button>
      </div>
    </form>`,
    {
      onMount: (ov) =>
        ov.querySelector("#tool-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const payload = {
            name: ov.querySelector("#tl-name").value.trim(),
            description: ov.querySelector("#tl-desc").value.trim(),
            url: ov.querySelector("#tl-url").value.trim(),
            imageUrl: ov.querySelector("#tl-img").value.trim(),
            tags: ov.querySelector("#tl-tags").value.split(",").map((t) => t.trim()).filter(Boolean),
          };
          try {
            if (tool) await updateDocById("tools", tool.id, payload);
            else await createDoc("tools", { ...payload, ownerId: state.user.uid, isFavorite: false });
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
