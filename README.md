# GR Spektrumm Tools

نقطة تجميع واحدة للمهام، الأدوات، ملفات Excel، الحلول والشروحات. مبني بـ Vanilla JS (ES Modules) + Firebase — بدون خطوة Build، جاهز للرفع مباشرة.

## 1. إعداد مشروع Firebase

1. روح على [console.firebase.google.com](https://console.firebase.google.com) وأنشئ مشروع جديد.
2. من **Build → Authentication → Sign-in method** فعّل **Email/Password**.
3. من **Build → Firestore Database** أنشئ قاعدة بيانات (اختر Production mode).
4. من **Build → Storage** فعّل Storage.
5. من **Project settings → General → Your apps** أضف Web App، وانسخ بيانات `firebaseConfig`.
6. الصق البيانات دي في `src/firebase-config.js` بدل القيم الوهمية (`YOUR_API_KEY` ...إلخ).

## 2. إنشاء أول حساب Admin

الحسابات بتتعمل من صفحة الإعدادات (Admin فقط)، فأول حساب لازم يتعمل يدويًا:

1. من **Authentication → Users → Add user** أنشئ حساب بريد/باسورد.
2. من **Firestore Database** أنشئ مستند يدويًا في collection اسمه `users`، الـ Document ID = الـ UID بتاع الحساب اللي عملته، وحطّ فيه:
   ```json
   { "name": "اسمك", "email": "بريدك", "role": "admin", "createdAt": 0 }
   ```
3. دلوقتي تقدر تسجل دخول بهذا الحساب وتضيف باقي المستخدمين من صفحة **الإعدادات** داخل الموقع.

> ملاحظة: إنشاء مستخدم جديد من صفحة الإعدادات بيستخدم Firebase Client SDK، واللي بطبيعته بيسجّلك دخول تلقائيًا بالحساب الجديد بعد إنشائه (قيد معروف في Firebase Auth من المتصفح). لو حبيت تتجنب الحاجة دي مستقبلاً، الحل الاحترافي هو نقل إنشاء المستخدمين لـ **Cloud Function** بصلاحيات Admin SDK.

## 3. رفع المشروع على GitHub

```bash
cd gr-spektrumm-tools
git init
git add .
git commit -m "GR Spektrumm Tools — initial build"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/gr-spektrumm-tools.git
git push -u origin main
```

## 4. النشر عبر Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase use --add          # اختر مشروعك اللي عملته فوق
firebase deploy
```

هيتم نشر الـ Hosting + Firestore Rules + Storage Rules في أمر واحد. الرابط النهائي هيظهر في الـ Terminal بعد النشر (`https://YOUR_PROJECT.web.app`).

للتحديثات بعد كده، أي تعديل في الكود:
```bash
git add . && git commit -m "update" && git push
firebase deploy
```

## 5. أيقونات PWA

حط ملفين `icon-192.png` و `icon-512.png` جوه `public/icons/` (شعار GR بهوية JARVIS OMEGA X) عشان الموقع يبقى Installable بشكل كامل على الموبايل.

## هيكل المشروع

```
gr-spektrumm-tools/
├── index.html
├── firebase.json
├── firestore.rules
├── storage.rules
├── .firebaserc
├── public/
│   ├── manifest.json
│   ├── sw.js
│   └── icons/
└── src/
    ├── main.js
    ├── firebase-config.js
    ├── styles/theme.css
    ├── modules/        # core (auth+router+ui), db, notifications, prayerTimes
    ├── components/      # shell.js (sidebar/topbar/command bar)
    └── pages/           # dashboard, tasks, team, chat, tools, excel, solutions, guides, settings, help, about
```

## الأدوار

- **Admin**: تحكم كامل، إدارة المستخدمين، الإعدادات.
- **Manager**: متابعة كل التاسكات، تذكير وتعليق، بدون وصول للإعدادات وبدون حذف تاسكات غيره.
- **User**: يشوف الأدوات/الملفات/الحلول/الشروحات (قراءة فقط)، يدير تاسكاته الخاصة.

Firestore Security Rules (`firestore.rules`) بتفرض نفس الصلاحيات دي على مستوى قاعدة البيانات مباشرة، مش بس في الواجهة.
