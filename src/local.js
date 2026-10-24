/**
 * ملف التشغيل المحلي للبوت عبر ميزة Long Polling
 * يُستخدم للتطوير والتجربة المحلية على جهازك (مطابق تماماً لـ bot.py)
 * للتشغيل: node src/local.js أو npm start
 */
const bot = require("./bot");
const DatabaseManager = require("./database");

async function main() {
  console.log("=======================================================");
  console.log("  جاري بدء تشغيل بوت تلجرام الإداري (وضع Long Polling المحلي)...");
  console.log("=======================================================");

  // فحص الاتصال بقاعدة بيانات Neon PostgreSQL
  try {
    const tables = await DatabaseManager.getAllTables();
    console.log("✅ تم الاتصال بقاعدة البيانات بنجاح!");
    console.log("  الجداول المتوفرة:", tables.map(t => `${t.table_name} (${t.row_count})`).join(", "));
  } catch (err) {
    console.error("❌ فشل الاتصال بقاعدة البيانات:", err.message);
    process.exit(1);
  }

  // حذف الـ Webhook القديم قبل بدء الـ Polling
  await bot.api.deleteWebhook({ drop_pending_updates: true });

  const me = await bot.api.getMe();
  console.log(`\n🚀 البوت يعمل الآن بنجاح: @${me.username} (${me.first_name})`);
  console.log("👉 افتح تلجرام وأرسل /start لبدء الإدارة بالأزرار التفاعلية!\n");

  // بدء الاستماع للتحديثات
  bot.start({
    allowed_updates: ["message", "callback_query"],
    onStart: (botInfo) => {
      console.log(`[Polling Started] Listening for messages for @${botInfo.username}...`);
    }
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
});
