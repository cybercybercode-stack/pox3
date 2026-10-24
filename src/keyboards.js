/**
 * لوحات الأزرار التفاعلية (Inline Keyboards) للبوت
 * نسخة Node.js طبق الأصل من keyboards.py
 */
const { InlineKeyboard } = require("grammy");

// ==========================================
// القائمة الرئيسية
// ==========================================
function mainMenuKb() {
  return new InlineKeyboard()
    .text("📊 لوحة الإحصائيات", "m:stats")
    .text("🔑 رموز التفعيل", "c:list:all:1")
    .row()
    .text("📦 سجل الطلبات", "o:list:all:1")
    .text("🗄️ استعراض الجداول", "t:list")
    .row()
    .text("⚡ محطة استعلامات SQL", "sql:start")
    .text("📥 تصدير البيانات (Excel)", "exp:menu")
    .row()
    .text("🔄 تحديث البيانات", "m:refresh");
}

// ==========================================
// أزرار قائمة رموز التفعيل (Codes List)
// ==========================================
function codesListKb(codes, filterType, page, totalPages) {
  const kb = new InlineKeyboard();

  // سطر فلاتر سريعة
  const fBtn = (title, ftype) => {
    const isSelected = filterType === ftype;
    return isSelected ? `• ${title} •` : title;
  };

  kb.text(fBtn("الكل 📋", "all"), "c:list:all:1")
    .text(fBtn("نشطة 🟢", "active"), "c:list:active:1")
    .text(fBtn("معطلة 🔴", "inactive"), "c:list:inactive:1")
    .text(fBtn("منتهية ⏳", "expired"), "c:list:expired:1")
    .row();

  // أزرار الأكواد
  for (const c of codes) {
    const cid = c.id;
    const codeStr = c.code;
    const user = (c.user_name || "بدون اسم").slice(0, 12);
    const icon = c.is_active ? "🟢" : "🔴";
    const btnText = `${icon} ${codeStr} (${user})`;
    kb.text(btnText, `c:view:${cid}`).row();
  }

  // سطر التصفح (Pagination)
  if (page > 1) {
    kb.text("◀️ السابق", `c:list:${filterType}:${page - 1}`);
  }
  kb.text(`📄 ${page}/${Math.max(1, totalPages)}`, "noop");
  if (page < totalPages) {
    kb.text("التالي ▶️", `c:list:${filterType}:${page + 1}`);
  }
  kb.row();

  // أزرار العمليات والبحث
  kb.text("➕ إضافة كود جديد", "c:add")
    .text("🔍 بحث بالاسم/الكود", "c:search")
    .row()
    .text("🔙 القائمة الرئيسية", "m:home");

  return kb;
}

// ==========================================
// أزرار التحكم في كود تفعيل واحد
// ==========================================
function codeActionsKb(codeId, isActive, hasDevice, isDeviceLocked = true) {
  const toggleText = isActive ? "🔴 تعطيل الكود" : "🟢 تفعيل الكود";
  const lockBtnText = isDeviceLocked ? "🔒 تقييد الجهاز: مفعل" : "🌐 تقييد الجهاز: معطل";

  const kb = new InlineKeyboard()
    .text(toggleText, `c:toggle:${codeId}`)
    .text("⏳ تمديد الصلاحية", `c:extend:${codeId}`)
    .row()
    .text(lockBtnText, `c:toggle_dev:${codeId}`)
    .text("✏️ تعديل البيانات", `c:edit:${codeId}`)
    .row();

  if (hasDevice) {
    kb.text("🔓 فك ربط الهاتف المسجل", `c:reset_dev:${codeId}`).row();
  }

  kb.text("🗑️ حذف الكود نهائياً", `c:del_ask:${codeId}`)
    .row()
    .text("🔙 رجوع لقائمة الأكواد", "c:list:all:1")
    .text("🏠 الرئيسية", "m:home");

  return kb;
}

// ==========================================
// أزرار خيارات تمديد الصلاحية (بالساعات والأيام)
// ==========================================
function codeExtendKb(codeId) {
  return new InlineKeyboard()
    .text("+ 1 ساعة ⏱️", `c:ext_do:${codeId}:1h`)
    .text("+ 6 ساعات ⏱️", `c:ext_do:${codeId}:6h`)
    .text("+ 12 ساعة ⏱️", `c:ext_do:${codeId}:12h`)
    .row()
    .text("+ يوم واحد (24 س) 🗓️", `c:ext_do:${codeId}:1d`)
    .text("+ 3 أيام 📅", `c:ext_do:${codeId}:3d`)
    .text("+ 7 أيام 📅", `c:ext_do:${codeId}:7d`)
    .row()
    .text("+ شهر (30 يوم) 🗓️", `c:ext_do:${codeId}:30d`)
    .text("+ 3 أشهر (90 يوم) 🚀", `c:ext_do:${codeId}:90d`)
    .text("+ سنة (365 يوم) ⭐", `c:ext_do:${codeId}:365d`)
    .row()
    .text("♾️ صلاحية دائمة", `c:ext_do:${codeId}:lifetime`)
    .text("✍️ تمديد مخصص", `c:ext_custom:${codeId}`)
    .row()
    .text("🔙 رجوع لبطاقة الكود", `c:view:${codeId}`);
}

