/**
 * إعدادات بوت تلجرام لإدارة قاعدة بيانات PostgreSQL (Neon DB)
 * متوافق بنسبة 100% مع بيئة التشغيل السحابية Netlify Functions و Node.js
 */
const path = require("path");
require("dotenv").config();

// توكن البوت وقاعدة البيانات
const BOT_TOKEN = process.env.BOT_TOKEN || "";
const DATABASE_URL = process.env.DATABASE_URL || 
  "";

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
