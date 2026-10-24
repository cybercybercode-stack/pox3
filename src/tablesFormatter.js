/**
 * تنسيق الجداول والبطاقات التفاعلية لتلجرام بأحدث التقنيات
 * نسخة Node.js طبق الأصل من tables_formatter.py
 */

/**
 * تنسيق الوقت والتاريخ بشكل مقروء وأنيق (YYYY-MM-DD HH:mm)
 */
function formatTimestamp(ts) {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts).slice(0, 16);
    const pad = (n) => String(n).padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch {
    return String(ts).slice(0, 16);
  }
}

/**
 * تحديد شارة وحالة كود التفعيل مع دعم الساعات والأيام بدقة
 */
function getStatusBadge(isActive, expiresAt) {
  const now = new Date();
  if (!isActive) {
    return { badge: "🔴 معطل", status: "INACTIVE" };
  }
  if (expiresAt) {
    const exp = new Date(expiresAt);
    if (exp <= now) {
      return { badge: "⏳ منتهي", status: "EXPIRED" };
    }

    const diffMs = exp.getTime() - now.getTime();
    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (days > 1) {
      return { badge: `🟢 نشط (${days} يوم)`, status: "ACTIVE" };
    } else if (days === 1) {
      const remH = hours - 24;
      return {
        badge: remH > 0 ? `🟢 نشط (يوم و ${remH} س)` : "🟢 نشط (يوم واحد)",
        status: "ACTIVE",
      };
    } else if (hours > 0) {
      return { badge: `🟢 نشط (${hours} س و ${minutes} د)`, status: "ACTIVE" };
    } else {
      return { badge: `🟢 نشط (${Math.max(1, minutes)} دقيقة)`, status: "ACTIVE" };
    }
  }
  return { badge: "🟢 نشط (دائم)", status: "LIFETIME" };
}

/**
 * دالة لتنسيق الجداول بنمط rounded_grid في تلجرام <pre>
 */
function renderTableGrid(headers, rows) {
  if (!headers || headers.length === 0) return "";
  
  // حساب عرض كل عمود
  const colWidths = headers.map((h, i) => {
    let max = String(h).length;
    for (const r of rows) {
      const cell = String(r[i] ?? "");
      if (cell.length > max) max = cell.length;
    }
    return max + 2; // هامش جانبي
  });

  const padCenter = (str, len) => {
    const s = String(str ?? "");
    const diff = len - s.length;
    if (diff <= 0) return s;
    const left = Math.floor(diff / 2);
    const right = diff - left;
    return " ".repeat(left) + s + " ".repeat(right);
  };

  const top = "╭" + colWidths.map((w) => "─".repeat(w)).join("┬") + "╮";
  const mid = "├" + colWidths.map((w) => "─".repeat(w)).join("┼") + "┤";
  const bot = "╰" + colWidths.map((w) => "─".repeat(w)).join("┴") + "╯";

  const headerRow = "│" + headers.map((h, i) => padCenter(h, colWidths[i])).join("│") + "│";
  const dataRows = rows.map((r) => {
    return "│" + r.map((c, i) => padCenter(c, colWidths[i])).join("│") + "│";
  });

  return [top, headerRow, mid, ...dataRows, bot].join("\n");
}

/**
 * بطاقة عرض كود التفعيل (Activation Code Card)
 */
function formatCodeCard(codeData) {
  const codeId = codeData.id;
  const code = codeData.code || "—";
  const userName = codeData.user_name || "غير محدد";
  const phone = codeData.phone_number || "غير مسجل";
  const isActive = Boolean(codeData.is_active);
  const expiresAt = codeData.expires_at;
  const lastSeen = formatTimestamp(codeData.last_seen_at);
  const createdAt = formatTimestamp(codeData.created_at);
  const notes = codeData.notes || "لا توجد ملاحظات";
  const deviceId = codeData.device_id;
  const deviceInfo = codeData.device_info;

  const { badge } = getStatusBadge(isActive, expiresAt);
  const expStr = expiresAt ? formatTimestamp(expiresAt) : "دائم (بدون انتهاء) ♾️";

  let isDeviceLocked = codeData.is_device_locked;
  if (isDeviceLocked === null || isDeviceLocked === undefined) {
    isDeviceLocked = true;
  } else {
    isDeviceLocked = Boolean(isDeviceLocked);
  }

  let deviceStatus;
  if (!isDeviceLocked) {
    deviceStatus = "🌐 غير مقيد (مفتوح لأي جهاز بدون قفل)";
  } else if (deviceId) {
    const info = deviceInfo ? ` (${deviceInfo})` : "";
    deviceStatus = `🔒 مقيد بهاتف: <code>${deviceId.slice(0, 12)}...</code>${info}`;
  } else {
    deviceStatus = "🔒 مقيد بجهاز واحد (بانتظار تسجيل أول هاتف)";
  }

  return (
    `🔑 <b>بطاقة رمز التفعيل #${codeId}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🏷️ <b>الرمز:</b> <code>${code}</code>\n` +
    `👤 <b>الاسم:</b> ${userName}\n` +
    `📞 <b>الهاتف:</b> <code>${phone}</code>\n` +
    `🔘 <b>الحالة:</b> ${badge}\n` +
    `⏳ <b>الصلاحية:</b> ${expStr}\n` +
    `📱 <b>الجهاز:</b> ${deviceStatus}\n` +
    `🕒 <b>آخر ظهور:</b> ${lastSeen}\n` +
    `📅 <b>تاريخ الإنشاء:</b> ${createdAt}\n` +
    `📝 <b>ملاحظات:</b> <i>${notes}</i>\n` +
    `━━━━━━━━━━━━━━━━━━━━`
  );
}

