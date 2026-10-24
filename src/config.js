/**
 * إعدادات بوت تلجرام لإدارة قاعدة بيانات PostgreSQL (Neon DB)
 * متوافق بنسبة 100% مع بيئة التشغيل السحابية Netlify Functions و Node.js
 */
const path = require("path");
require("dotenv").config();

// توكن البوت وقاعدة البيانات
const BOT_TOKEN = process.env.BOT_TOKEN || "6230762566:AAENoNrNkvu1yHJhbsIyvfJHHD3sdUAfbk8";
const DATABASE_URL = process.env.DATABASE_URL || 
  "postgresql://neondb_owner:npg_jYFkGRe4ru5m@ep-orange-waterfall-b5doez4m-pooler.c-7.us-east-2.aws.neon.tech/layal?sslmode=require&channel_binding=require";

// كلمة سر المشرفين البديلة لتسجيل الدخول السريع
const ADMIN_SECRET_PIN = process.env.ADMIN_PIN || "lokerpox2026";

// حجم الصفحة لعرض الجداول والأكواد
const PAGE_SIZE = 5;

// المشرفون الافتراضيون من المتغيرات البيئية أو الإعداد الأولي
const DEFAULT_ADMIN_IDS = (process.env.ADMIN_CHAT_IDS || "8386457782")
  .split(",")
  .map(id => id.trim())
  .filter(Boolean)
  .map(Number);

module.exports = {
  BOT_TOKEN,
  DATABASE_URL,
  ADMIN_SECRET_PIN,
  PAGE_SIZE,
  DEFAULT_ADMIN_IDS
};
