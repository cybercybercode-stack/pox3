/**
 * محرك البوت الرئيسي ومعالجات الرسائل والأزرار التفاعلية
 * متوافق 100% مع بيئة التشغيل السحابية Netlify Functions (Webhook) والتشغيل المحلي (Polling)
 * نسخة Node.js طبق الأصل من handlers.py و bot.py
 */
const { Bot, InputFile } = require("grammy");
const { BOT_TOKEN, ADMIN_SECRET_PIN, PAGE_SIZE } = require("./config");
const DatabaseManager = require("./database");
const {
  formatCodeCard,
  formatCodesTableGrid,
  formatOrderCard,
  formatOrdersTableGrid,
  formatDashboardStats,
  formatGenericTable,
  formatSchemaView,
} = require("./tablesFormatter");
const {
  mainMenuKb,
  codesListKb,
  codeActionsKb,
  codeExtendKb,
  codeDeleteConfirmKb,
  ordersListKb,
  orderActionsKb,
  tablesListKb,
  genericTableKb,
  exportMenuKb,
  cancelKb,
} = require("./keyboards");

// إنشاء كائن البوت مع خيارات ParseMode = HTML واختصار botInfo لبيئات الـ Serverless
const bot = new Bot(BOT_TOKEN, {
  botInfo: {
    id: 6230762566,
    is_bot: true,
    first_name: "لوحة تحكم",
    username: "wwdfddgbot",
    can_join_groups: true,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
    can_connect_to_business: false,
    has_main_web_app: false,
  }
});

// ==========================================
// وسيط التحقق الأمني من المشرفين وحفظ الجلسات
// ==========================================
bot.use(async (ctx, next) => {
  // تمرير التحديثات غير المتعلقة بالرسائل والأزرار
  if (!ctx.from) return await next();

  // السماح بأمر /auth للمستخدمين الجدد
  const text = ctx.message?.text || "";
  if (text.startsWith("/auth")) {
    return await next();
  }

  // فحص الصلاحية الإدارية
  const chatId = ctx.from.id;
  const isAdm = await DatabaseManager.isAdmin(chatId);

  if (!isAdm) {
    if (ctx.message) {
      await ctx.reply(
        "🔒 <b>عذراً، هذا البوت مخصص لإدارة قواعد البيانات فقط ومحمي بكلمة مرور.</b>\n\n" +
          "إذا كنت المشرف، أرسل كلمة المرور بالشكل التالي:\n" +
          "<code>/auth كلمة_المرور</code>",
        { parse_mode: "HTML" }
      );
    } else if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({
        text: "🔒 غير مصرح لك، يرجى تسجيل الدخول أولاً.",
        show_alert: true,
      });
    }
    return;
  }

  await next();
});

// ==========================================
// أوامر البوت الأساسية (/start, /auth, /menu, /stats)
// ==========================================
bot.command("start", async (ctx) => {
  await DatabaseManager.clearSession(ctx.from.id);
  const stats = await DatabaseManager.getDashboardStats();
  const text =
    `👋 مرحباً بك يا <b>${ctx.from.first_name || "مشرف"}</b> في لوحة الإدارة المتكاملة!\n\n` +
    `قاعدة البيانات: <b>Neon PostgreSQL (layal)</b> 🐘\n\n` +
    `${formatDashboardStats(stats)}\n\n` +
    `اختر من القائمة التفاعلية بالأسفل لبدء الإدارة السريعة:`;

  await ctx.reply(text, {
    reply_markup: mainMenuKb(),
    parse_mode: "HTML",
  });
});

bot.command("auth", async (ctx) => {
  const parts = (ctx.message.text || "").trim().split(/\s+/);
  if (parts.length < 2) {
    await ctx.reply(
      "⚠️ يرجى إدخال كلمة المرور مع الأمر:\nمثال: <code>/auth كلمة_السر</code>",
      { parse_mode: "HTML" }
    );
    return;
  }

  const enteredPin = parts[1].trim();
  if (enteredPin === ADMIN_SECRET_PIN) {
    await DatabaseManager.saveAdmin(ctx.from.id);
    await ctx.reply(
      "✅ <b>تم التحقق بنجاح! أصبحت الآن مشرفاً مصرحاً لك.</b>",
      { parse_mode: "HTML" }
    );
    // عرض لوحة التحكم
    const stats = await DatabaseManager.getDashboardStats();
    await ctx.reply(
      `👋 مرحباً بك يا <b>${ctx.from.first_name || "مشرف"}</b>!\n\n` +
        formatDashboardStats(stats),
      { reply_markup: mainMenuKb(), parse_mode: "HTML" }
    );
  } else {
    await ctx.reply("❌ كلمة المرور غير صحيحة.");
  }
});

bot.command("menu", async (ctx) => {
  await DatabaseManager.clearSession(ctx.from.id);
  await ctx.reply("📋 <b>القائمة الرئيسية للإدارة:</b>", {
    reply_markup: mainMenuKb(),
    parse_mode: "HTML",
  });
});

bot.command("stats", async (ctx) => {
  const stats = await DatabaseManager.getDashboardStats();
  await ctx.reply(formatDashboardStats(stats), {
    reply_markup: mainMenuKb(),
    parse_mode: "HTML",
  });
});

// ==========================================
// معالجة القائمة الرئيسية (Navigation Callbacks)
// ==========================================
bot.callbackQuery("m:home", async (ctx) => {
  await DatabaseManager.clearSession(ctx.from.id);
  await ctx.answerCallbackQuery();
  const stats = await DatabaseManager.getDashboardStats();
  const text = `📋 <b>لوحة التحكم الرئيسية</b>\n\n${formatDashboardStats(stats)}`;
  try {
    await ctx.editMessageText(text, {
      reply_markup: mainMenuKb(),
      parse_mode: "HTML",
    });
  } catch (e) {
    console.warn("m:home edit error:", e.message);
  }
});

