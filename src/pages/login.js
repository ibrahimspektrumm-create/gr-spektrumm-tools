import { login, toast } from "../modules/core.js";

export function renderLogin(rootEl) {
  rootEl.innerHTML = `
    <div id="bg-canvas"></div><div id="bg-grid"></div>
    <div class="login-screen">
      <div class="glass-card login-card">
        <div class="brand" style="justify-content:center;padding-bottom:22px;">
          <div class="brand-glyph" style="width:46px;height:46px;font-size:16px;">GR</div>
          <div class="brand-text" style="font-size:19px;">SPEKTRUMM<small>OMEGA X CORE — ACCESS TERMINAL</small></div>
        </div>
        <form id="login-form">
          <div class="field">
            <label>البريد الإلكتروني</label>
            <input type="email" id="login-email" required autocomplete="username" />
          </div>
          <div class="field">
            <label>كلمة المرور</label>
            <input type="password" id="login-password" required autocomplete="current-password" />
          </div>
          <button class="btn btn-primary" type="submit" style="width:100%;justify-content:center;margin-top:6px;" id="login-submit">
            🔐 دخول النظام
          </button>
        </form>
        <p class="text-muted" style="text-align:center;font-size:11.5px;margin-top:18px;">
          الحسابات تُنشأ بواسطة الـ Admin فقط عبر الإعدادات.
        </p>
      </div>
    </div>
    <style>
      .login-screen { min-height: 100vh; display:flex; align-items:center; justify-content:center; padding:16px; }
      .login-card { width: 380px; max-width:100%; padding: 32px 28px; }
    </style>
  `;

  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("login-submit");
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    btn.disabled = true;
    btn.textContent = "جارِ الدخول…";
    try {
      await login(email, password);
    } catch (err) {
      toast(mapAuthError(err.code), "error");
      btn.disabled = false;
      btn.innerHTML = "🔐 دخول النظام";
    }
  });
}

function mapAuthError(code) {
  const map = {
    "auth/invalid-email": "البريد الإلكتروني غير صحيح",
    "auth/user-not-found": "الحساب غير موجود",
    "auth/wrong-password": "كلمة المرور غير صحيحة",
    "auth/invalid-credential": "بيانات الدخول غير صحيحة",
    "auth/too-many-requests": "محاولات كثيرة، حاول لاحقًا",
  };
  return map[code] || "تعذّر تسجيل الدخول";
}
