/**
 * أداة سريعة لربط رابط موقع Netlify بـ Webhook تلجرام
 * الاستخدام:
 *   node src/setWebhook.js https://YOUR_SITE.netlify.app/.netlify/functions/bot
 * أو عبر:
 *   npm run set-webhook https://YOUR_SITE.netlify.app/.netlify/functions/bot
 */
const { Bot } = require("grammy");
const { BOT_TOKEN } = require("./config");

async function run() {
  const webhookUrl = process.argv[2] || process.env.WEBHOOK_URL;
  if (!webhookUrl) {
    console.error("❌ خطأ: يرجى تمرير رابط الـ Webhook التابع لـ Netlify:");
    console.error("مثال:");
    console.error("  node src/setWebhook.js https://YOUR_NAME.netlify.app/.netlify/functions/bot");
    process.exit(1);
  }

  console.log(`📡 جاري ربط البوت بالرابط: ${webhookUrl}`);
  const bot = new Bot(BOT_TOKEN);

  try {
    await bot.api.setWebhook(webhookUrl, {
      drop_pending_updates: true,
      allowed_updates: ["message", "callback_query"],
    });
    console.log("✅ تم ضبط الـ Webhook بنجاح تام على تلجرام!");
    
    const info = await bot.api.getWebhookInfo();
    console.log("معلومات الـ Webhook الحالية:");
    console.log("  URL:", info.url);
    console.log("  Custom Certificate:", info.has_custom_certificate);
    console.log("  Pending Update Count:", info.pending_update_count);
  } catch (err) {
    console.error("❌ فشل ضبط الـ Webhook:", err.message);
  }
}

run();
