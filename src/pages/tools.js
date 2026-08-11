import {
  state,
  isAdmin,
  toast,
  confirmDialog,
  openModal,
  closeModal,
  escapeHtml,
} from "../modules/core.js";

import {
  watchCollection,
  createDoc,
  updateDocById,
  deleteDocById,
} from "../modules/db.js";

import {
  uploadHtmlToGithub,
  deleteGithubFile,
  getGithubToken,
  saveGithubToken,
  clearGithubToken,
  testGithubToken,
} from "../modules/github-storage.js";

const MAX_TOOL_FILE_SIZE = 90 * 1024 * 1024;

let allTools = [];

export function renderTools(container) {
  container.innerHTML = `
    <div class="section-title">
      🧰 أدواتي
      <span class="count-pill" id="tools-count-pill">0</span>
    </div>

    <div style="margin-bottom:16px;display:flex;gap:8px;justify-content:flex-end;">
      <button class="btn btn-ghost" id="github-settings-btn">
        ⚙️ GitHub
      </button>

      <button class="btn btn-primary" id="add-tool-btn">
        + إضافة أداة
      </button>
    </div>

    <div id="tools-grid" class="grid grid-cols-4"></div>
  `;

  container
    .querySelector("#add-tool-btn")
    .addEventListener("click", () => openToolModal());

  container
    .querySelector("#github-settings-btn")
    .addEventListener("click", () => openGithubSettings());

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

  if (pill) {
    pill.textContent = String(allTools.length);
  }

  if (!allTools.length) {
    host.innerHTML =
      `<div class="empty-state">لا توجد أدوات مضافة بعد</div>`;
    return;
  }

  host.innerHTML = allTools.map(toolCard).join("");

  host.querySelectorAll("[data-open]").forEach((el) => {
    el.addEventListener("click", () => {
      window.open(el.dataset.open, "_blank");
    });
  });

  host.querySelectorAll("[data-fav]").forEach((el) => {
    el.addEventListener("click", async () => {
      const tool = allTools.find(
        (t) => t.id === el.dataset.fav
      );

      if (!tool) return;

      await updateDocById("tools", tool.id, {
        isFavorite: !tool.isFavorite,
      });
    });
  });

  host.querySelectorAll("[data-edit]").forEach((el) => {
    el.addEventListener("click", () => {
      const tool = allTools.find(
        (t) => t.id === el.dataset.edit
      );

      openToolModal(tool);
    });
  });

  host.querySelectorAll("[data-del]").forEach((el) => {
    el.addEventListener("click", async () => {
      const tool = allTools.find(
        (t) => t.id === el.dataset.del
      );

      if (!tool) return;

      if (
        await confirmDialog(
          "حذف الأداة",
          "تأكيد حذف هذه الأداة؟"
        )
      ) {
        try {
          if (
            tool.githubPath &&
            tool.githubSha
          ) {
            await deleteGithubFile(
              tool.githubPath,
              tool.githubSha
            );
          }

          await deleteDocById(
            "tools",
            tool.id
          );

          toast("تم حذف الأداة والملف من GitHub", "success");
        } catch (err) {
          console.error(err);

          toast(
            "تعذر حذف الملف من GitHub",
            "error"
          );
        }
      }
    });
  });
}

function toolCard(t) {
  const canManage =
    isAdmin() ||
    t.ownerId === state.user?.uid;

  return `
    <div class="glass-card card">

      <div style="display:flex;justify-content:space-between;">
        <div style="font-weight:700;">
          ${escapeHtml(t.name)}

          ${
            t.isUploadedFile
              ? `<span class="tag">GitHub HTML</span>`
              : ""
          }
        </div>

        <span
          data-fav="${t.id}"
          style="cursor:pointer;"
        >
          ${t.isFavorite ? "⭐" : "☆"}
        </span>
      </div>

      <p
        class="text-muted"
        style="font-size:12.5px;min-height:34px;"
      >
        ${escapeHtml(t.description || "")}
      </p>

      <div
        style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;"
      >
        ${(t.tags || [])
          .map(
            (tg) =>
              `<span class="tag">${escapeHtml(tg)}</span>`
          )
          .join("")}
      </div>

      <div style="display:flex;gap:6px;">

        <button
          class="btn btn-primary btn-sm"
          style="flex:1;"
          data-open="${escapeHtml(t.url)}"
        >
          فتح الأداة ↗
        </button>

        ${
          canManage
            ? `
              <button
                class="btn btn-ghost btn-sm"
                data-edit="${t.id}"
              >
                ✎
              </button>

              <button
                class="btn btn-danger btn-sm"
                data-del="${t.id}"
              >
                🗑
              </button>
            `
            : ""
        }

      </div>
    </div>
  `;
}