// ==========================================
// أزرار تأكيد حذف الكود
// ==========================================
function codeDeleteConfirmKb(codeId) {
  return new InlineKeyboard()
    .text("⚠️ نعم، احذف الكود الآن", `c:del_confirm:${codeId}`)
    .text("❌ تراجع وإلغاء", `c:view:${codeId}`);
}

// ==========================================
// أزرار قائمة الطلبات (Orders List)
// ==========================================
function ordersListKb(orders, filterType, page, totalPages) {
  const kb = new InlineKeyboard();

  const ofBtn = (title, fval) => {
    return filterType === fval ? `• ${title} •` : title;
  };

  kb.text(ofBtn("الكل 📋", "all"), "o:list:all:1")
    .text(ofBtn("مقبولة ✅", "accepted"), "o:list:accepted:1")
    .text(ofBtn("مرفوضة ⛔", "rejected"), "o:list:rejected:1")
    .row();

  for (const o of orders) {
    const oid = o.id;
    const act = String(o.action_taken || "").toUpperCase();
    const icon = act.includes("ACCEPT") ? "✅" : act.includes("REJECT") ? "⛔" : "📦";
    const title = (o.order_title || "طلب").slice(0, 14);
    const code = o.activation_code || "-";
    const btnText = `${icon} #${oid} | ${code} - ${title}`;
    kb.text(btnText, `o:view:${oid}`).row();
  }

  if (page > 1) {
    kb.text("◀️ السابق", `o:list:${filterType}:${page - 1}`);
  }
  kb.text(`📄 ${page}/${Math.max(1, totalPages)}`, "noop");
  if (page < totalPages) {
    kb.text("التالي ▶️", `o:list:${filterType}:${page + 1}`);
  }
  kb.row();

  kb.text("📥 تصدير سجل الطلبات (Excel)", "t:export:orders")
    .text("🔙 القائمة الرئيسية", "m:home");

  return kb;
}

// ==========================================
// أزرار تفاصيل الطلب
// ==========================================
function orderActionsKb(orderId) {
  return new InlineKeyboard()
    .text("🗑️ حذف هذا الطلب", `o:del:${orderId}`)
    .text("🔙 رجوع للطلبات", "o:list:all:1")
    .row()
    .text("🏠 الرئيسية", "m:home");
}

// ==========================================
// أزرار استعراض الجداول (Tables List)
// ==========================================
function tablesListKb(tables) {
  const kb = new InlineKeyboard();
  for (const t of tables) {
    const tname = t.table_name;
    const cnt = t.row_count || 0;
    const icon = tname === "activation_codes" ? "🔑" : tname === "orders" ? "📦" : "🗄️";
    const btnText = `${icon} ${tname} (${cnt} صف)`;
    kb.text(btnText, `t:view:${tname}:1`).row();
  }
  kb.text("🔙 القائمة الرئيسية", "m:home");
  return kb;
}

// ==========================================
// أزرار عرض بيانات جدول ديناميكي
// ==========================================
function genericTableKb(tableName, page, totalPages) {
  const kb = new InlineKeyboard();

  if (page > 1) {
    kb.text("◀️ السابق", `t:view:${tableName}:${page - 1}`);
  }
  kb.text(`📄 ${page}/${Math.max(1, totalPages)}`, "noop");
  if (page < totalPages) {
    kb.text("التالي ▶️", `t:view:${tableName}:${page + 1}`);
  }
  kb.row();

  kb.text("📐 بنية الأعمدة (Schema)", `t:schema:${tableName}`)
    .text("📥 تحميل كـ Excel", `t:export:${tableName}`)
    .row()
    .text("🔙 قائمة الجداول", "t:list")
    .text("🏠 الرئيسية", "m:home");

  return kb;
}

// ==========================================
// أزرار قائمة التصدير السريع
// ==========================================
function exportMenuKb(tables) {
  const kb = new InlineKeyboard();
  for (const t of tables) {
    const tname = t.table_name;
    kb.text(`📥 تصدير ${tname} إلى Excel`, `t:export:${tname}`).row();
  }
  kb.text("🔙 القائمة الرئيسية", "m:home");
  return kb;
}

// ==========================================
// زر إلغاء والعودة
// ==========================================
function cancelKb(targetCb = "m:home") {
  return new InlineKeyboard().text("❌ إلغاء والعودة", targetCb);
}

module.exports = {
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
  cancelKb
};