bot.callbackQuery("m:refresh", async (ctx) => {
  await ctx.answerCallbackQuery({ text: "🔄 تم تحديث البيانات بنجاح!" });
  const stats = await DatabaseManager.getDashboardStats();
  const text = `📋 <b>لوحة التحكم الرئيسية (محدثة)</b>\n\n${formatDashboardStats(stats)}`;
  try {
    await ctx.editMessageText(text, {
      reply_markup: mainMenuKb(),
      parse_mode: "HTML",
    });
  } catch (e) {
    console.warn("m:refresh edit error:", e.message);
  }
});

bot.callbackQuery("m:stats", async (ctx) => {
  await ctx.answerCallbackQuery();
  const stats = await DatabaseManager.getDashboardStats();
  const { InlineKeyboard } = require("grammy");
  const kb = new InlineKeyboard()
    .text("🔄 تحديث الأرقام", "m:stats")
    .row()
    .text("🔙 القائمة الرئيسية", "m:home");

  try {
    await ctx.editMessageText(formatDashboardStats(stats), {
      reply_markup: kb,
      parse_mode: "HTML",
    });
  } catch (e) {
    console.warn("m:stats edit error:", e.message);
  }
});

bot.callbackQuery("noop", async (ctx) => {
  await ctx.answerCallbackQuery();
});

