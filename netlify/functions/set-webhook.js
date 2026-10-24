/**
 * وظيفة سحابية لتسجيل وضبط الـ Webhook بنقرة واحدة من المتصفح أو عبر API
 * المسار: /.netlify/functions/set-webhook أو /api/set-webhook
 */
const { Bot } = require("grammy");
const { BOT_TOKEN } = require("../../src/config");

exports.handler = async (event, context) => {
  const host = event.headers["x-forwarded-host"] || event.headers.host;
  const proto = event.headers["x-forwarded-proto"] || "https";

  // استخراج رابط الـ Webhook تلقائياً من النطاق الحالي
  const defaultWebhook = `${proto}://${host}/.netlify/functions/bot`;
  const targetUrl = event.queryStringParameters?.url || defaultWebhook;

  const bot = new Bot(BOT_TOKEN);

  try {
    await bot.api.setWebhook(targetUrl, {
      drop_pending_updates: true,
      allowed_updates: ["message", "callback_query"],
    });

    const info = await bot.api.getWebhookInfo();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        success: true,
        message: "✅ تم ربط الـ Webhook مع تلجرام بنجاح تام!",
        configured_url: targetUrl,
        webhook_info: info,
      }, null, 2)
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        success: false,
        error: err.message,
      }, null, 2)
    };
  }
};
