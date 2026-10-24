/**
 * معالج الـ Webhook السحابي لـ Netlify Functions
 * يستقبل تحديثات تلجرام الفورية (POST) ويعالجها في بيئة Serverless
 * المسار: /.netlify/functions/bot أو /api/bot
 */
const bot = require("../../src/bot");

exports.handler = async (event, context) => {
  // منع تعليق الدالة بسبب اتصالات قاعدة البيانات الخاملة في بيئة Serverless
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

  // عند زيارة الرابط من المتصفح (GET) للتأكد من سلامة التشغيل
  if (event.httpMethod === "GET") {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        status: "online",
        service: "Layal Telegram Admin Bot (Neon PostgreSQL)",
        environment: "Netlify Serverless Functions",
        timestamp: new Date().toISOString(),
        message: "🚀 Webhook endpoint is active and waiting for Telegram updates."
      })
    };
  }

  // استقبال رسائل وأوامر وتفاعلات تلجرام (POST)
  if (event.httpMethod === "POST") {
    try {
      if (!event.body) {
        return { statusCode: 400, body: "Bad Request: Empty Body" };
      }

      // التأكد من تهيئة البوت
      if (!bot.isInited()) {
        await bot.init();
      }

      const update = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
      
      // معالجة التحديث عبر جرامي (grammY)
      await bot.handleUpdate(update);

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true })
      };
    } catch (err) {
      console.error("Error processing Telegram update:", err);
      // إرجاع 200 لتلجرام لمنع تكرار الإرسال في حال حدوث خطأ برمجي فرعي
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: err.message })
      };
    }
  }

  return {
    statusCode: 405,
    body: "Method Not Allowed"
  };
};
