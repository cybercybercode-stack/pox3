/**
 * طبقة الاتصال والتعامل مع قاعدة بيانات Neon PostgreSQL
 * متوافقة مع بيئة Serverless على Netlify واستخدام pg Pool
 * نسخة Node.js طبق الأصل من database.py
 */
const { Pool } = require("pg");
const ExcelJS = require("exceljs");
const { DATABASE_URL, DEFAULT_ADMIN_IDS } = require("./config");

class DatabaseManager {
  static pool = null;
  static isInitialized = false;

  static getPool() {
    if (!this.pool) {
      this.pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 5, // مناسب لـ Netlify Functions
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      this.pool.on("error", (err) => {
        console.error("Unexpected database pool error:", err);
      });
    }
    return this.pool;
  }

  /**
   * تهيئة الجداول المساعدة للبوت (المشرفين والجلسات للحفاظ على الحالة في Serverless)
   */
  static async initHelperTables() {
    if (this.isInitialized) return;
    try {
      const client = await this.getPool().connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS bot_admins (
            chat_id BIGINT PRIMARY KEY,
            added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS bot_sessions (
            chat_id BIGINT PRIMARY KEY,
            state VARCHAR(64),
            data JSONB DEFAULT '{}'::jsonb,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // إدخال المشرفين الافتراضيين
        for (const adminId of DEFAULT_ADMIN_IDS) {
          await client.query(
            `INSERT INTO bot_admins (chat_id) VALUES ($1) ON CONFLICT (chat_id) DO NOTHING;`,
            [adminId]
          );
        }
        this.isInitialized = true;
      } finally {
        client.release();
      }
    } catch (err) {
      console.warn("Notice: could not init helper tables yet:", err.message);
    }
  }

  static async query(text, params = []) {
    const client = await this.getPool().connect();
    try {
      return await client.query(text, params);
    } finally {
      client.release();
    }
  }

  static async fetchOne(text, params = []) {
    const res = await this.query(text, params);
    return res.rows[0] || null;
  }

  static async fetchAll(text, params = []) {
    const res = await this.query(text, params);
    return res.rows;
  }

  static async execute(text, params = []) {
    const res = await this.query(text, params);
    return res.rowCount;
  }

  // ==========================================
  // إدارة المشرفين والجلسات (Serverless FSM Sessions)
  // ==========================================
  static async loadAdmins() {
    await this.initHelperTables();
    try {
      const rows = await this.fetchAll("SELECT chat_id FROM bot_admins;");
      const dbAdmins = rows.map((r) => Number(r.chat_id));
      return new Set([...DEFAULT_ADMIN_IDS, ...dbAdmins]);
    } catch {
      return new Set(DEFAULT_ADMIN_IDS);
    }
  }

  static async saveAdmin(chatId) {
    await this.initHelperTables();
    try {
      await this.query(
        "INSERT INTO bot_admins (chat_id) VALUES ($1) ON CONFLICT (chat_id) DO NOTHING;",
        [chatId]
      );
    } catch (err) {
      console.error("Error saving admin:", err);
    }
  }

  static async isAdmin(chatId) {
    const admins = await this.loadAdmins();
    if (admins.size === 0) {
      await this.saveAdmin(chatId);
      return true;
    }
    return admins.has(Number(chatId));
  }

  static async getSession(chatId) {
    await this.initHelperTables();
    try {
      const row = await this.fetchOne(
        "SELECT state, data FROM bot_sessions WHERE chat_id = $1;",
        [chatId]
      );
      if (!row) return { state: null, data: {} };
      return { state: row.state, data: row.data || {} };
    } catch {
      return { state: null, data: {} };
    }
  }

  static async setSession(chatId, state, data = {}) {
    await this.initHelperTables();
    try {
      await this.query(
        `INSERT INTO bot_sessions (chat_id, state, data, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (chat_id)
         DO UPDATE SET state = EXCLUDED.state, data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP;`,
        [chatId, state, JSON.stringify(data)]
      );
    } catch (err) {
      console.error("Error setting session:", err);
    }
  }

  static async clearSession(chatId) {
    await this.initHelperTables();
    try {
      await this.query("DELETE FROM bot_sessions WHERE chat_id = $1;", [chatId]);
    } catch (err) {
      console.error("Error clearing session:", err);
    }
  }

  // ==========================================
  // إحصائيات عامة للوحة التحكم (Dashboard Stats)
  // ==========================================
  static async getDashboardStats() {
    const stats = {
      total_codes: 0,
      active_codes: 0,
      inactive_codes: 0,
      expired_codes: 0,
      online_today: 0,
      total_orders: 0,
      today_orders: 0,
      accepted_orders: 0,
      rejected_orders: 0,
      total_delivery_fee: 0.0,
    };

    try {
      const codesSummary = await this.fetchOne(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_active = true AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)) as active,
          COUNT(*) FILTER (WHERE is_active = false) as inactive,
          COUNT(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP) as expired,
          COUNT(*) FILTER (WHERE last_seen_at >= CURRENT_DATE) as online_today
        FROM activation_codes;
      `);
      if (codesSummary) {
        stats.total_codes = Number(codesSummary.total || 0);
        stats.active_codes = Number(codesSummary.active || 0);
        stats.inactive_codes = Number(codesSummary.inactive || 0);
        stats.expired_codes = Number(codesSummary.expired || 0);
        stats.online_today = Number(codesSummary.online_today || 0);
      }
    } catch (e) {
      console.warn("getDashboardStats codes error:", e.message);
    }

    try {
      const ordersSummary = await this.fetchOne(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today,
          COUNT(*) FILTER (WHERE UPPER(action_taken) = 'ACCEPTED') as accepted,
          COUNT(*) FILTER (WHERE UPPER(action_taken) LIKE '%REJECT%') as rejected,
          COALESCE(SUM(delivery_fee), 0) as total_fee
        FROM orders;
      `);
      if (ordersSummary) {
        stats.total_orders = Number(ordersSummary.total || 0);
        stats.today_orders = Number(ordersSummary.today || 0);
        stats.accepted_orders = Number(ordersSummary.accepted || 0);
        stats.rejected_orders = Number(ordersSummary.rejected || 0);
        stats.total_delivery_fee = Number(ordersSummary.total_fee || 0);
      }
    } catch (e) {
      console.warn("getDashboardStats orders error:", e.message);
    }