function openGithubSettings() {
  const current = getGithubToken();

  const ov = openModal(`
    <h3>⚙️ إعداد GitHub</h3>

    <p class="text-muted" style="font-size:12px;">
      ضع GitHub Fine-grained Personal Access Token
      بصلاحية Contents: Read and write
      على مستودع gr-spektrumm-tools.
    </p>

    <form id="github-form">

      <div class="field">
        <label>GitHub Token</label>

        <input
          id="github-token"
          type="password"
          autocomplete="off"
          value="${escapeHtml(current)}"
          placeholder="github_pat_..."
        />
      </div>

      <div
        id="github-status"
        class="text-muted"
        style="font-size:12px;margin-top:8px;"
      ></div>

      <div class="modal-actions">

        <button
          type="button"
          class="btn btn-ghost"
          data-close-modal
        >
          إلغاء
        </button>

        <button
          type="button"
          class="btn btn-ghost"
          id="github-test"
        >
          اختبار
        </button>

        <button
          type="submit"
          class="btn btn-primary"
        >
          حفظ
        </button>

      </div>

    </form>
  `, {
    onMount: (modal) => {

      const form =
        modal.querySelector("#github-form");

      const tokenInput =
        modal.querySelector("#github-token");

      const status =
        modal.querySelector("#github-status");

      modal
        .querySelector("#github-test")
        .addEventListener("click", async () => {

          const token =
            tokenInput.value.trim();

          if (!token) {
            status.textContent =
              "أدخل التوكن أولاً";
            return;
          }

          saveGithubToken(token);

          status.textContent =
            "جارِ الاختبار...";

          try {
            const repo =
              await testGithubToken();

            status.textContent =
              `✓ تم الاتصال بـ GitHub: ${repo.full_name}`;

            toast(
              "GitHub متصل بنجاح",
              "success"
            );

          } catch (err) {

            console.error(err);

            status.textContent =
              "✕ التوكن أو الصلاحيات غير صحيحة";

            clearGithubToken();

            toast(
              "فشل الاتصال بـ GitHub",
              "error"
            );
          }
        });

      form.addEventListener(
        "submit",
        (e) => {
          e.preventDefault();

          const token =
            tokenInput.value.trim();

          if (!token) {
            clearGithubToken();

            toast(
              "تم حذف التوكن",
              "success"
            );

            closeModal(modal);
            return;
          }

          saveGithubToken(token);

          toast(
            "تم حفظ إعداد GitHub",
            "success"
          );

          closeModal(modal);
        }
      );
    },
  });

  return ov;
}