// ==========================================
// إدارة رموز التفعيل (Activation Codes Callbacks)
// ==========================================
bot.callbackQuery(/^c:list:(.+):(\d+)$/, async (ctx) => {
  await DatabaseManager.clearSession(ctx.from.id);
  await ctx.answerCallbackQuery();
  const filterType = ctx.match[1];
  const page = parseInt(ctx.match[2], 10);

  const { rows, totalCount } = await DatabaseManager.getActivationCodes({
    filter_type: filterType,
    page,
    page_size: PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const text = formatCodesTableGrid(rows, page, totalPages, totalCount);
  const kb = codesListKb(rows, filterType, page, totalPages);

  try {
    await ctx.editMessageText(text, { reply_markup: kb, parse_mode: "HTML" });
  } catch (e) {
    console.warn("c:list edit error:", e.message);
  }
});

bot.callbackQuery(/^c:view:(\d+)$/, async (ctx) => {
  await DatabaseManager.clearSession(ctx.from.id);
  await ctx.answerCallbackQuery();
  const codeId = parseInt(ctx.match[1], 10);
  const codeData = await DatabaseManager.getActivationCodeById(codeId);

  if (!codeData) {
    await ctx.answerCallbackQuery({
      text: "⚠️ رمز التفعيل غير موجود أو تم حذفه!",
      show_alert: true,
    });
    return;
  }

  const text = formatCodeCard(codeData);
  const hasDevice = Boolean(codeData.device_id);
  const isDeviceLocked =
    codeData.is_device_locked === null || codeData.is_device_locked === undefined
      ? true
      : Boolean(codeData.is_device_locked);

  const kb = codeActionsKb(codeId, Boolean(codeData.is_active), hasDevice, isDeviceLocked);

  try {
    await ctx.editMessageText(text, { reply_markup: kb, parse_mode: "HTML" });
  } catch (e) {
    console.warn("c:view edit error:", e.message);
  }
});

bot.callbackQuery(/^c:toggle:(\d+)$/, async (ctx) => {
  const codeId = parseInt(ctx.match[1], 10);
  const newState = await DatabaseManager.toggleActivationCode(codeId);
  const stateMsg = newState ? "🟢 تم تفعيل الكود بنجاح!" : "🔴 تم تعطيل الكود بنجاح!";
  await ctx.answerCallbackQuery({ text: stateMsg, show_alert: true });

  const codeData = await DatabaseManager.getActivationCodeById(codeId);
  if (!codeData) return;

  const text = formatCodeCard(codeData);
  const hasDevice = Boolean(codeData.device_id);
  const isDeviceLocked =
    codeData.is_device_locked === null || codeData.is_device_locked === undefined
      ? true
      : Boolean(codeData.is_device_locked);

  const kb = codeActionsKb(codeId, newState, hasDevice, isDeviceLocked);
  try {
    await ctx.editMessageText(text, { reply_markup: kb, parse_mode: "HTML" });
  } catch (e) {
    console.warn("c:toggle edit error:", e.message);
  }
});

bot.callbackQuery(/^c:toggle_dev:(\d+)$/, async (ctx) => {
  const codeId = parseInt(ctx.match[1], 10);
  const codeDataBefore = await DatabaseManager.getActivationCodeById(codeId);
  if (!codeDataBefore) {
    await ctx.answerCallbackQuery({ text: "⚠️ الرمز غير موجود!", show_alert: true });
    return;
  }

  const newVal = await DatabaseManager.toggleDeviceLock(codeId);
  const codeData = await DatabaseManager.getActivationCodeById(codeId);
  const text = formatCodeCard(codeData);
  const hasDevice = Boolean(codeData.device_id);
  const kb = codeActionsKb(
    codeId,
    Boolean(codeData.is_active),
    hasDevice,
    Boolean(newVal)
  );

  try {
    await ctx.editMessageText(text, { reply_markup: kb, parse_mode: "HTML" });
  } catch (e) {
    console.warn("c:toggle_dev edit error:", e.message);
  }

  if (newVal) {
    await ctx.answerCallbackQuery({
      text: "🔒 تم تفعيل التقييد! هذا الكود سيعمل على جهاز واحد فقط.",
    });
  } else {
    await ctx.answerCallbackQuery({
      text: "🌐 تم إلغاء التقييد! الكود الآن متاح للاستخدام على أي جهاز.",
    });
  }
});

bot.callbackQuery(/^c:reset_dev:(\d+)$/, async (ctx) => {
  const codeId = parseInt(ctx.match[1], 10);
  const codeDataBefore = await DatabaseManager.getActivationCodeById(codeId);
  if (!codeDataBefore) {
    await ctx.answerCallbackQuery({ text: "⚠️ الرمز غير موجود!", show_alert: true });
    return;
  }

  await DatabaseManager.resetDeviceLock(codeId);
  await ctx.answerCallbackQuery({
    text: "🔓 تم فك ربط الهاتف بنجاح! يمكن للمشترك الآن الدخول من هاتفه الجديد.",
    show_alert: true,
  });

  const codeData = await DatabaseManager.getActivationCodeById(codeId);
  const text = formatCodeCard(codeData);
  const isDeviceLocked =
    codeData.is_device_locked === null || codeData.is_device_locked === undefined
      ? true
      : Boolean(codeData.is_device_locked);

  const kb = codeActionsKb(
    codeId,
    Boolean(codeData.is_active),
    false,
    isDeviceLocked
  );
  try {
    await ctx.editMessageText(text, { reply_markup: kb, parse_mode: "HTML" });
  } catch (e) {
    console.warn("c:reset_dev edit error:", e.message);
  }
});

bot.callbackQuery(/^c:extend:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const codeId = parseInt(ctx.match[1], 10);
  const text =
    `⏳ <b>تمديد صلاحية رمز التفعيل #${codeId}</b>\n\n` +
    `اختر المدة المراد إضافتها إلى تاريخ الانتهاء الحالي:\n` +
    `<i>(ملاحظة: يمكنك التمديد بالساعات أو الأيام، وإذا كان الكود منتهياً فسيتم الحساب بدءاً من الآن)</i>`;

  try {
    await ctx.editMessageText(text, {
      reply_markup: codeExtendKb(codeId),
      parse_mode: "HTML",
    });
  } catch (e) {
    console.warn("c:extend edit error:", e.message);
  }
});

bot.callbackQuery(/^c:ext_do:(\d+):(.+)$/, async (ctx) => {
  const codeId = parseInt(ctx.match[1], 10);
  const durArg = ctx.match[2];

  await DatabaseManager.extendCodeExpiry(codeId, durArg);
  const durLabel = DatabaseManager.formatDurationLabel(durArg);

  const msg =
    durArg === "lifetime"
      ? "♾️ تم جعل الصلاحية دائمة بنجاح!"
      : `⏳ تم تمديد الصلاحية بمقدار ${durLabel} بنجاح!`;

  await ctx.answerCallbackQuery({ text: msg, show_alert: true });

  const codeData = await DatabaseManager.getActivationCodeById(codeId);
  if (!codeData) return;

  const text = formatCodeCard(codeData);
  const hasDevice = Boolean(codeData.device_id);
  const isDeviceLocked =
    codeData.is_device_locked === null || codeData.is_device_locked === undefined
      ? true
      : Boolean(codeData.is_device_locked);

  const kb = codeActionsKb(
    codeId,
    Boolean(codeData.is_active),
    hasDevice,
    isDeviceLocked
  );
  try {
    await ctx.editMessageText(text, { reply_markup: kb, parse_mode: "HTML" });
  } catch (e) {
    console.warn("c:ext_do edit error:", e.message);
  }
});

bot.callbackQuery(/^c:ext_custom:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const codeId = parseInt(ctx.match[1], 10);
  await DatabaseManager.setSession(ctx.from.id, "extend_code_custom_duration", {
    extend_code_id: codeId,
  });

  const { InlineKeyboard } = require("grammy");
  const kb = new InlineKeyboard().text("🔙 رجوع", `c:extend:${codeId}`);
  const text =
    `✍️ <b>تمديد صلاحية رمز التفعيل #${codeId} يدوياً:</b>\n\n` +
    `أرسل المدة المراد إضافتها (ساعات أو أيام):\n` +
    `• أمثلة: <code>3h</code>، <code>8 ساعات</code>، <code>يوم واحد</code>، <code>15d</code>، <code>45</code>`;

  try {
    await ctx.editMessageText(text, { reply_markup: kb, parse_mode: "HTML" });
  } catch (e) {
    console.warn("c:ext_custom edit error:", e.message);
  }
});

bot.callbackQuery(/^c:del_ask:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const codeId = parseInt(ctx.match[1], 10);
  const text =
    `⚠️ <b>تحذير: هل أنت متأكد من حذف رمز التفعيل #${codeId} نهائياً؟</b>\n\n` +
    `لن يتمكن المشترك من استخدام التطبيق بهذا الكود بعد حذفه.`;

  try {
    await ctx.editMessageText(text, {
      reply_markup: codeDeleteConfirmKb(codeId),
      parse_mode: "HTML",
    });
  } catch (e) {
    console.warn("c:del_ask edit error:", e.message);
  }
});