    return stats;
  }

  // ==========================================
  // إدارة رموز التفعيل (Activation Codes)
  // ==========================================
  static async getActivationCodes({
    filter_type = "all",
    page = 1,
    page_size = 5,
    search_query = null,
  } = {}) {
    const conditions = ["1=1"];
    const params = [];

    if (filter_type === "active") {
      conditions.push(
        "is_active = true AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)"
      );
    } else if (filter_type === "inactive") {
      conditions.push("is_active = false");
    } else if (filter_type === "expired") {
      conditions.push(
        "expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP"
      );
    }

    if (search_query) {
      params.push(`%${search_query.trim()}%`);
      const pIdx = params.length;
      conditions.push(
        `(code ILIKE $${pIdx} OR user_name ILIKE $${pIdx} OR phone_number ILIKE $${pIdx})`
      );
    }

    const whereClause = conditions.join(" AND ");

    const countQuery = `SELECT COUNT(*) as count FROM activation_codes WHERE ${whereClause};`;
    const totalRow = await this.fetchOne(countQuery, params);
    const totalCount = totalRow ? Number(totalRow.count) : 0;

    const offset = (page - 1) * page_size;
    params.push(page_size);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const dataQuery = `
      SELECT id, code, user_name, phone_number, is_active, device_id, device_info,
             created_at, expires_at, last_seen_at, notes, is_device_locked
      FROM activation_codes
      WHERE ${whereClause}
      ORDER BY id DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `;

    const rows = await this.fetchAll(dataQuery, params);
    return { rows, totalCount };
  }

  static async getActivationCodeById(codeId) {
    return await this.fetchOne(
      "SELECT * FROM activation_codes WHERE id = $1;",
      [codeId]
    );
  }

  static async getActivationCodeByCode(code) {
    return await this.fetchOne(
      "SELECT * FROM activation_codes WHERE UPPER(code) = UPPER($1);",
      [code.trim()]
    );
  }

  static async toggleActivationCode(codeId) {
    const row = await this.fetchOne(
      "UPDATE activation_codes SET is_active = NOT is_active WHERE id = $1 RETURNING is_active;",
      [codeId]
    );
    return row ? Boolean(row.is_active) : false;
  }

  /**
   * تحويل أي صيغة مدة (ساعات/أيام/أشهر/نص عربي أو إنجليزي) إلى عدد الساعات الإجمالي:
   * null تعني دائم
   */
  static parseDurationHours(dur) {
    if (dur === null || dur === undefined || dur === "lifetime") return null;
    if (typeof dur === "number") return Math.max(1, Math.round(dur * 24));

    const s = String(dur).trim().toLowerCase();
    if (
      ["lifetime", "دائم", "دائمة", "بدون انتهاء", "infinity", "inf"].includes(s)
    ) {
      return null;
    }

    // نصوص عربية شائعة
    if (["ساعة", "ساعه", "1 ساعة", "1h"].includes(s)) return 1;
    if (["ساعتين", "2 ساعة", "2h"].includes(s)) return 2;
    if (["يوم", "يوم واحد", "1 يوم", "24h", "1d"].includes(s)) return 24;
    if (["يومين", "2 يوم", "2d"].includes(s)) return 48;
    if (["أسبوع", "اسبوع", "7d", "7"].includes(s)) return 7 * 24;
    if (["شهر", "30d", "30"].includes(s)) return 30 * 24;
    if (["سنة", "سنه", "عام", "365d", "365"].includes(s)) return 365 * 24;

    // لواحق بالساعات
    if (s.endsWith("h") || s.endsWith("س")) {
      const numPart = s.replace(/[hsس ]/g, "");
      const val = parseFloat(numPart);
      if (!isNaN(val)) return Math.max(1, Math.round(val));
    }

    // لواحق بالأيام
    if (s.endsWith("d") || s.endsWith("ي")) {
      const numPart = s.replace(/[dyي ]/g, "");
      const val = parseFloat(numPart);
      if (!isNaN(val)) return Math.max(1, Math.round(val * 24));
    }

    // فحص كلمة ساعة أو ساعات
    if (s.includes("ساع")) {
      const m = s.match(/(\d+(?:\.\d+)?)/);
      if (m) return Math.max(1, Math.round(parseFloat(m[1])));
    }

    // فحص كلمة يوم أو أيام
    if (s.includes("يوم") || s.includes("ايام") || s.includes("أيام")) {
      const m = s.match(/(\d+(?:\.\d+)?)/);
      if (m) return Math.max(1, Math.round(parseFloat(m[1]) * 24));
    }

    // رقم مجرد -> نعتبره أياماً
    const parsedNum = parseFloat(s);
    if (!isNaN(parsedNum)) {
      return Math.max(1, Math.round(parsedNum * 24));
    }

    return 30 * 24; // افتراضي 30 يوم
  }

  static formatDurationLabel(dur) {
    const hours = this.parseDurationHours(dur);
    if (hours === null) {
      return "♾️ صلاحية دائمة (بدون انتهاء)";
    }

    const days = Math.floor(hours / 24);
    if (hours < 24) {
      if (hours === 1) return "ساعة واحدة ⏱️";
      if (hours === 2) return "ساعتين ⏱️";
      if (hours >= 3 && hours <= 10) return `${hours} ساعات ⏱️`;
      return `${hours} ساعة ⏱️`;
    } else {
      if (days === 1) return "24 ساعة (يوم واحد) 🗓️";
      if (days === 2) return "يومين 📅";
      if (days >= 3 && days <= 10) return `${days} أيام 📅`;
      if (days === 30) return "30 يوماً (شهر) 🗓️";
      if (days === 90) return "90 يوماً (3 أشهر) 🚀";
      if (days === 365) return "365 يوماً (سنة) ⭐";
      return `${days} يوماً 📅`;
    }
  }

  static async extendCodeExpiry(codeId, duration) {
    const hours = this.parseDurationHours(duration);
    if (hours === null) {
      // دائم
      const row = await this.fetchOne(
        "UPDATE activation_codes SET expires_at = NULL, is_active = true WHERE id = $1 RETURNING expires_at;",
        [codeId]
      );
      return null;
    } else {
      const sql = `
        UPDATE activation_codes
        SET expires_at = (
            CASE 
                WHEN expires_at IS NOT NULL AND expires_at > CURRENT_TIMESTAMP 
                THEN expires_at + ($2 || ' hours')::INTERVAL
                ELSE CURRENT_TIMESTAMP + ($2 || ' hours')::INTERVAL
            END
        ),
        is_active = true
        WHERE id = $1
        RETURNING expires_at;
      `;
      const row = await this.fetchOne(sql, [codeId, hours]);
      return row ? row.expires_at : null;
    }
  }

  static async resetDeviceLock(codeId) {
    const count = await this.execute(
      "UPDATE activation_codes SET device_id = NULL, device_info = NULL WHERE id = $1;",
      [codeId]
    );
    return count > 0;
  }

  static async toggleDeviceLock(codeId) {
    const row = await this.fetchOne(
      "UPDATE activation_codes SET is_device_locked = NOT COALESCE(is_device_locked, true) WHERE id = $1 RETURNING is_device_locked;",
      [codeId]
    );
    return row ? Boolean(row.is_device_locked) : null;
  }

  static async createActivationCode({
    code,
    user_name = null,
    phone_number = null,
    duration = "30d",
    notes = null,
  }) {
    const hours = this.parseDurationHours(duration);
    let expiresAt = null;
    if (hours !== null) {
      expiresAt = new Date(Date.now() + hours * 3600 * 1000);
    }

    const row = await this.fetchOne(
      `INSERT INTO activation_codes (
         code, user_name, phone_number, is_active, created_at, expires_at, notes
       ) VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP, $4, $5)
       RETURNING id;`,
      [code.trim().toUpperCase(), user_name, phone_number, expiresAt, notes]
    );
    return row.id;
  }

  static async updateCodeInfo(codeId, { user_name, phone_number, notes }) {
    const count = await this.execute(
      `UPDATE activation_codes 
       SET user_name = COALESCE($1, user_name),
           phone_number = COALESCE($2, phone_number),
           notes = COALESCE($3, notes)
       WHERE id = $4;`,
      [user_name || null, phone_number || null, notes || null, codeId]
    );
    return count > 0;
  }

  static async deleteActivationCode(codeId) {
    const count = await this.execute(
      "DELETE FROM activation_codes WHERE id = $1;",
      [codeId]
    );
    return count > 0;
  }

  // ==========================================
  // إدارة سجل الطلبات (Orders)
  // ==========================================
  static async getOrders({
    page = 1,
    page_size = 5,
    action_filter = null,
    code_filter = null,
  } = {}) {
    const conditions = ["1=1"];
    const params = [];

    if (action_filter) {
      params.push(action_filter);
      conditions.push(`UPPER(action_taken) = UPPER($${params.length})`);
    }

    if (code_filter) {
      params.push(code_filter.trim());
      conditions.push(`UPPER(activation_code) = UPPER($${params.length})`);
    }

    const whereClause = conditions.join(" AND ");

    const countQuery = `SELECT COUNT(*) as count FROM orders WHERE ${whereClause};`;
    const totalRow = await this.fetchOne(countQuery, params);
    const totalCount = totalRow ? Number(totalRow.count) : 0;

    const offset = (page - 1) * page_size;
    params.push(page_size);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const dataQuery = `
      SELECT id, activation_code, user_name, order_title,
             restaurant_distance_km, customer_distance_km, total_distance_km,
             delivery_fee, order_price, payment_method, action_taken, action_reason,
             created_at, raw_details
      FROM orders
      WHERE ${whereClause}
      ORDER BY id DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `;

    const rows = await this.fetchAll(dataQuery, params);
    return { rows, totalCount };
  }

  static async getOrderById(orderId) {
    return await this.fetchOne("SELECT * FROM orders WHERE id = $1;", [orderId]);
  }

  static async deleteOrder(orderId) {
    const count = await this.execute("DELETE FROM orders WHERE id = $1;", [orderId]);
    return count > 0;
  }

  // ==========================================
  // استكشاف الجداول العامة ديناميكياً (PostgreSQL Explorer)
  // ==========================================
  static async getAllTables() {
    const sql = `
      SELECT 
        t.table_name,
        COALESCE(c.reltuples::bigint, 0) AS approx_rows
      FROM information_schema.tables t
      LEFT JOIN pg_class c ON c.relname = t.table_name
      WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name;
    `;
    const tables = await this.fetchAll(sql);
    const result = [];
    for (const t of tables) {
      const tname = t.table_name;
      let exactCount = Number(t.approx_rows || 0);
      try {
        const cnt = await this.fetchOne(`SELECT COUNT(*) as cnt FROM "${tname}";`);
        if (cnt) exactCount = Number(cnt.cnt);
      } catch {
        // fallback
      }
      result.push({
        table_name: tname,
        row_count: exactCount,
      });
    }
    return result;
  }

  static async getTableSchema(tableName) {
    const sql = `
      SELECT 
        column_name, 
        data_type, 
        is_nullable, 
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `;
    return await this.fetchAll(sql, [tableName]);
  }

  static async getTableData(tableName, { page = 1, page_size = 5 } = {}) {
    const allTables = await this.getAllTables();
    const validNames = allTables.map((t) => t.table_name);
    if (!validNames.includes(tableName)) {
      throw new Error(`الجدول ${tableName} غير موجود!`);
    }

    const cnt = await this.fetchOne(`SELECT COUNT(*) as cnt FROM "${tableName}";`);
    const total = cnt ? Number(cnt.cnt) : 0;

    const offset = (page - 1) * page_size;
    const res = await this.query(
      `SELECT * FROM "${tableName}" LIMIT $1 OFFSET $2;`,
      [page_size, offset]
    );

    const rows = res.rows;
    const columns = res.fields ? res.fields.map((f) => f.name) : [];
    return { rows, columns, total };
  }

  static async executeCustomQuery(sqlQuery) {
    const cleanSql = sqlQuery.trim();
    const start = Date.now();
    const res = await this.query(cleanSql);
    const duration = ((Date.now() - start) / 1000).toFixed(3) + "s";

    if (res.fields && res.fields.length > 0) {
      const columns = res.fields.map((f) => f.name);
      const rows = res.rows.map((row) => columns.map((col) => row[col]));
      return { columns, rows, count: rows.length, duration };
    } else {
      return { columns: [], rows: [], count: res.rowCount || 0, duration };
    }
  }

  // ==========================================
  // تصدير البيانات إلى Excel (Export to Excel)
  // ==========================================
  static async exportTableToExcel(tableName) {
    const allTables = await this.getAllTables();
    const validNames = allTables.map((t) => t.table_name);
    if (!validNames.includes(tableName)) {
      throw new Error(`الجدول ${tableName} غير موجود!`);
    }

    const res = await this.query(`SELECT * FROM "${tableName}";`);
    const columns = res.fields ? res.fields.map((f) => f.name) : [];
    const rows = res.rows;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(tableName.slice(0, 31));

    // إضافة الأعمدة
    sheet.columns = columns.map((col) => ({
      header: col,
      key: col,
      width: Math.max(col.length + 5, 14),
    }));

    // تلوين وترتيب رأس الجدول
    const headerRow = sheet.getRow(1);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1F497D" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFCCCCCC" } },
        bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
        left: { style: "thin", color: { argb: "FFCCCCCC" } },
        right: { style: "thin", color: { argb: "FFCCCCCC" } },
      };
    });

    // إضافة الصفوف
    for (const row of rows) {
      const cleanObj = {};
      for (const col of columns) {
        const val = row[col];
        if (val instanceof Date) {
          cleanObj[col] = val.toISOString().slice(0, 19).replace("T", " ");
        } else if (typeof val === "boolean") {
          cleanObj[col] = val ? "نعم" : "لا";
        } else if (val === null || val === undefined) {
          cleanObj[col] = "";
        } else {
          cleanObj[col] = val;
        }
      }
      sheet.addRow(cleanObj);
    }

    // كتابة الملف كـ Buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

module.exports = DatabaseManager;