/**
 * جدول قائمة الأكواد السريعة (Table Grid for Codes)
 */
function formatCodesTableGrid(rows, page, totalPages, totalCount) {
  if (!rows || rows.length === 0) {
    return "📭 <i>لا توجد أكواد تفعيل تطابق هذا الفلتر حالياً.</i>";
  }

  const tableData = rows.map((r) => {
    const cid = String(r.id);
    const code = String(r.code || "").slice(0, 12);
    const user = String(r.user_name || "-").slice(0, 10);
    const { badge } = getStatusBadge(r.is_active, r.expires_at);
    const shortStatus = badge.includes("🟢")
      ? "نشط"
      : badge.includes("🔴")
      ? "معطل"
      : "منتهي";
    return [cid, code, user, shortStatus];
  });

  const headers = ["#", "الكود", "الاسم", "الحالة"];
  const tableStr = renderTableGrid(headers, tableData);

  return (
    `📋 <b>جدول رموز التفعيل</b> (صفحة ${page} من ${totalPages})\n` +
    `📊 إجمالي النتائج: <b>${totalCount}</b> كود\n\n` +
    `<pre>${tableStr}</pre>\n` +
    `💡 <i>اضغط على أي كود من الأزرار بالأسفل للتفاصيل والتحكم الكامل:</i>`
  );
}

/**
 * بطاقة تفاصيل الطلب (Order Card)
 */
function formatOrderCard(orderData) {
  const oid = orderData.id;
  const code = orderData.activation_code || "—";
  const userName = orderData.user_name || "مندوب غير مسمى";
  const title = orderData.order_title || "طلب بدون عنوان";
  const restKm = orderData.restaurant_distance_km;
  const custKm = orderData.customer_distance_km;
  const totKm = orderData.total_distance_km;
  const fee = orderData.delivery_fee;
  const price = orderData.order_price || "—";
  const payment = orderData.payment_method || "—";
  const action = String(orderData.action_taken || "").toUpperCase();
  const reason = orderData.action_reason || "بدون سبب مدون";
  const created = formatTimestamp(orderData.created_at);
  const rawDetails = orderData.raw_details;

  const actionIcon = action.includes("ACCEPT")
    ? "✅ تم القبول"
    : action.includes("REJECT")
    ? "⛔ تم الرفض"
    : `ℹ️ ${action}`;

  let card = (
    `📦 <b>تفاصيل الطلب #${oid}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🏷️ <b>العنوان:</b> ${title}\n` +
    `🔑 <b>كود المندوب:</b> <code>${code}</code> (${userName})\n` +
    `⚡ <b>الإجراء:</b> <b>${actionIcon}</b>\n` +
    `💬 <b>سبب القرار:</b> <i>${reason}</i>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🚗 <b>مسافة المطعم:</b> ${restKm || 0} كم\n` +
    `📍 <b>مسافة العميل:</b> ${custKm || 0} كم\n` +
    `📏 <b>المسافة الكلية:</b> <b>${totKm || 0} كم</b>\n` +
    `💵 <b>أجرة التوصيل:</b> <b>${fee || 0} ريال</b>\n` +
    `💰 <b>سعر الطلب:</b> ${price}\n` +
    `💳 <b>طريقة الدفع:</b> ${payment}\n` +
    `🕒 <b>توقيت التسجيل:</b> ${created}\n`
  );

  if (rawDetails) {
    const cleanRaw = rawDetails.slice(0, 300) + (rawDetails.length > 300 ? "..." : "");
    card += `\n📄 <b>تفاصيل إضافية:</b>\n<code>${cleanRaw}</code>\n`;
  }

  card += "━━━━━━━━━━━━━━━━━━━━";
  return card;
}

/**
 * جدول قائمة الطلبات (Orders Table Grid)
 */
function formatOrdersTableGrid(rows, page, totalPages, totalCount) {
  if (!rows || rows.length === 0) {
    return "📭 <i>لا توجد طلبات مسجلة في هذا القسم حالياً.</i>";
  }

  const tableData = rows.map((r) => {
    const oid = String(r.id);
    const action = String(r.action_taken || "").toUpperCase();
    const shortAction = action.includes("ACCEPT")
      ? "قبول"
      : action.includes("REJECT")
      ? "رفض"
      : action.slice(0, 5);
    const dist = `${r.total_distance_km || 0}k`;
    const fee = `${r.delivery_fee || 0}`;
    return [oid, shortAction, dist, fee];
  });

  const headers = ["#", "الإجراء", "المسافة", "الأجرة"];
  const tableStr = renderTableGrid(headers, tableData);

  return (
    `📦 <b>سجل طلبات التوصيل</b> (صفحة ${page} من ${totalPages})\n` +
    `📊 إجمالي الطلبات: <b>${totalCount}</b>\n\n` +
    `<pre>${tableStr}</pre>\n` +
    `💡 <i>اختر رقماً من الأزرار بالأسفل لعرض تفاصيل الطلب بالكامل:</i>`
  );
}