bot.callbackQuery(/^c:del_confirm:(\d+)$/, async (ctx) => {
  const codeId = parseInt(ctx.match[1], 10);
  await DatabaseManager.deleteActivationCode(codeId);
  await ctx.answerCallbackQuery({
    text: "🗑️ تم حذف رمز التفعيل نهائياً.",
    show_alert: true,
  });

  const { rows, totalCount } = await DatabaseManager.getActivationCodes({
    filter_type: "all",
    page: 1,
    page_size: PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const text = formatCodesTableGrid(rows, 1, totalPages, totalCount);
  const kb = codesListKb(rows, "all", 1, totalPages);

  try {
    await ctx.editMessageText(text, { reply_markup: kb, parse_mode: "HTML" });
  } catch (e) {
    console.warn("c:del_confirm edit error:", e.message);
  }
});

// ==========================================
// تعديل بيانات الرمز (Edit Code Wizard)
// ==========================================
bot.callbackQuery(/^c:edit:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const codeId = parseInt(ctx.match[1], 10);
  const codeData = await DatabaseManager.getActivationCodeById(codeId);
  if (!codeData) {
    await ctx.answerCallbackQuery({ text: "⚠️ الرمز غير موجود!", show_alert: true });
    return;
  }

  await DatabaseManager.setSession(ctx.from.id, "edit_code_user_name", {
    edit_code_id: codeId,
  });

  const { InlineKeyboard } = require("grammy");
  const kb = new InlineKeyboard()
    .text("⏩ الإبقاء على الاسم الحالي", "c:edit_keep_name")
    .row()
    .text("❌ إلغاء والتراجع", `c:view:${codeId}`);

  const text =
    `✏️ <b>تعديل بيانات رمز التفعيل #${codeId} (${codeData.code})</b>\n\n` +
    `الاسم الحالي: <b>${codeData.user_name || "غير محدد"}</b>\n\n` +
    `أرسل <b>الاسم الجديد للمشترك</b> أو اضغط على الإبقاء على الاسم الحالي:`;

  try {
    await ctx.editMessageText(text, { reply_markup: kb, parse_mode: "HTML" });
  } catch (e) {
    console.warn("c:edit edit error:", e.message);
  }
});

bot.callbackQuery("c:edit_keep_name", async (ctx) => {
  await ctx.answerCallbackQuery();
  const session = await DatabaseManager.getSession(ctx.from.id);
  await DatabaseManager.setSession(ctx.from.id, "edit_code_phone", {
    ...session.data,
    new_user_name: null,
  });

  const { InlineKeyboard } = require("grammy");
  const kb = new InlineKeyboard()
    .text("⏩ الإبقاء على الهاتف الحالي", "c:edit_keep_phone")
    .row()
    .text("❌ إلغاء", "m:home");

  try {
    await ctx.editMessageText(
      "📞 أرسل <b>رقم الهاتف الجديد</b> أو اضغط تخطي:",
      { reply_markup: kb, parse_mode: "HTML" }
    );
  } catch (e) {
    console.warn("c:edit_keep_name edit error:", e.message);
  }
});

bot.callbackQuery("c:edit_keep_phone", async (ctx) => {
  await ctx.answerCallbackQuery();
  const session = await DatabaseManager.getSession(ctx.from.id);
  const codeId = session.data?.edit_code_id;
  const newUserName = session.data?.new_user_name;
  await DatabaseManager.clearSession(ctx.from.id);

  if (codeId) {
    await DatabaseManager.updateCodeInfo(codeId, {
      user_name: newUserName,
      phone_number: null,
    });
    const codeData = await DatabaseManager.getActivationCodeById(codeId);
    const text =
      "✅ <b>تم تحديث بيانات الكود بنجاح!</b>\n\n" + formatCodeCard(codeData);
    const hasDevice = Boolean(codeData.device_id);
    const isDeviceLocked =
      codeData.is_device_locked === null || codeData.is_device_locked === undefined
        ? true
        : Boolean(codeData.is_device_locked);

    const kb = codeActionsKb(
      codeId,
      Boolean(codeData.is_active),
      hasDevice,
      isDeviceLocked
    );
    try {
      await ctx.editMessageText(text, { reply_markup: kb, parse_mode: "HTML" });
    } catch (e) {
      console.warn("c:edit_keep_phone edit error:", e.message);
    }
  }
});

// ==========================================
// البحث في الأكواد (Search Wizard)
// ==========================================
bot.callbackQuery("c:search", async (ctx) => {
  await ctx.answerCallbackQuery();
  await DatabaseManager.setSession(ctx.from.id, "waiting_for_code_search", {});
  const text =
    "🔍 <b>البحث السريع عن رمز تفعيل:</b>\n\n" +
    "أرسل جزءاً من (رمز التفعيل، اسم المشترك، أو رقم الهاتف) للبحث عنه:";

  try {
    await ctx.editMessageText(text, {
      reply_markup: cancelKb("c:list:all:1"),
      parse_mode: "HTML",
    });
  } catch (e) {
    console.warn("c:search edit error:", e.message);
  }
});

// ==========================================
// إنشاء كود جديد تفاعلياً (Add Code Wizard)
// ==========================================
bot.callbackQuery("c:add", async (ctx) => {
  await ctx.answerCallbackQuery();
  await DatabaseManager.setSession(ctx.from.id, "new_code_input", {});

  const { InlineKeyboard } = require("grammy");
  const kb = new InlineKeyboard()
    .text("🎲 توليد كود تلقائي فخم", "c:gen_auto_code")
    .row()
    .text("❌ إلغاء والتراجع", "c:list:all:1");

  const text =
    "➕ <b>إضافة رمز تفعيل جديد (الخطوة 1 من 4)</b>\n\n" +
    "أرسل رمز التفعيل المراد إنشاؤه (مثال: <code>LAYAL-VIP-01</code>)،\n" +
    "أو اضغط على زر <b>توليد كود تلقائي</b> بالأسفل لإنشاء كود عشوائي فوراً:";

  try {
    await ctx.editMessageText(text, { reply_markup: kb, parse_mode: "HTML" });
  } catch (e) {
    console.warn("c:add edit error:", e.message);
  }
});

bot.callbackQuery("c:gen_auto_code", async (ctx) => {
  await ctx.answerCallbackQuery({ text: "🎲 تم توليد الكود!" });
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let randomSuffix = "";
  for (let i = 0; i < 6; i++) {
    randomSuffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const generatedCode = `LAYAL-${randomSuffix}`;

  await DatabaseManager.setSession(ctx.from.id, "new_code_user_name", {
    code: generatedCode,
  });

  const { InlineKeyboard } = require("grammy");
  const kb = new InlineKeyboard()
    .text("⏩ تخطي بدون اسم", "c:skip_user_name")
    .row()
    .text("❌ إلغاء", "c:list:all:1");

  const text =
    `✅ تم اختيار الكود: <code>${generatedCode}</code>\n\n` +
    `👤 <b>الخطوة 2 من 4:</b> أرسل الآن <b>اسم المشترك / المندوب</b>:`;

  try {
    await ctx.editMessageText(text, { reply_markup: kb, parse_mode: "HTML" });
  } catch (e) {
    console.warn("c:gen_auto_code edit error:", e.message);
  }
});

bot.callbackQuery("c:skip_user_name", async (ctx) => {
  await ctx.answerCallbackQuery();
  const session = await DatabaseManager.getSession(ctx.from.id);
  await DatabaseManager.setSession(ctx.from.id, "new_code_phone", {
    ...session.data,
    user_name: null,
  });

  const { InlineKeyboard } = require("grammy");
  const kb = new InlineKeyboard()
    .text("⏩ تخطي الهاتف", "c:skip_phone")
    .row()
    .text("❌ إلغاء", "c:list:all:1");

  try {
    await ctx.editMessageText(
      "📞 <b>الخطوة 3 من 4:</b> أرسل <b>رقم هاتف المشترك</b> (أو اضغط تخطي):",
      { reply_markup: kb, parse_mode: "HTML" }
    );
  } catch (e) {
    console.warn("c:skip_user_name edit error:", e.message);
  }
});

function getDurationSelectionKb() {
  const { InlineKeyboard } = require("grammy");
  return new InlineKeyboard()
    .text("1 ساعة ⏱️", "c:set_dur:1h")
    .text("6 ساعات ⏱️", "c:set_dur:6h")
    .text("12 ساعة ⏱️", "c:set_dur:12h")
    .row()
    .text("يوم واحد (24 س) 🗓️", "c:set_dur:1d")
    .text("3 أيام 📅", "c:set_dur:3d")
    .text("7 أيام (أسبوع) 📅", "c:set_dur:7d")
    .row()
    .text("30 يوماً (شهر) 🗓️", "c:set_dur:30d")
    .text("90 يوماً (3 أشهر) 🚀", "c:set_dur:90d")
    .text("365 يوماً (سنة) ⭐", "c:set_dur:365d")
    .row()
    .text("♾️ صلاحية دائمة", "c:set_dur:lifetime")
    .text("✍️ إدخال مخصص", "c:set_dur:custom")
    .row()
    .text("❌ إلغاء", "c:list:all:1");
}

bot.callbackQuery("c:skip_phone", async (ctx) => {
  await ctx.answerCallbackQuery();
  const session = await DatabaseManager.getSession(ctx.from.id);
  await DatabaseManager.setSession(ctx.from.id, "new_code_expiry", {
    ...session.data,
    phone_number: null,
  });

  const text =
    "⏳ <b>الخطوة 4 من 4:</b> اختر <b>مدة صلاحية الرمز</b>:\n\n" +
    "<i>يمكنك تحديد المدة بالساعات أو الأيام أو كتابة مدة مخصصة.</i>";

  try {
    await ctx.editMessageText(text, {
      reply_markup: getDurationSelectionKb(),
      parse_mode: "HTML",
    });
  } catch (e) {
    console.warn("c:skip_phone edit error:", e.message);
  }
});

bot.callbackQuery("c:set_dur:custom", async (ctx) => {
  await ctx.answerCallbackQuery();
  const session = await DatabaseManager.getSession(ctx.from.id);
  await DatabaseManager.setSession(ctx.from.id, "new_code_custom_duration", session.data);

  const { InlineKeyboard } = require("grammy");
  const kb = new InlineKeyboard().text("❌ إلغاء", "c:list:all:1");
  const text =
    "✍️ <b>أرسل مدة صلاحية الرمز كتابةً:</b>\n\n" +
    "أمثلة مدعومة:\n" +
    "• بالساعات: <code>3h</code>، <code>8 ساعات</code>، <code>ساعتين</code>\n" +
    "• بالأيام: <code>1d</code>، <code>يوم واحد</code>، <code>15 يوم</code>، <code>45</code>\n" +
    "• أو أرسل الرقم فقط كأيام.";

  try {
    await ctx.editMessageText(text, { reply_markup: kb, parse_mode: "HTML" });
  } catch (e) {
    console.warn("c:set_dur:custom edit error:", e.message);
  }
});

bot.callbackQuery(/^c:set_dur:(.+)$/, async (ctx) => {
  const durArg = ctx.match[1];
  if (durArg === "custom") return; // تم التعامل معه أعلاه

  await ctx.answerCallbackQuery();
  const session = await DatabaseManager.getSession(ctx.from.id);
  const { code, user_name, phone_number } = session.data || {};
  await DatabaseManager.clearSession(ctx.from.id);

  if (!code) {
    await ctx.reply("⚠️ انتهت صلاحية الجلسة، يرجى المحاولة من جديد.");
    return;
  }

  const newId = await DatabaseManager.createActivationCode({
    code,
    user_name,
    phone_number,
    duration: durArg,
    notes: "تم الإنشاء عبر بوت تلجرام الإداري (Netlify)",
  });

  const codeData = await DatabaseManager.getActivationCodeById(newId);
  const text =
    `🎉 <b>تم إنشاء رمز التفعيل بنجاح!</b>\n\n` + formatCodeCard(codeData);
  const kb = codeActionsKb(newId, true, false, true);

  try {
    await ctx.editMessageText(text, { reply_markup: kb, parse_mode: "HTML" });
  } catch (e) {
    console.warn("c:set_dur edit error:", e.message);
  }
});

// ==========================================
// إدارة سجل الطلبات (Orders Callbacks)
// ==========================================
bot.callbackQuery(/^o:list:(.+):(\d+)$/, async (ctx) => {
  await DatabaseManager.clearSession(ctx.from.id);
  await ctx.answerCallbackQuery();
  const filterVal = ctx.match[1];
  const page = parseInt(ctx.match[2], 10);

  let actionFilter = null;
  if (filterVal === "accepted") actionFilter = "ACCEPTED";
  else if (filterVal === "rejected") actionFilter = "REJECTED";

  const { rows, totalCount } = await DatabaseManager.getOrders({
    page,
    page_size: PAGE_SIZE,
    action_filter: actionFilter,
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const text = formatOrdersTableGrid(rows, page, totalPages, totalCount);
  const kb = ordersListKb(rows, filterVal, page, totalPages);

  try {
    await ctx.editMessageText(text, { reply_markup: kb, parse_mode: "HTML" });
  } catch (e) {
    console.warn("o:list edit error:", e.message);
  }
});

bot.callbackQuery(/^o:view:(\d+)$/, async (ctx) => {
  await DatabaseManager.clearSession(ctx.from.id);
  await ctx.answerCallbackQuery();
  const orderId = parseInt(ctx.match[1], 10);
  const orderData = await DatabaseManager.getOrderById(orderId);

  if (!orderData) {
    await ctx.answerCallbackQuery({ text: "⚠️ الطلب غير موجود!", show_alert: true });
    return;
  }

  const text = formatOrderCard(orderData);
  const kb = orderActionsKb(orderId);

  try {
    await ctx.editMessageText(text, { reply_markup: kb, parse_mode: "HTML" });
  } catch (e) {
    console.warn("o:view edit error:", e.message);
  }
});

bot.callbackQuery(/^o:del:(\d+)$/, async (ctx) => {
  const orderId = parseInt(ctx.match[1], 10);
  await DatabaseManager.deleteOrder(orderId);
  await ctx.answerCallbackQuery({
    text: "🗑️ تم حذف سجل الطلب بنجاح.",
    show_alert: true,
  });

  const { rows, totalCount } = await DatabaseManager.getOrders({
    page: 1,
    page_size: PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const text = formatOrdersTableGrid(rows, 1, totalPages, totalCount);
  const kb = ordersListKb(rows, "all", 1, totalPages);

  try {
    await ctx.editMessageText(text, { reply_markup: kb, parse_mode: "HTML" });
  } catch (e) {
    console.warn("o:del edit error:", e.message);
  }
});

// ==========================================
// مستكشف الجداول الشامل (Dynamic Tables Explorer)
// ==========================================
bot.callbackQuery("t:list", async (ctx) => {
  await DatabaseManager.clearSession(ctx.from.id);
  await ctx.answerCallbackQuery();
  const tables = await DatabaseManager.getAllTables();
  const text =
    "🗄️ <b>مستكشف جداول قاعدة البيانات (PostgreSQL):</b>\n\n" +
    "اضغط على أي جدول لاستعراض سجلاته وهيكله الداخلي وتصديره مباشرة:";

  try {
    await ctx.editMessageText(text, {
      reply_markup: tablesListKb(tables),
      parse_mode: "HTML",
    });
  } catch (e) {
    console.warn("t:list edit error:", e.message);
  }
});

bot.callbackQuery(/^t:view:(.+):(\d+)$/, async (ctx) => {
  await DatabaseManager.clearSession(ctx.from.id);
  await ctx.answerCallbackQuery();
  const tname = ctx.match[1];
  const page = parseInt(ctx.match[2], 10);

  const { rows, columns, total } = await DatabaseManager.getTableData(tname, {
    page,
    page_size: PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const text = formatGenericTable(tname, columns, rows, page, total, PAGE_SIZE);
  const kb = genericTableKb(tname, page, totalPages);

  try {
    await ctx.editMessageText(text, { reply_markup: kb, parse_mode: "HTML" });
  } catch (e) {
    console.warn("t:view edit error:", e.message);
  }
});

bot.callbackQuery(/^t:schema:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const tname = ctx.match[1];
  const schemaCols = await DatabaseManager.getTableSchema(tname);
  const text = formatSchemaView(tname, schemaCols);

  const { InlineKeyboard } = require("grammy");
  const kb = new InlineKeyboard()
    .text(`📋 استعراض بيانات ${tname}`, `t:view:${tname}:1`)
    .row()
    .text("🔙 قائمة الجداول", "t:list");

  try {
    await ctx.editMessageText(text, { reply_markup: kb, parse_mode: "HTML" });
  } catch (e) {
    console.warn("t:schema edit error:", e.message);
  }
});

// ==========================================
// تصدير البيانات إلى Excel (Excel Export)
// ==========================================
bot.callbackQuery("exp:menu", async (ctx) => {
  await ctx.answerCallbackQuery();
  const tables = await DatabaseManager.getAllTables();
  const text =
    "📥 <b>تصدير جداول البيانات إلى Excel (.xlsx):</b>\n\n" +
    "اختر الجدول الذي تريد تصديره وتحميله فوراً:";

  try {
    await ctx.editMessageText(text, {
      reply_markup: exportMenuKb(tables),
      parse_mode: "HTML",
    });
  } catch (e) {
    console.warn("exp:menu edit error:", e.message);
  }
});

bot.callbackQuery(/^t:export:(.+)$/, async (ctx) => {
  const tname = ctx.match[1];
  await ctx.answerCallbackQuery({
    text: "⏳ جاري تجهيز وتصدير ملف Excel...",
  });

  try {
    const excelBuffer = await DatabaseManager.exportTableToExcel(tname);
    const inputFile = new InputFile(excelBuffer, `${tname}_export.xlsx`);

    await ctx.replyWithDocument(inputFile, {
      caption:
        `📊 <b>تم تصدير جدول <code>${tname}</code> بنجاح!</b>\n` +
        `الملف بتنسيق Microsoft Excel مجهّز بالكامل.`,
      parse_mode: "HTML",
    });
  } catch (e) {
    await ctx.reply(`❌ حدث خطأ أثناء التصدير: ${e.message}`);
  }
});

// ==========================================
// محطة استعلامات SQL المباشرة (SQL Console)
// ==========================================
bot.callbackQuery("sql:start", async (ctx) => {
  await ctx.answerCallbackQuery();
  await DatabaseManager.setSession(ctx.from.id, "waiting_for_sql", {});
  const text =
    "⚡ <b>محطة استعلامات SQL المباشرة (Neon DB)</b>\n\n" +
    "أرسل استعلام SQL لتنفيذه مباشرة على قاعدة البيانات.\n" +
    "<i>أمثلة:</i>\n" +
    "• <code>SELECT * FROM activation_codes LIMIT 3;</code>\n" +
    "• <code>SELECT user_name, count(*) FROM orders GROUP BY user_name;</code>\n" +
    "• <code>SELECT count(*) FROM orders WHERE action_taken = 'ACCEPTED';</code>\n\n" +
    "⚠️ تنبيه: الاستعلامات تنفذ مباشرة على قاعدة البيانات الحية.";

  try {
    await ctx.editMessageText(text, {
      reply_markup: cancelKb("m:home"),
      parse_mode: "HTML",
    });
  } catch (e) {
    console.warn("sql:start edit error:", e.message);
  }
});

// ==========================================
// معالجة الرسائل النصية المتتابعة (FSM Message Handler)
// ==========================================
bot.on("message:text", async (ctx) => {
  const text = ctx.message.text.trim();
  const session = await DatabaseManager.getSession(ctx.from.id);
  const state = session.state;

  if (!state) return; // ليس في أي حالة إدخال

  // 1. البحث في الأكواد
  if (state === "waiting_for_code_search") {
    await DatabaseManager.clearSession(ctx.from.id);
    const { rows, totalCount } = await DatabaseManager.getActivationCodes({
      filter_type: "all",
      page: 1,
      page_size: PAGE_SIZE,
      search_query: text,
    });
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    if (totalCount === 0) {
      await ctx.reply(
        `❌ لم يتم العثور على أي نتائج لكلمة البحث: <code>${text}</code>`,
        { reply_markup: cancelKb("c:list:all:1"), parse_mode: "HTML" }
      );
      return;
    }

    const msg =
      `🔍 <b>نتائج البحث عن:</b> <code>${text}</code>\n\n` +
      formatCodesTableGrid(rows, 1, totalPages, totalCount);
    const kb = codesListKb(rows, "all", 1, totalPages);
    await ctx.reply(msg, { reply_markup: kb, parse_mode: "HTML" });
    return;
  }

  // 2. إدخال كود جديد - كود مخصص
  if (state === "new_code_input") {
    const codeInput = text.toUpperCase();
    const existing = await DatabaseManager.getActivationCodeByCode(codeInput);
    if (existing) {
      await ctx.reply("⚠️ رمز التفعيل هذا موجود بالفعل! يرجى اختيار رمز آخر:");
      return;
    }

    await DatabaseManager.setSession(ctx.from.id, "new_code_user_name", {
      code: codeInput,
    });

    const { InlineKeyboard } = require("grammy");
    const kb = new InlineKeyboard()
      .text("⏩ تخطي بدون اسم", "c:skip_user_name")
      .row()
      .text("❌ إلغاء", "c:list:all:1");

    await ctx.reply(
      `✅ الرمز: <code>${codeInput}</code>\n\n` +
        `👤 <b>الخطوة 2 من 4:</b> أرسل الآن <b>اسم المشترك / المندوب</b> (أو اضغط تخطي):`,
      { reply_markup: kb, parse_mode: "HTML" }
    );
    return;
  }

  // 3. اسم المشترك لكود جديد
  if (state === "new_code_user_name") {
    await DatabaseManager.setSession(ctx.from.id, "new_code_phone", {
      ...session.data,
      user_name: text,
    });

    const { InlineKeyboard } = require("grammy");
    const kb = new InlineKeyboard()
      .text("⏩ تخطي الهاتف", "c:skip_phone")
      .row()
      .text("❌ إلغاء", "c:list:all:1");

    await ctx.reply(
      "📞 <b>الخطوة 3 من 4:</b> أرسل <b>رقم هاتف المشترك</b> (أو اضغط تخطي):",
      { reply_markup: kb, parse_mode: "HTML" }
    );
    return;
  }

  // 4. هاتف المشترك لكود جديد
  if (state === "new_code_phone") {
    await DatabaseManager.setSession(ctx.from.id, "new_code_expiry", {
      ...session.data,
      phone_number: text,
    });

    const msg =
      "⏳ <b>الخطوة 4 من 4:</b> اختر <b>مدة صلاحية الرمز</b>:\n\n" +
      "<i>يمكنك تحديد المدة بالساعات أو الأيام أو كتابة مدة مخصصة.</i>";

    await ctx.reply(msg, {
      reply_markup: getDurationSelectionKb(),
      parse_mode: "HTML",
    });
    return;
  }

  // 5. مدة مخصصة لكود جديد
  if (state === "new_code_custom_duration") {
    const { code, user_name, phone_number } = session.data || {};
    await DatabaseManager.clearSession(ctx.from.id);

    const newId = await DatabaseManager.createActivationCode({
      code,
      user_name,
      phone_number,
      duration: text,
      notes: "تم الإنشاء عبر بوت تلجرام الإداري (Netlify)",
    });

    const codeData = await DatabaseManager.getActivationCodeById(newId);
    const msg =
      `🎉 <b>تم إنشاء رمز التفعيل بنجاح!</b>\n\n` + formatCodeCard(codeData);
    const kb = codeActionsKb(newId, true, false, true);

    await ctx.reply(msg, { reply_markup: kb, parse_mode: "HTML" });
    return;
  }

  // 6. مدة مخصصة لتمديد كود
  if (state === "extend_code_custom_duration") {
    const codeId = session.data?.extend_code_id;
    await DatabaseManager.clearSession(ctx.from.id);

    await DatabaseManager.extendCodeExpiry(codeId, text);
    const durLabel = DatabaseManager.formatDurationLabel(text);

    const codeData = await DatabaseManager.getActivationCodeById(codeId);
    const msg =
      `✅ <b>تم تمديد الصلاحية بمقدار ${durLabel} بنجاح!</b>\n\n` +
      formatCodeCard(codeData);
    const hasDevice = Boolean(codeData.device_id);
    const isDeviceLocked =
      codeData.is_device_locked === null || codeData.is_device_locked === undefined
        ? true
        : Boolean(codeData.is_device_locked);

    const kb = codeActionsKb(
      codeId,
      Boolean(codeData.is_active),
      hasDevice,
      isDeviceLocked
    );
    await ctx.reply(msg, { reply_markup: kb, parse_mode: "HTML" });
    return;
  }

  // 7. تعديل اسم المشترك
  if (state === "edit_code_user_name") {
    await DatabaseManager.setSession(ctx.from.id, "edit_code_phone", {
      ...session.data,
      new_user_name: text,
    });

    const { InlineKeyboard } = require("grammy");
    const kb = new InlineKeyboard()
      .text("⏩ الإبقاء على الهاتف الحالي", "c:edit_keep_phone")
      .row()
      .text("❌ إلغاء", "m:home");

    await ctx.reply(
      "📞 أرسل <b>رقم الهاتف الجديد</b> أو اضغط تخطي:",
      { reply_markup: kb, parse_mode: "HTML" }
    );
    return;
  }

  // 8. تعديل هاتف المشترك
  if (state === "edit_code_phone") {
    const codeId = session.data?.edit_code_id;
    const newUserName = session.data?.new_user_name;
    await DatabaseManager.clearSession(ctx.from.id);

    if (codeId) {
      await DatabaseManager.updateCodeInfo(codeId, {
        user_name: newUserName,
        phone_number: text,
      });
      const codeData = await DatabaseManager.getActivationCodeById(codeId);
      const msg =
        "✅ <b>تم تحديث بيانات الكود بنجاح!</b>\n\n" + formatCodeCard(codeData);
      const hasDevice = Boolean(codeData.device_id);
      const isDeviceLocked =
        codeData.is_device_locked === null || codeData.is_device_locked === undefined
          ? true
          : Boolean(codeData.is_device_locked);

      const kb = codeActionsKb(
        codeId,
        Boolean(codeData.is_active),
        hasDevice,
        isDeviceLocked
      );
      await ctx.reply(msg, { reply_markup: kb, parse_mode: "HTML" });
    }
    return;
  }

  // 9. محطة استعلامات SQL
  if (state === "waiting_for_sql") {
    await DatabaseManager.clearSession(ctx.from.id);

    try {
      const { columns, rows, count, duration } =
        await DatabaseManager.executeCustomQuery(text);

      const { InlineKeyboard } = require("grammy");
      const kb = new InlineKeyboard()
        .text("⚡ تنفيذ استعلام آخر", "sql:start")
        .row()
        .text("🔙 القائمة الرئيسية", "m:home");

      if (columns && columns.length > 0) {
        const { renderTableGrid } = require("./tablesFormatter");
        const displayCols = columns.slice(0, 4);
        const shortRows = rows.slice(0, 10).map((r) =>
          r.slice(0, 4).map((v) => (v === null ? "-" : String(v).slice(0, 12)))
        );
        const shortHeaders = displayCols.map((c) => c.slice(0, 10));
        const tableStr = renderTableGrid(shortHeaders, shortRows);

        const extra =
          count > 10 ? `\n<i>... وتم عرض 10 صفوف من أصل ${count}</i>` : "";
        const resMsg =
          `✅ <b>تم تنفيذ الاستعلام بنجاح في ${duration}:</b>\n` +
          `📊 عدد الصفوف: <b>${count}</b>\n\n` +
          `<pre>${tableStr}</pre>${extra}`;

        await ctx.reply(resMsg, { reply_markup: kb, parse_mode: "HTML" });
      } else {
        const resMsg =
          `✅ <b>تم تنفيذ الأمر بنجاح في ${duration}:</b>\n` +
          `📌 عدد الصفوف المتأثرة: <b>${count}</b>`;
        await ctx.reply(resMsg, { reply_markup: kb, parse_mode: "HTML" });
      }
    } catch (e) {
      const { InlineKeyboard } = require("grammy");
      const kb = new InlineKeyboard()
        .text("⚡ المحاولة مرة أخرى", "sql:start")
        .row()
        .text("🔙 القائمة الرئيسية", "m:home");

      await ctx.reply(
        `❌ <b>خطأ في استعلام SQL:</b>\n<code>${e.message}</code>`,
        { reply_markup: kb, parse_mode: "HTML" }
      );
    }
    return;
  }
});

module.exports = bot;
