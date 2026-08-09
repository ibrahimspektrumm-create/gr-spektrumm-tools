import { state, isAdmin, toast, confirmDialog, openModal, closeModal, escapeHtml, formatDate } from "../modules/core.js";
import { watchCollection, createDoc, updateDocById, deleteDocById, uploadFile, deleteFileByPath } from "../modules/db.js";

let allFiles = [];

export function renderExcel(container) {
  container.innerHTML = `
    <div class="section-title">📊 ملفات Excel</div>
    <div style="margin-bottom:16px;display:flex;justify-content:flex-end;">
      <button class="btn btn-primary" id="add-file-btn">+ رفع ملف</button>
    </div>
    <div id="files-grid" class="grid grid-cols-3"></div>
  `;
  container.querySelector("#add-file-btn").addEventListener("click", () => openFileModal());
  const unsub = watchCollection("excelFiles", (items) => {
    allFiles = items;
    render();
  });
  return unsub;
}

function render() {
  const host = document.getElementById("files-grid");
  if (!host) return;
  if (!allFiles.length) {
    host.innerHTML = `<div class="empty-state">لا توجد ملفات مرفوعة</div>`;
    return;
  }
  host.innerHTML = allFiles.map(fileCard).join("");
  host.querySelectorAll("[data-edit]").forEach((el) => el.addEventListener("click", () => openFileModal(allFiles.find((f) => f.id === el.dataset.edit))));
  host.querySelectorAll("[data-del]").forEach((el) =>
    el.addEventListener("click", async () => {
      const file = allFiles.find((f) => f.id === el.dataset.del);
      if (await confirmDialog("حذف الملف", "سيتم حذف الملف نهائيًا. تأكيد؟")) {
        await deleteFileByPath(file.storagePath);
        await deleteDocById("excelFiles", file.id);
        toast("تم الحذف", "success");
      }
    })
  );
}

function fileCard(f) {
  const canManage = isAdmin() || f.ownerId === state.user?.uid;
  return `
    <div class="glass-card card">
      <div style="font-weight:700;">📄 ${escapeHtml(f.name)}</div>
      <p class="text-muted" style="font-size:12.5px;">${escapeHtml(f.description || "")}</p>
      ${
        (f.usageSteps || []).length
          ? `<ol style="font-size:12px;padding-inline-start:18px;">${f.usageSteps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>`
          : ""
      }
      <div class="text-muted" style="font-size:11px;margin-bottom:8px;">آخر تحديث: ${formatDate(f.updatedAt || f.createdAt)}</div>
      <div style="display:flex;gap:6px;">
        <a class="btn btn-primary btn-sm" style="flex:1;text-align:center;text-decoration:none;" href="${f.storageUrl}" target="_blank">⬇ تحميل</a>
        ${canManage ? `<button class="btn btn-ghost btn-sm" data-edit="${f.id}">✎</button><button class="btn btn-danger btn-sm" data-del="${f.id}">🗑</button>` : ""}
      </div>
    </div>`;
}

function openFileModal(file = null) {
  const ov = openModal(
    `
    <h3>${file ? "تحديث ملف" : "رفع ملف Excel"}</h3>
    <form id="file-form">
      <div class="field"><label>الاسم</label><input id="ef-name" required value="${escapeHtml(file?.name || "")}" /></div>
      <div class="field"><label>الوصف</label><textarea id="ef-desc" rows="2">${escapeHtml(file?.description || "")}</textarea></div>
      <div class="field"><label>خطوات الاستخدام (سطر لكل خطوة)</label><textarea id="ef-steps" rows="3">${(file?.usageSteps || []).join("\n")}</textarea></div>
      <div class="field"><label>${file ? "استبدال الملف (اختياري)" : "الملف"}</label><input id="ef-file" type="file" accept=".xlsx,.xls,.csv" ${file ? "" : "required"} /></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-close-modal>إلغاء</button>
        <button type="submit" class="btn btn-primary" id="ef-submit">حفظ</button>
      </div>
    </form>`,
    {
      onMount: (ov) =>
        ov.querySelector("#file-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const btn = ov.querySelector("#ef-submit");
          const name = ov.querySelector("#ef-name").value.trim();
          const description = ov.querySelector("#ef-desc").value.trim();
          const usageSteps = ov
            .querySelector("#ef-steps")
            .value.split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
          const fileInput = ov.querySelector("#ef-file");
          const selected = fileInput.files[0];

          if (selected && selected.size > 25 * 1024 * 1024) {
            toast("حجم الملف أكبر من الحد المسموح (25MB)", "error");
            return;
          }

          btn.disabled = true;
          btn.textContent = "جارِ الرفع…";
          try {
            let storagePath = file?.storagePath;
            let storageUrl = file?.storageUrl;
            let fileType = file?.fileType;

            if (selected) {
              if (file?.storagePath) await deleteFileByPath(file.storagePath);
              storagePath = `excelFiles/${state.user.uid}/${Date.now()}_${selected.name}`;
              storageUrl = await uploadFile(storagePath, selected);
              fileType = selected.name.split(".").pop();
            }

            const payload = { name, description, usageSteps, storagePath, storageUrl, fileType, updatedAt: Date.now() };
            if (file) await updateDocById("excelFiles", file.id, payload);
            else await createDoc("excelFiles", { ...payload, ownerId: state.user.uid });
            toast("تم الحفظ بنجاح", "success");
            closeModal(ov);
          } catch (err) {
            console.error(err);
            toast("فشل رفع الملف", "error");
            btn.disabled = false;
            btn.textContent = "حفظ";
          }
        }),
    }
  );
}