/**
 * لوحة التحكم والإحصائيات (Dashboard Stats View)
 */
function formatDashboardStats(stats) {
  const totalCodes = stats.total_codes || 0;
  const activeCodes = stats.active_codes || 0;
  const inactiveCodes = stats.inactive_codes || 0;
  const expiredCodes = stats.expired_codes || 0;
  const onlineToday = stats.online_today || 0;

  const totalOrders = stats.total_orders || 0;
  const todayOrders = stats.today_orders || 0;
  const accepted = stats.accepted_orders || 0;
  const rejected = stats.rejected_orders || 0;
  const totalFee = Number(stats.total_delivery_fee || 0);

  const acceptRate = totalOrders > 0
    ? `${((accepted / totalOrders) * 100).toFixed(1)}%`
    : "0%";

  return (
    `📊 <b>لوحة القيادة والإحصائيات الحية (Neon DB)</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🔑 <b>رموز التفعيل والمشتركين:</b>\n` +
    `  • الإجمالي: <b>${totalCodes}</b> كود\n` +
    `  • 🟢 النشطة والصالحة: <b>${activeCodes}</b>\n` +
    `  • 🔴 المعطلة يدوياً: <b>${inactiveCodes}</b>\n` +
    `  • ⏳ المنتهية الصلاحية: <b>${expiredCodes}</b>\n` +
    `  • 📱 النشطون اليوم: <b>${onlineToday}</b> مشترك\n\n` +
    `📦 <b>طلبات المناديب وعمليات التوصيل:</b>\n` +
    `  • إجمالي الطلبات: <b>${totalOrders}</b> طلب\n` +
    `  • 🕒 طلبات اليوم: <b>${todayOrders}</b> طلب\n` +
    `  • ✅ المقبولة: <b>${accepted}</b> (${acceptRate})\n` +
    `  • ⛔ المرفوضة: <b>${rejected}</b>\n` +
    `  • 💰 إجمالي الأجور المحسوبة: <b>${totalFee.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `⚡ <i>قاعدة البيانات متصلة وجاهزة للعمل بأعلى كفاءة.</i>`
  );
}

/**
 * استعراض أي جدول مخصص (Generic Table Viewer)
 */
function formatGenericTable(tableName, columns, rows, page, totalRows, pageSize = 5) {
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  if (!rows || rows.length === 0) {
    return `🗄️ جدول <b>${tableName}</b> فارغ حالياً.`;
  }

  const displayCols = columns.slice(0, 4);
  const gridRows = rows.map((r) => {
    return displayCols.map((c) => {
      const val = r[c];
      if (val instanceof Date) {
        return val.toISOString().slice(0, 10);
      } else if (typeof val === "boolean") {
        return val ? "✓" : "✗";
      } else if (val === null || val === undefined) {
        return "-";
      } else {
        return String(val).slice(0, 10);
      }
    });
  });

  const shortHeaders = displayCols.map((c) => c.slice(0, 8));
  const tableStr = renderTableGrid(shortHeaders, gridRows);

  return (
    `🗄️ <b>استعراض الجدول:</b> <code>${tableName}</code>\n` +
    `📄 الصفحة: <b>${page} / ${totalPages}</b> | الإجمالي: <b>${totalRows}</b> صف\n\n` +
    `<pre>${tableStr}</pre>\n` +
    `📌 <i>يعرض الجدول أهم الأعمدة الرئيسية (${displayCols.join(", ")}). لتصدير كافة الأعمدة والبيانات اضغط زر تصدير Excel بالأسفل.</i>`
  );
}

/**
 * عرض بنية الجدول والأعمدة (Schema View)
 */
function formatSchemaView(tableName, schemaCols) {
  const tableData = schemaCols.map((col) => {
    const cname = (col.column_name || "").slice(0, 15);
    const dtype = (col.data_type || "").slice(0, 15);
    const nullable = col.is_nullable === "YES" ? "نعم" : "لا";
    return [cname, dtype, nullable];
  });

  const headers = ["العمود", "النوع", "فارغ?"];
  const tableStr = renderTableGrid(headers, tableData);

  return (
    `📐 <b>هيكل جدول:</b> <code>${tableName}</code>\n` +
    `🔢 إجمالي الأعمدة: <b>${schemaCols.length}</b>\n\n` +
    `<pre>${tableStr}</pre>`
  );
}

module.exports = {
  formatTimestamp,
  getStatusBadge,
  renderTableGrid,
  formatCodeCard,
  formatCodesTableGrid,
  formatOrderCard,
  formatOrdersTableGrid,
  formatDashboardStats,
  formatGenericTable,
  formatSchemaView
};
