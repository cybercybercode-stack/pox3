# 🤖 بوت تلجرام لإدارة قاعدة بيانات PostgreSQL (نسخة Netlify Serverless)

نسخة **طبق الأصل 100%** من بوت الإدارة المكتوب بلغة بايثون (`telegram_admin_bot`)، ولكن أعيد بناؤها بالكامل باستخدام **Node.js (grammY)** ومجهزة خصيصاً للاستضافة السحابية المجانية الدائمة على **[Netlify.com](https://www.netlify.com/)** عبر ميزة **Netlify Serverless Functions (Webhooks)** بدون الحاجة إلى خادم VPS يعمل 24 ساعة!

---

## 🌟 مميزات هذه النسخة المخصصة لـ Netlify

1. **دعم كامل لبيئة Netlify Serverless**:
   - يعمل بنظام **Telegram Webhooks** الفوري، حيث تستيقظ الدالة وتجيب في أجزاء من الثانية ثم تغلق تلقائياً (صفر استهلاك للموارد).
2. **استمرارية الجلسات (Serverless FSM)**:
   - تم حل مشكلة فقدان الذاكرة في الاستضافات السحابية بتخزين خطوات المعالج (Wizards) والجلسات التفاعلية داخل قاعدة بيانات Neon تلقائياً في جدول `bot_sessions`.
3. **أزرار تفعيل الـ Webhook بنقرة واحدة**:
   - صفحة ويب حديثة مرفقة (`public/index.html`) تتيح لك ربط البوت بتلجرام بنقرة زر واحدة فور النشر على Netlify.
4. **دعم التشغيل والتجربة المحلية (Long Polling)**:
   - يمكنك تجربة البوت وتطويره على جهازك المحلي بأمر واحد `npm start` بدون الحاجة لإنشاء Webhook.
5. **تصدير Excel فخم وسريع**:
   - استخدام مكتبة `exceljs` لتوليد ملفات `.xlsx` بنفس التنسيق الاحترافي والألوان الزرقاء الأنيقة لجدول الأكواد والطلبات.
6. **محطة استعلامات SQL حية**:
   - إمكانية كتابة أي أمر SQL وتنفيذه وعرض الناتج في جدول شبكي منسق.

---

## 📁 هيكل المشروع

```text
telegram_admin_bot_netlify/
├── netlify.toml                # إعدادات نشر Netlify والتوجيهات السريعة (/api/bot)
├── package.json                # التبعيات وأوامر التشغيل
├── .env.example                # نموذج متغيرات البيئة
├── public/
│   └── index.html              # لوحة حالة الموقع وزر تفعيل الـ Webhook بنقرة واحدة
├── netlify/
│   └── functions/
│       ├── bot.js              # دالة Netlify Serverless لمعالجة رسائل تلجرام
│       └── set-webhook.js      # دالة ربط البوت بالـ Webhook تلقائياً
└── src/
    ├── config.js               # إعدادات الاتصال والمتغيرات
    ├── database.js             # مجمع اتصالات PostgreSQL والعمليات
    ├── tablesFormatter.js      # تنسيق الجداول والبطاقات والشبكات
    ├── keyboards.js            # لوحات الأزرار التفاعلية (Inline Keyboards)
    ├── bot.js                  # محرك البوت ومعالجات الأوامر والحالات
    ├── local.js                # ملف التشغيل المحلي بوضع Polling
    └── setWebhook.js           # أداة الطرفية لضبط الـ Webhook
```

---

## 🚀 طريقة التشغيل والتجربة على جهازك المحلي (Local Testing)

1. ادخل إلى المجلد:
   ```bash
   cd telegram_admin_bot_netlify
   ```

2. قم بتشغيل البوت محلياً (وضع Polling):
   ```bash
   npm start
   ```
   أو:
   ```bash
   npm run dev
   ```

3. افتح تلجرام وأرسل `/start` للبوت وابدأ بالتحكم الكامل عبر الأزرار التفاعلية!

---

## 🌐 خطوات الاستضافة والنشر على Netlify.com

### الطريقة الأولى: عبر GitHub (الأسهل والمفضلة)

1. قم بإنشاء مستودع جديد على **GitHub** وارفع عليه محتويات مجلد `telegram_admin_bot_netlify`.
2. ادخل إلى حسابك في [Netlify.com](https://app.netlify.com/).
3. اضغط على **"Add new site"** ثم **"Import an existing project"**.
4. اختر **GitHub** وحدد المستودع الخاص بك.
5. إعدادات البناء (Build settings) يتم التقاطها تلقائياً من `netlify.toml`:
   - **Publish directory:** `public`
   - **Functions directory:** `netlify/functions`
6. أضف **متغيرات البيئة (Environment Variables)** في Netlify:
   - انتقل إلى **Site configuration > Environment variables > Add a variable**:
     * `BOT_TOKEN`: توكن البوت الخاص بك من BotFather
     * `DATABASE_URL`: رابط اتصال قاعدة بيانات Neon PostgreSQL
     * `ADMIN_PIN`: كلمة مرور المشرفين (افتراضياً: `layal2026`)
     * `ADMIN_CHAT_IDS`: معرف المشرف (مثال: `8386457782`)
7. اضغط **Deploy Site**.

---

### تفعيل الـ Webhook بعد النشر:

بمجرد اكتمال النشر والحصول على رابط موقعك (مثال: `https://your-bot-name.netlify.app`):

- **الخيار الأول (الأسهل):** افتح رابط موقعك في المتصفح، واضغط على الزر:
  `⚡ تفعيل وتحديث Webhook تلجرام بنقرة واحدة`
  وسيتم ربطه فوراً وتأكيد العملية بنجاح!
- **الخيار الثاني:** افتح الرابط المباشر في المتصفح:
  `https://your-bot-name.netlify.app/api/set-webhook`
- **الخيار الثالث:** تشغيل الأمر من جهازك:
  ```bash
  npm run set-webhook https://your-bot-name.netlify.app/api/bot
  ```

---

## 🔒 أمان المشرفين (Admins)
- إذا حاول مستخدم غير مسجل الدخول، سيطلب منه إرسال:
  `/auth كلمة_المرور`
- بعد إدخال كلمة المرور الصحيحة، يتم تسجيل حسابه في جدول `bot_admins` بقاعدة البيانات ليبقى مشرفاً دائماً حتى لو أعيد تشغيل الخادم السحابي.
