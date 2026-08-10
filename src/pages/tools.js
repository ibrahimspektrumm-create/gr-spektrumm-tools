import { state, isAdmin, toast, confirmDialog, openModal, closeModal, escapeHtml } from "../modules/core.js";
import { watchCollection, createDoc, updateDocById, deleteDocById, uploadFile, deleteFileByPath } from "../modules/db.js";

const MAX_TOOL_FILE_SIZE = 150 * 1024 * 1024; // 150MB

let allTools = [];

export function renderTools(container) {
  container.innerHTML = `
    <div class="section-title">🧰 أدواتي <span class="count-pill" id="tools-count-pill">0</span></div>
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
  const pill = document.getElementById("tools-count-pill");
  if (pill) pill.textContent = String(allTools.length);
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
      const tool = allTools.find((t) => t.id === el.dataset.del);
      if (await confirmDialog("حذف الأداة", "تأكيد حذف هذه الأداة؟")) {
        if (tool?.isUploadedFile && tool?.storagePath) await deleteFileByPath(tool.storagePath);
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
        <div style="font-weight:700;">${escapeHtml(t.name)}${t.isUploadedFile ? ` <span class="tag" title="ملف HTML مرفوع">HTML</span>` : ""}</div>
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
      <div class="field">
        <label>نوع الأداة</label>
        <select id="tl-mode">
          <option value="link" ${!tool || !tool.isUploadedFile ? "selected" : ""}>رابط خارجي</option>
          <option value="upload" ${tool?.isUploadedFile ? "selected" : ""}>رفع ملف HTML (حتى 150MB)</option>
        </select>
      </div>
      <div class="field" id="tl-url-field" style="${tool?.isUploadedFile ? "display:none;" : ""}">
        <label>الرابط</label><input id="tl-url" type="url" value="${escapeHtml(!tool?.isUploadedFile ? tool?.url || "" : "")}" />
      </div>
      <div class="field" id="tl-file-field" style="${tool?.isUploadedFile ? "" : "display:none;"}">
        <label>${tool?.isUploadedFile ? "استبدال ملف HTML (اختياري)" : "ملف HTML"}</label>
        <input id="tl-file" type="file" accept=".html,.htm,text/html" />
        ${tool?.isUploadedFile ? `<div class="text-muted" style="font-size:11px;margin-top:4px;">الملف الحالي: <a href="${tool.url}" target="_blank">فتح</a></div>` : ""}
      </div>
      <div class="field"><label>رابط الصورة (اختياري)</label><input id="tl-img" value="${escapeHtml(tool?.imageUrl || "")}" /></div>
      <div class="field"><label>Tags (بفاصلة)</label><input id="tl-tags" value="${(tool?.tags || []).join(", ")}" /></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-close-modal>إلغاء</button>
        <button type="submit" class="btn btn-primary" id="tl-submit">حفظ</button>
      </div>
    </form>`,
    {
      onMount: (ov) => {
        const modeSel = ov.querySelector("#tl-mode");
        modeSel.addEventListener("change", () => {
          const isUpload = modeSel.value === "upload";
          ov.querySelector("#tl-url-field").style.display = isUpload ? "none" : "";
          ov.querySelector("#tl-file-field").style.display = isUpload ? "" : "none";
        });

        ov.querySelector("#tool-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const isUpload = modeSel.value === "upload";
          const fileInput = ov.querySelector("#tl-file");
          const selected = fileInput.files[0];
          const submitBtn = ov.querySelector("#tl-submit");

          if (isUpload && selected && selected.size > MAX_TOOL_FILE_SIZE) {
            toast("حجم الملف أكبر من الحد المسموح (150MB)", "error");
            return;
          }
          if (isUpload && !selected && !tool?.isUploadedFile) {
            toast("اختر ملف HTML للرفع", "error");
            return;
          }
          if (!isUpload && !ov.querySelector("#tl-url").value.trim()) {
            toast("أدخل رابط الأداة", "error");
            return;
          }

          const payload = {
            name: ov.querySelector("#tl-name").value.trim(),
            description: ov.querySelector("#tl-desc").value.trim(),
            imageUrl: ov.querySelector("#tl-img").value.trim(),
            tags: ov.querySelector("#tl-tags").value.split(",").map((t) => t.trim()).filter(Boolean),
          };

          submitBtn.disabled = true;
          submitBtn.textContent = isUpload && selected ? "جارِ الرفع…" : "جارِ الحفظ…";
          try {
            if (isUpload) {
              if (selected) {
                if (tool?.isUploadedFile && tool?.storagePath) await deleteFileByPath(tool.storagePath);
                const storagePath = `toolFiles/${state.user.uid}/${Date.now()}_${selected.name}`;
                const storageUrl = await uploadFile(storagePath, selected);
                payload.url = storageUrl;
                payload.storagePath = storagePath;
                payload.isUploadedFile = true;
              } else {
                // Keep existing uploaded file, only metadata changed.
                payload.url = tool.url;
                payload.storagePath = tool.storagePath;
                payload.isUploadedFile = true;
              }
            } else {
              // Switching to link mode: drop any previously uploaded file.
              if (tool?.isUploadedFile && tool?.storagePath) await deleteFileByPath(tool.storagePath);
              payload.url = ov.querySelector("#tl-url").value.trim();
              payload.storagePath = null;
              payload.isUploadedFile = false;
            }

            if (tool) await updateDocById("tools", tool.id, payload);
            else await createDoc("tools", { ...payload, ownerId: state.user.uid, isFavorite: false });
            toast("تم الحفظ", "success");
            closeModal(ov);
          } catch (err) {
            console.error(err);
            toast("حدث خطأ أثناء الحفظ", "error");
            submitBtn.disabled = false;
            submitBtn.textContent = "حفظ";
          }
        });
      },
    }
  );
}