function openToolModal(tool = null) {

  const ov = openModal(
    `
    <h3>
      ${tool ? "تعديل أداة" : "إضافة أداة"}
    </h3>

    <form id="tool-form">

      <div class="field">
        <label>الاسم</label>

        <input
          id="tl-name"
          required
          value="${escapeHtml(tool?.name || "")}"
        />
      </div>

      <div class="field">
        <label>الوصف</label>

        <textarea
          id="tl-desc"
          rows="2"
        >${escapeHtml(tool?.description || "")}</textarea>
      </div>

      <div class="field">

        <label>نوع الأداة</label>

        <select id="tl-mode">

          <option
            value="link"
            ${!tool || !tool.isUploadedFile ? "selected" : ""}
          >
            رابط خارجي
          </option>

          <option
            value="upload"
            ${tool?.isUploadedFile ? "selected" : ""}
          >
            رفع ملف HTML إلى GitHub
          </option>

        </select>

      </div>

      <div
        class="field"
        id="tl-url-field"
        style="${tool?.isUploadedFile ? "display:none;" : ""}"
      >

        <label>الرابط</label>

        <input
          id="tl-url"
          type="url"
          value="${escapeHtml(
            !tool?.isUploadedFile
              ? tool?.url || ""
              : ""
          )}"
        />

      </div>

      <div
        class="field"
        id="tl-file-field"
        style="${tool?.isUploadedFile ? "" : "display:none;"}"
      >

        <label>
          ${tool?.isUploadedFile
            ? "استبدال ملف HTML"
            : "ملف HTML"}
        </label>

        <input
          id="tl-file"
          type="file"
          accept=".html,.htm,text/html"
        />

        <div
          class="text-muted"
          style="font-size:11px;margin-top:5px;"
        >
          الحد الأقصى 90MB
        </div>

        ${
          tool?.isUploadedFile
            ? `
              <div
                class="text-muted"
                style="font-size:11px;margin-top:5px;"
              >
                الملف الحالي موجود على GitHub.
              </div>
            `
            : ""
        }

      </div>

      <div class="field">

        <label>رابط الصورة (اختياري)</label>

        <input
          id="tl-img"
          value="${escapeHtml(
            tool?.imageUrl || ""
          )}"
        />

      </div>

      <div class="field">

        <label>Tags (بفاصلة)</label>

        <input
          id="tl-tags"
          value="${escapeHtml(
            (tool?.tags || []).join(", ")
          )}"
        />

      </div>

      <div class="modal-actions">

        <button
          type="button"
          class="btn btn-ghost"
          data-close-modal
        >
          إلغاء
        </button>

        <button
          type="submit"
          class="btn btn-primary"
          id="tl-submit"
        >
          حفظ
        </button>

      </div>

    </form>
    `,
    {
      onMount: (modal) => {

        const mode =
          modal.querySelector("#tl-mode");

        const urlField =
          modal.querySelector("#tl-url-field");

        const fileField =
          modal.querySelector("#tl-file-field");

        mode.addEventListener(
          "change",
          () => {

            const upload =
              mode.value === "upload";

            urlField.style.display =
              upload ? "none" : "";

            fileField.style.display =
              upload ? "" : "none";
          }
        );

        modal
          .querySelector("#tool-form")
          .addEventListener(
            "submit",
            async (e) => {

              e.preventDefault();

              const isUpload =
                mode.value === "upload";

              const fileInput =
                modal.querySelector("#tl-file");

              const selected =
                fileInput.files[0];

              const submitBtn =
                modal.querySelector("#tl-submit");

              if (
                isUpload &&
                selected &&
                selected.size >
                  MAX_TOOL_FILE_SIZE
              ) {
                toast(
                  "حجم الملف أكبر من 90MB",
                  "error"
                );
                return;
              }

              if (
                isUpload &&
                !selected &&
                !tool?.isUploadedFile
              ) {
                toast(
                  "اختر ملف HTML",
                  "error"
                );
                return;
              }

              if (
                !isUpload &&
                !modal
                  .querySelector("#tl-url")
                  .value
                  .trim()
              ) {
                toast(
                  "أدخل رابط الأداة",
                  "error"
                );
                return;
              }

              const payload = {

                name:
                  modal
                    .querySelector("#tl-name")
                    .value
                    .trim(),

                description:
                  modal
                    .querySelector("#tl-desc")
                    .value
                    .trim(),

                imageUrl:
                  modal
                    .querySelector("#tl-img")
                    .value
                    .trim(),

                tags:
                  modal
                    .querySelector("#tl-tags")
                    .value
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
              };

              submitBtn.disabled = true;

              try {

                if (isUpload) {

                  if (selected) {

                    submitBtn.textContent =
                      "⬆️ جارِ الرفع إلى GitHub...";

                    const result =
                      await uploadHtmlToGithub(
                        selected,
                        state.user.uid
                      );

                    payload.url =
                      result.url;

                    payload.githubPath =
                      result.path;

                    payload.githubSha =
                      result.sha;

                    payload.githubUrl =
                      result.githubUrl;

                    payload.rawUrl =
                      result.rawUrl;

                    payload.isUploadedFile =
                      true;

                  } else {

                    payload.url =
                      tool.url;

                    payload.githubPath =
                      tool.githubPath;

                    payload.githubSha =
                      tool.githubSha;

                    payload.githubUrl =
                      tool.githubUrl;

                    payload.rawUrl =
                      tool.rawUrl;

                    payload.isUploadedFile =
                      true;
                  }

                } else {

                  payload.url =
                    modal
                      .querySelector("#tl-url")
                      .value
                      .trim();

                  payload.isUploadedFile =
                    false;

                  payload.githubPath = null;
                  payload.githubSha = null;
                  payload.githubUrl = null;
                  payload.rawUrl = null;
                }

                submitBtn.textContent =
                  "💾 جارِ حفظ البيانات...";

                if (tool) {

                  await updateDocById(
                    "tools",
                    tool.id,
                    payload
                  );

                } else {

                  await createDoc(
                    "tools",
                    {
                      ...payload,
                      ownerId:
                        state.user.uid,
                      isFavorite: false,
                    }
                  );
                }

                toast(
                  isUpload
                    ? "تم رفع الملف إلى GitHub وحفظ الأداة"
                    : "تم حفظ الأداة",
                  "success"
                );

                closeModal(modal);

              } catch (err) {

                console.error(err);

                let message =
                  "حدث خطأ أثناء الحفظ";

                if (
                  err.message ===
                  "GITHUB_TOKEN_MISSING"
                ) {

                  message =
                    "أدخل GitHub Token من زر ⚙️ GitHub أولاً";

                } else if (
                  err.message ===
                  "FILE_TOO_LARGE"
                ) {

                  message =
                    "الملف أكبر من 90MB";

                } else if (
                  err.message?.includes(
                    "Resource not accessible"
                  )
                ) {

                  message =
                    "التوكن ليس لديه صلاحية الكتابة على الريبو";

                }

                toast(
                  message,
                  "error"
                );

                submitBtn.disabled =
                  false;

                submitBtn.textContent =
                  "حفظ";
              }
            }
          );
      },
    }
  );

  return ov;
}
