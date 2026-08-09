import { auth, db } from "../firebase-config.js";
import {
  createUserWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, setDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { state, toast, confirmDialog, openModal, closeModal, escapeHtml } from "../modules/core.js";
import { getAllOnce } from "../modules/db.js";

const ROLE_LABEL = { admin: "Admin", manager: "Manager", user: "User" };

export function renderSettings(container) {
  container.innerHTML = `
    <div class="section-title">⚙️ الإعدادات</div>
    <div class="glass-card card" style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div class="section-title" style="font-size:15px;margin:0;">👤 إدارة المستخدمين</div>
        <button class="btn btn-primary btn-sm" id="add-user-btn">+ إضافة مستخدم</button>
      </div>
      <div id="users-table" style="margin-top:14px;"></div>
    </div>
    <div class="glass-card card">
      <div class="section-title" style="font-size:15px;">📦 نسخ احتياطي</div>
      <p class="text-muted" style="font-size:12.5px;">تصدير كامل بيانات الموقع كملف JSON.</p>
      <button class="btn btn-ghost" id="export-btn">⬇ تصدير كل البيانات</button>
    </div>
  `;

  renderUsersTable();
  container.querySelector("#add-user-btn").addEventListener("click", openAddUserModal);
  container.querySelector("#export-btn").addEventListener("click", exportAllData);
}

function renderUsersTable() {
  const host = document.getElementById("users-table");
  const users = Object.values(state.usersCache).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  if (!users.length) {
    host.innerHTML = `<div class="empty-state">لا يوجد مستخدمون</div>`;
    return;
  }
  host.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="text-align:right;color:var(--text-2);"><th style="padding:8px;">الاسم</th><th>البريد</th><th>الدور</th><th></th></tr></thead>
      <tbody>
        ${users
          .map(
            (u) => `
          <tr style="border-top:1px solid var(--glass-border);">
            <td style="padding:8px;">${escapeHtml(u.name)}</td>
            <td class="text-muted">${escapeHtml(u.email)}</td>
            <td>
              <select data-role-uid="${u.uid}" ${u.uid === state.user.uid ? "disabled" : ""}>
                ${Object.entries(ROLE_LABEL).map(([k, v]) => `<option value="${k}" ${u.role === k ? "selected" : ""}>${v}</option>`).join("")}
              </select>
            </td>
            <td>${u.uid === state.user.uid ? "" : `<button class="btn btn-danger btn-sm" data-del-uid="${u.uid}">حذف</button>`}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`;

  host.querySelectorAll("[data-role-uid]").forEach((el) =>
    el.addEventListener("change", async () => {
      try {
        await updateDoc(doc(db, "users", el.dataset.roleUid), { role: el.value });
        toast("تم تحديث الصلاحية", "success");
      } catch (err) {
        console.error(err);
        toast("تعذّر التحديث", "error");
      }
    })
  );
  host.querySelectorAll("[data-del-uid]").forEach((el) =>
    el.addEventListener("click", async () => {
      if (await confirmDialog("حذف المستخدم", "سيتم حذف بيانات المستخدم من قاعدة البيانات (يجب حذف حساب الدخول يدويًا من Firebase Console أيضًا). تأكيد؟")) {
        await deleteDoc(doc(db, "users", el.dataset.delUid));
        toast("تم حذف بيانات المستخدم", "success");
      }
    })
  );
}

function openAddUserModal() {
  const ov = openModal(
    `
    <h3>إضافة مستخدم جديد</h3>
    <form id="user-form">
      <div class="field"><label>الاسم</label><input id="nu-name" required /></div>
      <div class="field"><label>البريد الإلكتروني</label><input id="nu-email" type="email" required /></div>
      <div class="field"><label>كلمة المرور المبدئية</label><input id="nu-pass" type="text" required minlength="6" /></div>
      <div class="field"><label>الدور</label>
        <select id="nu-role">
          <option value="user">User</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <p class="text-muted" style="font-size:11.5px;">ملاحظة: إنشاء الحساب سيسجّلك أنت مؤقتًا خروج ثم دخول تلقائي بحساب الأدمن (سلوك طبيعي لـ Firebase Auth من المتصفح).</p>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-close-modal>إلغاء</button>
        <button type="submit" class="btn btn-primary">إنشاء الحساب</button>
      </div>
    </form>`,
    {
      onMount: (ov) =>
        ov.querySelector("#user-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const name = ov.querySelector("#nu-name").value.trim();
          const email = ov.querySelector("#nu-email").value.trim();
          const password = ov.querySelector("#nu-pass").value;
          const role = ov.querySelector("#nu-role").value;
          try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(doc(db, "users", cred.user.uid), { name, email, role, createdAt: Date.now() });
            toast("تم إنشاء الحساب", "success");
            closeModal(ov);
          } catch (err) {
            console.error(err);
            toast("تعذّر إنشاء الحساب: " + (err.message || ""), "error");
          }
        }),
    }
  );
}

async function exportAllData() {
  toast("جارِ تجهيز التصدير…", "info");
  try {
    const collections = ["tasks", "tools", "excelFiles", "solutions", "guides", "users"];
    const data = {};
    for (const c of collections) data[c] = await getAllOnce(c);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gr-spektrumm-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("تم التصدير بنجاح", "success");
  } catch (err) {
    console.error(err);
    toast("فشل التصدير", "error");
  }
}
