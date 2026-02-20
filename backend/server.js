import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import axios from "axios";
import { parseStringPromise } from "xml2js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import sgMail from "@sendgrid/mail";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomBytes, randomUUID, createHash } from "crypto";
import multer from "multer";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = String(process.env.NODE_ENV || "development").toLowerCase();
const IS_PROD = NODE_ENV === "production";

const CORS_ORIGINS = (process.env.CORS_ORIGINS || "").split(",").map((v) => v.trim()).filter(Boolean);
const JWT_SECRET = process.env.JWT_SECRET || "";
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
const ADMIN_BOOTSTRAP_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD || "";
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "";
const EMAIL_AUTOMATIC_ENABLED = String(process.env.EMAIL_AUTOMATIC_ENABLED || "false").toLowerCase() === "true";
const CAN_SEND_EMAIL = Boolean(SENDGRID_API_KEY && EMAIL_FROM);
const CAN_SEND_AUTOMATIC_EMAIL = CAN_SEND_EMAIL && EMAIL_AUTOMATIC_ENABLED;
const AUTH_REQUIRE_EMAIL_VERIFICATION_RAW = String(
  process.env.AUTH_REQUIRE_EMAIL_VERIFICATION ?? "false"
).toLowerCase() === "true";
const AUTH_REQUIRE_EMAIL_VERIFICATION = AUTH_REQUIRE_EMAIL_VERIFICATION_RAW && CAN_SEND_AUTOMATIC_EMAIL;
const EMAIL_VERIFICATION_ENABLED = AUTH_REQUIRE_EMAIL_VERIFICATION && CAN_SEND_AUTOMATIC_EMAIL;
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";
const SQLITE_PATH = process.env.SQLITE_PATH || "./rfa.db";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, SQLITE_PATH);
const UPLOADS_DIR = path.resolve(__dirname, "uploads");
const TRUST_PROXY_RAW = String(process.env.TRUST_PROXY ?? "false").trim().toLowerCase();
const TRUST_PROXY = (() => {
  if (!TRUST_PROXY_RAW || TRUST_PROXY_RAW === "false" || TRUST_PROXY_RAW === "0" || TRUST_PROXY_RAW === "off") {
    return false;
  }
  if (TRUST_PROXY_RAW === "true") {
    // "true" es demasiado permisivo para express-rate-limit; limitar a un proxy.
    return 1;
  }
  if (/^\d+$/.test(TRUST_PROXY_RAW)) {
    return Number(TRUST_PROXY_RAW);
  }
  if (["loopback", "linklocal", "uniquelocal"].includes(TRUST_PROXY_RAW)) {
    return TRUST_PROXY_RAW;
  }
  // fallback seguro para despliegues tipicos detras de un solo proxy
  return 1;
})();
const TRUST_PROXY_ENABLED = TRUST_PROXY !== false;
const LOGIN_MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS || 8);
const LOGIN_LOCK_MS = Number(process.env.LOGIN_LOCK_MINUTES || 15) * 60 * 1000;
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const REFRESH_TOKEN_DAYS = Number(process.env.REFRESH_TOKEN_DAYS || 30);
const REFRESH_TOKEN_COOKIE = process.env.REFRESH_TOKEN_COOKIE || "rfa_refresh_token";
const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || "rfa_csrf_token";
const REFRESH_TOKEN_SECURE_COOKIE = String(process.env.REFRESH_TOKEN_SECURE_COOKIE || "false").toLowerCase() === "true";
const REFRESH_TOKEN_SAME_SITE = process.env.REFRESH_TOKEN_SAME_SITE || "lax";
const USER_RETENTION_DAYS = Number(process.env.USER_RETENTION_DAYS || 90);
const DATA_PURGE_INTERVAL_HOURS = Number(process.env.DATA_PURGE_INTERVAL_HOURS || 24);
const DB_FLUSH_INTERVAL_MS = Number(process.env.DB_FLUSH_INTERVAL_MS || 1500);

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET debe estar configurado con al menos 32 caracteres");
}

const appBaseOrigin = (() => {
  try {
    return new URL(APP_BASE_URL).origin;
  } catch {
    return null;
  }
})();
const allowedOrigins = CORS_ORIGINS.length
  ? CORS_ORIGINS
  : [appBaseOrigin, "http://localhost:3000", "http://127.0.0.1:3000"].filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname.toLowerCase();
    const protocol = parsed.protocol.toLowerCase();
    if ((host === "localhost" || host === "127.0.0.1") && ["http:", "https:"].includes(protocol)) {
      return true;
    }
    if ((host === "rfargentina.com" || host === "www.rfargentina.com") && ["http:", "https:"].includes(protocol)) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function isLocalOrigin(origin) {
  const value = String(origin || "").toLowerCase();
  return value.includes("localhost") || value.includes("127.0.0.1");
}

function validateRuntimeSecurityConfig() {
  const issues = [];
  const warnings = [];
  const sameSite = String(REFRESH_TOKEN_SAME_SITE || "lax").toLowerCase();

  if (!["lax", "strict", "none"].includes(sameSite)) {
    issues.push("REFRESH_TOKEN_SAME_SITE debe ser lax, strict o none");
  }

  if (sameSite === "none" && !REFRESH_TOKEN_SECURE_COOKIE) {
    issues.push("REFRESH_TOKEN_SAME_SITE=none requiere REFRESH_TOKEN_SECURE_COOKIE=true");
  }

  if (AUTH_REQUIRE_EMAIL_VERIFICATION_RAW && !CAN_SEND_AUTOMATIC_EMAIL) {
    issues.push("AUTH_REQUIRE_EMAIL_VERIFICATION=true requiere EMAIL_AUTOMATIC_ENABLED=true, SENDGRID_API_KEY y EMAIL_FROM");
  }

  if (!Number.isFinite(USER_RETENTION_DAYS) || USER_RETENTION_DAYS < 30 || USER_RETENTION_DAYS > 365) {
    issues.push("USER_RETENTION_DAYS debe estar entre 30 y 365");
  }

  if (!Number.isFinite(DATA_PURGE_INTERVAL_HOURS) || DATA_PURGE_INTERVAL_HOURS < 1 || DATA_PURGE_INTERVAL_HOURS > 168) {
    issues.push("DATA_PURGE_INTERVAL_HOURS debe estar entre 1 y 168");
  }

  if (!Number.isFinite(DB_FLUSH_INTERVAL_MS) || DB_FLUSH_INTERVAL_MS < 100 || DB_FLUSH_INTERVAL_MS > 60000) {
    issues.push("DB_FLUSH_INTERVAL_MS debe estar entre 100 y 60000");
  }

  if (IS_PROD) {
    if (!REFRESH_TOKEN_SECURE_COOKIE) {
      issues.push("En produccion REFRESH_TOKEN_SECURE_COOKIE debe ser true");
    }
    if (!String(APP_BASE_URL || "").toLowerCase().startsWith("https://")) {
      issues.push("En produccion APP_BASE_URL debe usar https");
    }
    if (!allowedOrigins.length) {
      issues.push("En produccion CORS_ORIGINS no puede estar vacio");
    }
    if (allowedOrigins.some(isLocalOrigin)) {
      issues.push("En produccion CORS_ORIGINS no debe incluir localhost/127.0.0.1");
    }
    if (!TRUST_PROXY_ENABLED) {
      warnings.push("TRUST_PROXY=false en produccion; revisar si usas reverse proxy");
    }
  }

  if (warnings.length) {
    warnings.forEach((warning) => console.warn("CONFIG WARN:", warning));
  }
  if (issues.length) {
    throw new Error(`Configuracion insegura de entorno:\n- ${issues.join("\n- ")}`);
  }
}

validateRuntimeSecurityConfig();

app.set("trust proxy", TRUST_PROXY);
app.disable("x-powered-by");
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes, intenta nuevamente en unos minutos" }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de autenticacion, espera unos minutos" }
});

const publicFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados envios, intenta nuevamente en unos minutos" }
});

app.use(cors({
  origin(origin, cb) {
    if (isAllowedOrigin(origin)) return cb(null, true);
    return cb(new Error("Origen no permitido por CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"]
}));
app.use(globalLimiter);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(cookieParser());
app.use((req, res, next) => {
  const requestId = randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  const startAt = Date.now();
  res.on("finish", () => {
    const elapsedMs = Date.now() - startAt;
    console.log(
      JSON.stringify({
        type: "http_access",
        requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        elapsedMs
      })
    );
  });
  next();
});

let db = null;
let server = null;
let shuttingDown = false;

if (CAN_SEND_AUTOMATIC_EMAIL) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 25 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain"
    ];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
  }
});

function maybeUpload(req, res, next) {
  if (req.is("multipart/form-data")) {
    return upload.array("adjuntos", 5)(req, res, next);
  }
  return next();
}

function persistDb() {
  if (!db) return;
  const data = db.export();
  const tmpPath = `${DB_PATH}.tmp`;
  const bakPath = `${DB_PATH}.bak`;

  // Escritura atómica (aprox) en Windows:
  // 1) write tmp
  // 2) si existe DB, renombrar a .bak
  // 3) renombrar tmp a DB
  // 4) eliminar .bak
  fs.writeFileSync(tmpPath, Buffer.from(data));
  if (fs.existsSync(DB_PATH)) {
    try {
      if (fs.existsSync(bakPath)) fs.unlinkSync(bakPath);
    } catch (_e) {
      // noop
    }
    try {
      fs.renameSync(DB_PATH, bakPath);
    } catch (_e) {
      // Si no se puede renombrar, intentamos sobreescritura directa (menos seguro, pero evita caida)
      fs.writeFileSync(DB_PATH, Buffer.from(data));
      try { fs.unlinkSync(tmpPath); } catch (_e2) {}
      return;
    }
  }

  try {
    fs.renameSync(tmpPath, DB_PATH);
  } catch (_e) {
    // Fallback: restaurar bak si existe
    try {
      if (fs.existsSync(bakPath) && !fs.existsSync(DB_PATH)) {
        fs.renameSync(bakPath, DB_PATH);
      }
    } catch (_e2) {
      // noop
    }
    throw _e;
  }

  try {
    if (fs.existsSync(bakPath)) fs.unlinkSync(bakPath);
  } catch (_e) {
    // noop
  }
}

let dbDirty = false;
let flushTimer = null;
let flushing = false;

function schedulePersistDb() {
  if (shuttingDown) return;
  dbDirty = true;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushPersistDb();
  }, DB_FLUSH_INTERVAL_MS);
}

function flushPersistDb() {
  if (!db || !dbDirty) return;
  if (flushing) return;
  flushing = true;
  try {
    persistDb();
    dbDirty = false;
  } catch (err) {
    console.error("DB FLUSH ERR:", err.message);
  } finally {
    flushing = false;
  }
}

function run(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.run(params);
  stmt.free();
  schedulePersistDb();
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      categoria TEXT,
      detalle TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS case_updates (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      author_id TEXT,
      mensaje TEXT NOT NULL,
      estado TEXT,
      prioridad TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_case_updates_case_id ON case_updates(case_id);
    CREATE TABLE IF NOT EXISTS enterprise_inquiries (
      id TEXT PRIMARY KEY,
      empresa TEXT NOT NULL,
      rubro TEXT NOT NULL,
      contacto TEXT NOT NULL,
      email TEXT NOT NULL,
      telefono TEXT,
      servicios TEXT,
      descripcion TEXT NOT NULL,
      volumen TEXT NOT NULL,
      comentarios TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS enterprise_retention_settings (
      enterprise_user_id TEXT PRIMARY KEY,
      retention_mode TEXT NOT NULL DEFAULT 'manual',
      retention_days INTEGER,
      updated_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(enterprise_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS auth_login_audit (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      email TEXT NOT NULL,
      ip TEXT NOT NULL,
      user_agent TEXT,
      success INTEGER NOT NULL DEFAULT 0,
      reason TEXT,
      attempts INTEGER,
      lock_until TEXT,
      request_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_auth_login_audit_created_at ON auth_login_audit(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_auth_login_audit_email ON auth_login_audit(email);
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      replaced_by_token_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_ip TEXT,
      user_agent TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
    CREATE TABLE IF NOT EXISTS security_events (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      event_type TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      success INTEGER NOT NULL DEFAULT 1,
      details TEXT,
      ip TEXT,
      user_agent TEXT,
      request_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
  `);
  const columns = all("PRAGMA table_info(cases)").map((c) => c.name);
  const addColumn = (name, type) => {
    if (!columns.includes(name)) {
      db.exec(`ALTER TABLE cases ADD COLUMN ${name} ${type};`);
    }
  };
  addColumn("nombre_completo", "TEXT");
  addColumn("dni_cuit", "TEXT");
  addColumn("email_contacto", "TEXT");
  addColumn("telefono", "TEXT");
  addColumn("entidad", "TEXT");
  addColumn("tipo_entidad", "TEXT");
  addColumn("monto_valor", "TEXT");
  addColumn("monto_escala", "TEXT");
  addColumn("monto_moneda", "TEXT");
  addColumn("medios_pago", "TEXT");
  addColumn("relato", "TEXT");
  addColumn("autorizacion", "INTEGER");
  addColumn("adjuntos", "TEXT");
  addColumn("plan_elegido", "TEXT");
  addColumn("case_code", "TEXT");
  addColumn("empresa", "TEXT");
  addColumn("prioridad", "TEXT");
  addColumn("fecha_caso", "TEXT");
  addColumn("canal_origen", "TEXT");
  addColumn("enterprise_user_id", "TEXT");
  addColumn("payment_receipt_filename", "TEXT");
  addColumn("payment_receipt_original_name", "TEXT");
  addColumn("payment_receipt_uploaded_at", "TEXT");
  const updatesColumns = all("PRAGMA table_info(case_updates)").map((c) => c.name);
  if (!updatesColumns.includes("prioridad")) {
    db.exec("ALTER TABLE case_updates ADD COLUMN prioridad TEXT;");
  }
  const userColumns = all("PRAGMA table_info(users)").map((c) => c.name);
  const addUserColumn = (name, type) => {
    if (!userColumns.includes(name)) {
      db.exec(`ALTER TABLE users ADD COLUMN ${name} ${type};`);
    }
  };
  addUserColumn("email_verified", "INTEGER DEFAULT 0");
  addUserColumn("verification_token", "TEXT");
  addUserColumn("verification_sent_at", "TEXT");
  const enterpriseRetentionColumns = all("PRAGMA table_info(enterprise_retention_settings)").map((c) => c.name);
  if (!enterpriseRetentionColumns.includes("updated_at")) {
    db.exec("ALTER TABLE enterprise_retention_settings ADD COLUMN updated_at TEXT;");
  }
  run(
    `UPDATE enterprise_retention_settings
     SET retention_mode = 'manual', retention_days = NULL
     WHERE retention_mode NOT IN ('manual', 'auto')`
  );
  run(
    `UPDATE enterprise_retention_settings
     SET retention_days = NULL
     WHERE retention_mode = 'manual'`
  );
  run(
    `UPDATE enterprise_retention_settings
     SET retention_days = 90
     WHERE retention_mode = 'auto' AND (retention_days IS NULL OR retention_days NOT IN (30, 60, 90))`
  );
  run(
    `UPDATE enterprise_retention_settings
     SET updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
     WHERE updated_at IS NULL OR TRIM(updated_at) = ''`
  );
  run("UPDATE users SET email_verified = 1 WHERE email_verified IS NULL");
  run("DELETE FROM refresh_tokens WHERE expires_at <= CURRENT_TIMESTAMP OR revoked_at IS NOT NULL");
  persistDb();
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidEmail(value) {
  if (!isNonEmptyString(value)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isStrongPassword(value) {
  if (!isNonEmptyString(value)) return false;
  const pwd = value.trim();
  if (pwd.length < 8 || pwd.length > 72) return false;
  const hasLetter = /[A-Za-z]/.test(pwd);
  const hasNumber = /\d/.test(pwd);
  return hasLetter && hasNumber;
}


function generateEnterprisePassword() {
  // Strong random password: uppercase, lowercase, numbers and symbols
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%*-_";
  const all = upper + lower + numbers + symbols;
  const pick = (chars) => chars[Math.floor(Math.random() * chars.length)];
  const chars = [pick(upper), pick(lower), pick(numbers), pick(symbols)];
  while (chars.length < 14) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function cleanText(value, max = 1000) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, max);
}

function normalizeCompareText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEnterpriseRetentionInput(payload = {}) {
  const mode = String(payload.retention_mode || "").trim().toLowerCase();
  if (!["manual", "auto"].includes(mode)) {
    return { ok: false, error: "retention_mode invalido. Usa manual o auto" };
  }
  if (mode === "manual") {
    return { ok: true, mode: "manual", days: null };
  }
  const daysRaw = typeof payload.retention_days === "number"
    ? payload.retention_days
    : Number(String(payload.retention_days || "").trim());
  if (![30, 60, 90].includes(daysRaw)) {
    return { ok: false, error: "retention_days invalido. Usa 30, 60 o 90" };
  }
  return { ok: true, mode: "auto", days: daysRaw };
}

function getEnterpriseRetentionSettings(enterpriseUserId) {
  const row = get(
    `SELECT enterprise_user_id, retention_mode, retention_days, updated_at
     FROM enterprise_retention_settings
     WHERE enterprise_user_id = ?`,
    [enterpriseUserId]
  );
  if (!row) {
    return {
      enterprise_user_id: enterpriseUserId,
      retention_mode: "manual",
      retention_days: null,
      updated_at: null
    };
  }
  const mode = row.retention_mode === "auto" ? "auto" : "manual";
  const days = mode === "auto" && [30, 60, 90].includes(Number(row.retention_days))
    ? Number(row.retention_days)
    : null;
  return {
    enterprise_user_id: enterpriseUserId,
    retention_mode: mode,
    retention_days: days,
    updated_at: row.updated_at || null
  };
}

function parseAttachmentFilenames(adjuntosValue) {
  if (!adjuntosValue) return [];
  try {
    const parsed = JSON.parse(adjuntosValue);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => path.basename(String(entry?.filename || "").trim()))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function deleteCaseAttachments(rows = []) {
  rows.forEach((row) => {
    parseAttachmentFilenames(row?.adjuntos).forEach((filename) => {
      const filePath = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error("PURGE ATTACHMENT ERR:", filename, err.message);
        }
      }
    });
    const paymentReceiptFilename = path.basename(String(row?.payment_receipt_filename || "").trim());
    if (paymentReceiptFilename) {
      const paymentReceiptPath = path.join(UPLOADS_DIR, paymentReceiptFilename);
      if (fs.existsSync(paymentReceiptPath)) {
        try {
          fs.unlinkSync(paymentReceiptPath);
        } catch (err) {
          console.error("PURGE PAYMENT RECEIPT ERR:", paymentReceiptFilename, err.message);
        }
      }
    }
  });
}

function purgeExpiredClosedCases() {
  const details = {
    userRetentionDays: USER_RETENTION_DAYS,
    deletedUserCases: 0,
    deletedEnterpriseCases: 0
  };

  const userRows = all(
    `SELECT id, adjuntos, payment_receipt_filename
     FROM cases
     WHERE estado = 'Cerrado'
       AND enterprise_user_id IS NULL
       AND datetime(updated_at) <= datetime('now', ?)` ,
    [`-${USER_RETENTION_DAYS} day`]
  );

  const enterpriseRows = all(
    `SELECT c.id, c.adjuntos, c.payment_receipt_filename
     FROM cases c
     JOIN enterprise_retention_settings ers ON ers.enterprise_user_id = c.enterprise_user_id
     WHERE c.estado = 'Cerrado'
       AND ers.retention_mode = 'auto'
       AND ers.retention_days IN (30, 60, 90)
       AND datetime(c.updated_at) <= datetime('now', printf('-%d day', ers.retention_days))`
  );

  if (userRows.length) {
    deleteCaseAttachments(userRows);
    userRows.forEach((row) => run("DELETE FROM cases WHERE id = ?", [row.id]));
    details.deletedUserCases = userRows.length;
  }

  if (enterpriseRows.length) {
    deleteCaseAttachments(enterpriseRows);
    enterpriseRows.forEach((row) => run("DELETE FROM cases WHERE id = ?", [row.id]));
    details.deletedEnterpriseCases = enterpriseRows.length;
  }

  return details;
}

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(72),
  account_type: z.string().trim().optional()
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(200),
  account_type: z.string().trim().optional()
});

const resendVerificationSchema = z.object({
  email: z.string().trim().email()
});

const enterpriseInquirySchema = z.object({
  empresa: z.string().trim().min(2).max(120),
  rubro: z.string().trim().min(2).max(120),
  contacto: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  telefono: z.union([z.string().trim().max(60), z.null(), z.undefined()]),
  servicios: z.union([z.string(), z.array(z.string()), z.null(), z.undefined()]),
  descripcion: z.string().trim().min(5).max(4000),
  volumen: z.string().trim().min(1).max(60),
  comentarios: z.union([z.string().trim().max(2000), z.null(), z.undefined()])
});


const enterpriseUserCreateSchema = z.object({
  email: z.string().trim().email(),
  password: z.union([z.string().min(8).max(72), z.null(), z.undefined()])
});

const publicCaseLookupSchema = z.object({
  case_id: z.string().trim().min(6).max(80),
  identifier: z.string().trim().min(3).max(180)
});

const caseCreateSchema = z.object({
  categoria: z.union([z.string().trim().max(120), z.null(), z.undefined()]),
  nombre_completo: z.union([z.string().trim().max(120), z.null(), z.undefined()]),
  dni_cuit: z.union([z.string().trim().max(40), z.null(), z.undefined()]),
  email_contacto: z.union([z.string().trim().email(), z.null(), z.undefined(), z.literal("")]),
  telefono: z.union([z.string().trim().max(60), z.null(), z.undefined()]),
  entidad: z.union([z.string().trim().max(160), z.null(), z.undefined()]),
  tipo_entidad: z.union([z.string().trim().max(160), z.null(), z.undefined()]),
  monto_valor: z.union([z.string().trim().max(40), z.null(), z.undefined()]),
  monto_escala: z.union([z.string().trim().max(40), z.null(), z.undefined()]),
  monto_moneda: z.union([z.string().trim().max(20), z.null(), z.undefined()]),
  medios_pago: z.any().optional(),
  relato: z.union([z.string().trim().max(4000), z.null(), z.undefined()]),
  autorizacion: z.union([z.boolean(), z.string(), z.null(), z.undefined()]),
  plan_elegido: z.union([z.string().trim().max(120), z.null(), z.undefined()]),
  detalle: z.union([z.string().trim().max(4000), z.null(), z.undefined()])
});

const publicCaseCreateSchema = caseCreateSchema.superRefine((data, ctx) => {
  const hasEmail = isNonEmptyString(data?.email_contacto);
  const hasDni = isNonEmptyString(data?.dni_cuit);
  if (!hasEmail && !hasDni) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["email_contacto"],
      message: "Debes indicar email o DNI/CUIT"
    });
  }
});

const caseUpdateSchema = z.object({
  mensaje: z.union([z.string().trim().max(3000), z.null(), z.undefined()]),
  estado: z.union([z.string().trim().max(120), z.null(), z.undefined()]),
  prioridad: z.union([z.string().trim().max(20), z.null(), z.undefined()])
});

const enterpriseRetentionSchema = z.object({
  retention_mode: z.string().trim().toLowerCase(),
  retention_days: z.union([z.number(), z.string(), z.null(), z.undefined()])
});

function findPublicCaseByLookup(caseIdRaw, identifierRaw) {
  const caseId = String(caseIdRaw || "").trim();
  const identifier = String(identifierRaw || "").trim();
  if (!caseId || !identifier) return null;

  const caso = get(
    `SELECT
      c.id, c.case_code, c.estado, c.categoria, c.entidad, c.plan_elegido, c.created_at, c.updated_at,
      c.dni_cuit, c.email_contacto, c.payment_receipt_uploaded_at, c.payment_receipt_filename,
      COALESCE(c.email_contacto, u.email) AS owner_email
     FROM cases c
     JOIN users u ON u.id = c.user_id
     WHERE (c.id = ? OR c.case_code = ?)
       AND c.enterprise_user_id IS NULL`,
    [caseId, caseId]
  );

  if (!caso) return null;
  const normalizedIdentifier = identifier.toLowerCase();
  const ownerEmail = String(caso.owner_email || "").trim().toLowerCase();
  const ownerDni = String(caso.dni_cuit || "").trim();
  const emailMatches = ownerEmail && ownerEmail === normalizedIdentifier;
  const dniMatches = ownerDni && ownerDni === identifier;
  if (!emailMatches && !dniMatches) return null;

  return caso;
}

function validateBody(schema, payload) {
  const parsed = schema.safeParse(payload || {});
  if (!parsed.success) {
    const first = parsed.error.issues?.[0];
    const field = first?.path?.[0] ? String(first.path[0]) : "payload";
    return { ok: false, error: `Campo invalido: ${field}` };
  }
  return { ok: true, data: parsed.data };
}

function hashRefreshToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function getRefreshCookieOptions() {
  const sameSiteRaw = String(REFRESH_TOKEN_SAME_SITE || "lax").toLowerCase();
  const sameSite = ["lax", "strict", "none"].includes(sameSiteRaw) ? sameSiteRaw : "lax";
  return {
    httpOnly: true,
    secure: REFRESH_TOKEN_SECURE_COOKIE,
    sameSite,
    path: "/",
    maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
  };
}

function getCsrfCookieOptions() {
  const refreshOptions = getRefreshCookieOptions();
  return {
    httpOnly: false,
    secure: refreshOptions.secure,
    sameSite: refreshOptions.sameSite,
    path: refreshOptions.path,
    maxAge: refreshOptions.maxAge
  };
}

function clearRefreshCookie(res) {
  const options = getRefreshCookieOptions();
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure: options.secure,
    sameSite: options.sameSite,
    path: options.path
  });
}

function clearCsrfCookie(res) {
  const options = getCsrfCookieOptions();
  res.clearCookie(CSRF_COOKIE_NAME, {
    httpOnly: false,
    secure: options.secure,
    sameSite: options.sameSite,
    path: options.path
  });
}

function setCsrfCookie(res) {
  const token = randomBytes(24).toString("hex");
  res.cookie(CSRF_COOKIE_NAME, token, getCsrfCookieOptions());
  return token;
}

function getRequestIp(req) {
  return cleanText(req.ip || req.connection?.remoteAddress || "unknown", 80) || "unknown";
}

function requireCsrfToken(req, res) {
  const csrfCookie = cleanText(req.cookies?.[CSRF_COOKIE_NAME], 120);
  const csrfHeader = cleanText(req.headers["x-csrf-token"], 120);
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    res.status(403).json({ error: "Token CSRF invalido" });
    return false;
  }
  return true;
}

function issueAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

function createRefreshTokenSession(req, userId) {
  const token = randomBytes(48).toString("hex");
  const tokenHash = hashRefreshToken(token);
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const ip = cleanText(req.ip || req.connection?.remoteAddress || "unknown", 80);
  const userAgent = cleanText(req.headers["user-agent"] || "", 255);
  run(
    `INSERT INTO refresh_tokens
    (id, user_id, token_hash, expires_at, created_ip, user_agent)
    VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, userId, tokenHash, expiresAt, ip, userAgent]
  );
  return { token, sessionId, expiresAt };
}
function revokeRefreshTokenByHash(tokenHash, replacedByTokenId = null) {
  if (!tokenHash) return;
  run(
    "UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP, replaced_by_token_id = ? WHERE token_hash = ? AND revoked_at IS NULL",
    [replacedByTokenId, tokenHash]
  );
}

const loginAttempts = new Map();

function getLoginAttemptKey(req, emailNorm) {
  const ip = String(req.ip || req.connection?.remoteAddress || "unknown");
  return `${emailNorm}::${ip}`;
}

function getLoginAttemptState(key) {
  const current = loginAttempts.get(key);
  if (!current) return null;
  if (current.lockUntil && Date.now() > current.lockUntil) {
    loginAttempts.delete(key);
    return null;
  }
  return current;
}

function registerLoginFailure(key) {
  const current = getLoginAttemptState(key) || { attempts: 0, lockUntil: null };
  const attempts = current.attempts + 1;
  const lockUntil = attempts >= LOGIN_MAX_ATTEMPTS ? Date.now() + LOGIN_LOCK_MS : current.lockUntil;
  loginAttempts.set(key, { attempts, lockUntil });
  return { attempts, lockUntil };
}

function clearLoginFailures(key) {
  loginAttempts.delete(key);
}

function logLoginAudit(req, { userId = null, email = "", success = false, reason = "", attempts = null, lockUntil = null }) {
  try {
    const ip = getRequestIp(req);
    const userAgent = cleanText(req.headers["user-agent"] || "", 255);
    run(
      `INSERT INTO auth_login_audit
      (id, user_id, email, ip, user_agent, success, reason, attempts, lock_until, request_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        userId,
        cleanText(email, 180) || "unknown",
        ip,
        userAgent,
        success ? 1 : 0,
        cleanText(reason, 120),
        attempts,
        lockUntil ? new Date(lockUntil).toISOString() : null,
        req.requestId || null
      ]
    );
  } catch (err) {
    console.error("LOGIN AUDIT ERR:", req.requestId, err.message);
  }
}

function normalizeHeader(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseCsvLine(line) {
  const out = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out.map((v) => String(v || "").trim());
}

function parseCsvText(csvText) {
  const lines = String(csvText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = cols[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function randomCaseSuffix(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function generatePublicCaseCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = `RFA-${randomCaseSuffix(6)}`;
    const exists = get("SELECT id FROM cases WHERE case_code = ? LIMIT 1", [code]);
    if (!exists) return code;
  }
  return `RFA-${Date.now().toString(36).toUpperCase()}`;
}

let publicIntakeUserIdCache = null;
const PUBLIC_INTAKE_EMAIL = "intake.publico@rfargentina.com";

function getOrCreatePublicIntakeUserId() {
  if (publicIntakeUserIdCache) return publicIntakeUserIdCache;
  const existing = get("SELECT id FROM users WHERE email = ?", [PUBLIC_INTAKE_EMAIL]);
  if (existing && existing.id) {
    publicIntakeUserIdCache = existing.id;
    return existing.id;
  }

  const userId = randomUUID();
  const tempPasswordHash = bcrypt.hashSync(randomUUID(), 10);
  run(
    "INSERT INTO users (id, email, password_hash, role, email_verified, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
    [userId, PUBLIC_INTAKE_EMAIL, tempPasswordHash, "user", 1]
  );
  const created = get("SELECT id FROM users WHERE email = ?", [PUBLIC_INTAKE_EMAIL]);
  if (!created?.id) {
    throw new Error("No se pudo crear el usuario tecnico de carga publica");
  }
  publicIntakeUserIdCache = created.id;
  return created.id;
}


function ensureAdminAccounts() {
  if (!ADMIN_EMAILS.length) return;

  const password = cleanText(ADMIN_BOOTSTRAP_PASSWORD, 120) || null;
  if (password && !isStrongPassword(password)) {
    throw new Error("ADMIN_BOOTSTRAP_PASSWORD invalida: debe tener 8-72 caracteres, letras y numeros");
  }

  const passwordHash = password ? bcrypt.hashSync(password, 10) : null;

  ADMIN_EMAILS.forEach((email) => {
    const existing = get("SELECT id, role FROM users WHERE email = ?", [email]);
    if (existing?.id) {
      if (passwordHash) {
        run(
          "UPDATE users SET role = 'admin', password_hash = ?, email_verified = 1 WHERE id = ?",
          [passwordHash, existing.id]
        );
      } else if (existing.role !== "admin") {
        run("UPDATE users SET role = 'admin', email_verified = 1 WHERE id = ?", [existing.id]);
      }
      return;
    }

    if (!passwordHash) {
      console.warn(`ADMIN BOOTSTRAP WARN: no se crea ${email} porque falta ADMIN_BOOTSTRAP_PASSWORD`);
      return;
    }

    const userId = randomUUID();
    run(
      "INSERT INTO users (id, email, password_hash, role, email_verified, created_at) VALUES (?, ?, ?, 'admin', 1, CURRENT_TIMESTAMP)",
      [userId, email, passwordHash]
    );
  });
}

function canAccessCase(user, caso) {
  if (!user || !caso) return false;
  if (user.role === "admin") return true;
  if (user.role === "enterprise") return caso.enterprise_user_id === user.sub;
  return caso.user_id === user.sub;
}

function getSendgridErrorDetail(err) {
  const code = err?.code || err?.response?.statusCode || "UNKNOWN";
  const body = err?.response?.body;
  const errors = Array.isArray(body?.errors) ? body.errors.map((e) => e?.message).filter(Boolean) : [];
  const message = errors[0] || err?.message || "Fallo de envio";
  return { code, message };
}

async function sendStatusEmail({ to, status, message, caseId }) {
  if (!CAN_SEND_AUTOMATIC_EMAIL || !isValidEmail(to)) return;
  const subject = `Actualizacion de tu reclamo: ${status}`;
  const text = [
    `Estado actual: ${status}`,
    message ? `Mensaje: ${message}` : null,
    caseId ? `ID de caso: ${caseId}` : null,
    "RFA - Reclamos Financieros Argentina"
  ]
    .filter(Boolean)
    .join("\n");
  try {
    await sgMail.send({
      to,
      from: EMAIL_FROM,
      subject,
      text
    });
  } catch (err) {
    console.error("EMAIL ERR:", err.message);
  }
}

async function sendVerificationEmail({ to, token }) {
  if (!CAN_SEND_AUTOMATIC_EMAIL || !isValidEmail(to) || !token) return;
  const verifyUrl = `${APP_BASE_URL}/verificar?token=${encodeURIComponent(token)}`;
  const subject = "Verifica tu email en RFA";
  const text = [
    "Necesitamos verificar tu email para activar tu cuenta.",
    `Verifica aqui: ${verifyUrl}`,
    "Si no solicitaste este registro, ignora este mensaje."
  ].join("\n");
  try {
    await sgMail.send({
      to,
      from: EMAIL_FROM,
      subject,
      text
    });
  } catch (err) {
    const detail = getSendgridErrorDetail(err);
    console.error("EMAIL VERIFY ERR:", detail.code, detail.message);
    const wrapped = new Error(detail.message);
    wrapped.code = "EMAIL_SEND_FAILED";
    throw wrapped;
  }
}

function logSecurityEvent(req, {
  userId = null,
  eventType = "",
  resourceType = null,
  resourceId = null,
  success = true,
  details = null
}) {
  try {
    const ip = getRequestIp(req);
    const userAgent = cleanText(req.headers["user-agent"] || "", 255);
    const detailsText = details == null
      ? null
      : cleanText(typeof details === "string" ? details : JSON.stringify(details), 2000);
    run(
      `INSERT INTO security_events
      (id, user_id, event_type, resource_type, resource_id, success, details, ip, user_agent, request_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        userId,
        cleanText(eventType, 80) || "unknown_event",
        cleanText(resourceType, 80),
        cleanText(resourceId, 120),
        success ? 1 : 0,
        detailsText,
        ip,
        userAgent,
        req.requestId || null
      ]
    );
  } catch (err) {
    console.error("SECURITY EVENT ERR:", req.requestId, err.message);
  }
}
function signToken(user) {
  return issueAccessToken(user);
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No autorizado" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: "Token invalido" });
  }
}
function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Acceso restringido" });
  return next();
}

app.get("/", (_req, res) => {
  res.send("Servidor funcionando correctamente");
});

app.get("/health", (_req, res) => {
  res.status(200).send("OK");
});

app.get("/api/auth/config", (_req, res) => {
  res.json({ emailVerificationEnabled: EMAIL_VERIFICATION_ENABLED });
});

// ---- Noticias RSS (cache 30 min) ----
const FEEDS = [
  "https://news.google.com/rss/search?q=site:ambito.com+OR+site:iprofesional.com+reclamos+financieros&hl=es-419&gl=AR&ceid=AR:es-419",
  "https://news.google.com/rss/search?q=billeteras+digitales+reclamos&hl=es-419&gl=AR&ceid=AR:es-419",
  "https://news.google.com/rss/search?q=BCRA+regulaci%C3%B3n+transferencias&hl=es-419&gl=AR&ceid=AR:es-419"
];

let cache = { data: [], ts: 0 };
const TTL_MS = 1000 * 60 * 30;

async function fetchFeed(url) {
  const { data: xml } = await axios.get(url, { timeout: 7000 });
  const json = await parseStringPromise(xml, { trim: true, explicitArray: false });
  const items = json.rss?.channel?.item || [];
  const arr = Array.isArray(items) ? items : [items];
  return arr.map((it) => ({ title: it.title, link: it.link, date: it.pubDate }));
}

const handleNoticias = async (_req, res) => {
  try {
    if (Date.now() - cache.ts < TTL_MS && cache.data.length) {
      return res.json(cache.data.slice(0, 8));
    }
    const settled = await Promise.allSettled(FEEDS.map(fetchFeed));
    const results = settled
      .filter((result) => result.status === "fulfilled")
      .flatMap((result) => result.value);
    const seen = new Set();
    const uniq = [];
    results
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .forEach((it) => {
        if (it?.link && !seen.has(it.link)) {
          seen.add(it.link);
          uniq.push(it);
        }
      });
    cache = { data: uniq, ts: Date.now() };
    res.json(uniq.slice(0, 8));
  } catch (e) {
    console.error("NEWS ERR:", e.message);
    res.status(500).json([]);
  }
};

app.get("/api/noticias", handleNoticias);
app.get("/api/news", handleNoticias);

// -------------------- EMPRESAS --------------------
app.post("/api/enterprise", publicFormLimiter, async (req, res) => {
  try {
    const validated = validateBody(enterpriseInquirySchema, req.body);
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error });
    }
    const {
      empresa,
      rubro,
      contacto,
      email,
      telefono,
      servicios,
      descripcion,
      volumen,
      comentarios
    } = validated.data;

    const inquiryId = randomUUID();
    const empresaClean = cleanText(empresa, 120);
    const rubroClean = cleanText(rubro, 120);
    const contactoClean = cleanText(contacto, 120);
    const emailClean = cleanText(email, 180)?.toLowerCase();
    const telefonoClean = cleanText(telefono, 60);
    const descripcionClean = cleanText(descripcion, 4000);
    const volumenClean = cleanText(volumen, 60);
    const comentariosClean = cleanText(comentarios, 2000);
    run(
      `INSERT INTO enterprise_inquiries (
        id, empresa, rubro, contacto, email, telefono, servicios, descripcion, volumen, comentarios
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        inquiryId,
        empresaClean,
        rubroClean,
        contactoClean,
        emailClean,
        telefonoClean,
        typeof servicios === "string" ? servicios : JSON.stringify(servicios || []),
        descripcionClean,
        volumenClean,
        comentariosClean
      ]
    );
    const created = get("SELECT * FROM enterprise_inquiries WHERE id = ?", [inquiryId]);
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ error: "Error al registrar consulta" });
  }
});

app.post("/api/public/cases", publicFormLimiter, maybeUpload, async (req, res) => {
  try {
    const validated = validateBody(publicCaseCreateSchema, req.body);
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error });
    }

    const body = validated.data;
    const {
      categoria,
      nombre_completo,
      dni_cuit,
      email_contacto,
      telefono,
      entidad,
      tipo_entidad,
      monto_valor,
      monto_escala,
      monto_moneda,
      medios_pago,
      relato,
      autorizacion,
      plan_elegido,
      detalle
    } = body;

    const detalleValue = cleanText(relato || detalle, 4000);
    if (!detalleValue) {
      return res.status(400).json({ error: "La descripcion del caso es obligatoria" });
    }

    const emailContactoClean = cleanText(email_contacto === "" ? null : email_contacto, 180)?.toLowerCase();
    const dniCuitClean = cleanText(dni_cuit, 40);
    if (!emailContactoClean && !dniCuitClean) {
      return res.status(400).json({ error: "Debes indicar email o DNI/CUIT" });
    }

    const files = (req.files || []).map((file) => ({
      originalName: file.originalname,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype
    }));

    const caseId = randomUUID();
    const caseCode = generatePublicCaseCode();
    const estadoInicial = "Recibido";
    const intakeUserId = getOrCreatePublicIntakeUserId();

    const insertValues = [
      caseId,
      intakeUserId,
      cleanText(categoria, 120),
      detalleValue,
      estadoInicial,
      cleanText(nombre_completo, 120),
      dniCuitClean,
      emailContactoClean,
      cleanText(telefono, 60),
      cleanText(entidad, 160),
      cleanText(tipo_entidad, 160),
      cleanText(monto_valor, 40),
      cleanText(monto_escala, 40),
      cleanText(monto_moneda, 20),
      typeof medios_pago === "string" ? medios_pago : JSON.stringify(medios_pago || []),
      cleanText(relato, 4000),
      autorizacion === "true" || autorizacion === true ? 1 : 0,
      files.length ? JSON.stringify(files) : null,
      cleanText(plan_elegido, 120),
      caseCode
    ].map((value) => (value === undefined ? null : value));

    run(
      `INSERT INTO cases (
        id, user_id, categoria, detalle, estado, nombre_completo, dni_cuit, email_contacto, telefono,
        entidad, tipo_entidad, monto_valor, monto_escala, monto_moneda, medios_pago, relato,
        autorizacion, adjuntos, plan_elegido, case_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      insertValues
    );

    run("INSERT INTO case_updates (id, case_id, author_id, mensaje, estado, prioridad) VALUES (?, ?, ?, ?, ?, ?)", [
      randomUUID(),
      caseId,
      intakeUserId,
      "Caso cargado por formulario publico.",
      estadoInicial,
      null
    ]);

    return res.status(201).json({
      id: caseId,
      case_code: caseCode,
      estado: estadoInicial,
      message: "Caso cargado correctamente. Guarda tu ID para seguimiento."
    });
  } catch (err) {
    console.error("PUBLIC CASE CREATE ERR:", req.requestId, err?.message || err);
    return res.status(500).json({ error: "Error al crear el caso" });
  }
});

app.post("/api/public/case-lookup", publicFormLimiter, async (req, res) => {
  try {
    const validated = validateBody(publicCaseLookupSchema, req.body);
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error });
    }

    const caseId = String(validated.data.case_id || "").trim();
    const identifier = String(validated.data.identifier || "").trim();
    if (!caseId || !identifier) {
      return res.status(400).json({ error: "Debes ingresar ID de caso e identificador" });
    }

    const notFoundMessage = "No se encontro un caso con esos datos";
    const caso = findPublicCaseByLookup(caseId, identifier);
    if (!caso) {
      return res.status(404).json({ error: notFoundMessage });
    }

    const updates = all(
      `
      SELECT cu.*, u.email AS author_email
      FROM case_updates cu
      LEFT JOIN users u ON u.id = cu.author_id
      WHERE cu.case_id = ?
      ORDER BY cu.created_at DESC, cu.rowid DESC
      `,
      [caso.id]
    );

    return res.json({
      case: {
        id: caso.id,
        case_code: caso.case_code || caso.id,
        estado: caso.estado || "Recibido",
        categoria: caso.categoria || null,
        entidad: caso.entidad || null,
        plan_elegido: caso.plan_elegido || null,
        payment_receipt_uploaded_at: caso.payment_receipt_uploaded_at || null,
        has_payment_receipt: Boolean(caso.payment_receipt_filename),
        email_contacto: caso.email_contacto || null,
        created_at: caso.created_at,
        updated_at: caso.updated_at
      },
      updates
    });
  } catch (err) {
    console.error("PUBLIC CASE LOOKUP ERR:", req.requestId, err.message);
    return res.status(500).json({ error: "Error al consultar el caso" });
  }
});

app.post("/api/public/case-payment-receipt", publicFormLimiter, (req, res, next) => {
  upload.single("comprobante")(req, res, (err) => {
    if (err) return next(err);
    return next();
  });
}, async (req, res) => {
  try {
    const caseId = cleanText(req.body?.case_id, 80);
    const identifier = cleanText(req.body?.identifier, 180);
    if (!caseId || !identifier) {
      return res.status(400).json({ error: "Debes indicar ID de caso e identificador" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Debes adjuntar un comprobante" });
    }

    const caso = findPublicCaseByLookup(caseId, identifier);
    if (!caso) {
      return res.status(404).json({ error: "No se encontro un caso con esos datos" });
    }

    const oldFilename = path.basename(String(caso.payment_receipt_filename || "").trim());
    if (oldFilename) {
      const oldPath = path.join(UPLOADS_DIR, oldFilename);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (err) {
          console.error("PAYMENT RECEIPT REPLACE ERR:", oldFilename, err.message);
        }
      }
    }

    run(
      `UPDATE cases
       SET payment_receipt_filename = ?, payment_receipt_original_name = ?, payment_receipt_uploaded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [req.file.filename, cleanText(req.file.originalname, 255), caso.id]
    );
    run(
      "INSERT INTO case_updates (id, case_id, author_id, mensaje, estado, prioridad) VALUES (?, ?, ?, ?, ?, ?)",
      [randomUUID(), caso.id, null, "Cliente cargo comprobante de pago.", caso.estado || null, null]
    );

    return res.status(201).json({
      message: "Comprobante cargado correctamente.",
      payment_receipt_uploaded_at: new Date().toISOString()
    });
  } catch (err) {
    console.error("PUBLIC PAYMENT RECEIPT ERR:", req.requestId, err.message);
    return res.status(500).json({ error: "No se pudo cargar el comprobante" });
  }
});

app.get("/api/enterprise", authRequired, adminOnly, async (_req, res) => {
  try {
    const rows = all("SELECT * FROM enterprise_inquiries ORDER BY created_at DESC");
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: "Error al listar consultas" });
  }
});

app.get("/api/enterprise-users", authRequired, adminOnly, async (_req, res) => {
  try {
    const rows = all(
      "SELECT id, email, created_at FROM users WHERE role = 'enterprise' ORDER BY email ASC"
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: "Error al listar usuarios empresa" });
  }
});

app.post("/api/enterprise-users", authRequired, adminOnly, async (req, res) => {
  try {
    const validated = validateBody(enterpriseUserCreateSchema, req.body);
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error });
    }

    const emailNorm = cleanText(validated.data.email, 180)?.toLowerCase();
    if (!emailNorm) {
      return res.status(400).json({ error: "Email invalido" });
    }

    const existing = get("SELECT id FROM users WHERE lower(email) = lower(?)", [emailNorm]);
    if (existing) {
      return res.status(409).json({ error: "Ese email ya existe" });
    }

    const passwordPlain = cleanText(validated.data.password || "", 100) || generateEnterprisePassword();
    if (!isStrongPassword(passwordPlain)) {
      return res.status(400).json({
        error: "La contrasena debe tener entre 8 y 72 caracteres, con letras y numeros"
      });
    }

    const passwordHash = await bcrypt.hash(passwordPlain, 10);
    const userId = randomUUID();

    run(
      "INSERT INTO users (id, email, password_hash, role, email_verified, created_at) VALUES (?, ?, ?, 'enterprise', 1, CURRENT_TIMESTAMP)",
      [userId, emailNorm, passwordHash]
    );

    logSecurityEvent(req, {
      userId: req.user.sub,
      eventType: "enterprise_user_created",
      resourceType: "user",
      resourceId: userId,
      success: true,
      details: { email: emailNorm, role: "enterprise" }
    });

    return res.status(201).json({
      message: "Usuario empresa creado",
      user: { id: userId, email: emailNorm, role: "enterprise" },
      generated_password: passwordPlain
    });
  } catch (err) {
    return res.status(500).json({ error: "Error al crear usuario empresa" });
  }
});

app.get("/api/security/login-audit", authRequired, adminOnly, async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit || 200);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 1000) : 200;
    const email = cleanText(req.query.email, 180);
    if (email) {
      const rows = all(
        `SELECT id, user_id, email, ip, user_agent, success, reason, attempts, lock_until, request_id, created_at
         FROM auth_login_audit
         WHERE lower(email) = lower(?)
         ORDER BY created_at DESC
         LIMIT ?`,
        [email, limit]
      );
      return res.json(rows);
    }
    const rows = all(
      `SELECT id, user_id, email, ip, user_agent, success, reason, attempts, lock_until, request_id, created_at
       FROM auth_login_audit
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: "Error al listar auditoria de login" });
  }
});

app.get("/api/enterprise-retention", authRequired, async (req, res) => {
  try {
    if (req.user?.role !== "enterprise") {
      return res.status(403).json({ error: "Acceso restringido" });
    }
    const settings = getEnterpriseRetentionSettings(req.user.sub);
    return res.json(settings);
  } catch (err) {
    return res.status(500).json({ error: "Error al obtener configuracion de purga" });
  }
});

app.put("/api/enterprise-retention", authRequired, async (req, res) => {
  try {
    if (req.user?.role !== "enterprise") {
      return res.status(403).json({ error: "Acceso restringido" });
    }
    const validated = validateBody(enterpriseRetentionSchema, req.body);
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error });
    }
    const normalized = normalizeEnterpriseRetentionInput(validated.data);
    if (!normalized.ok) {
      return res.status(400).json({ error: normalized.error });
    }

    run(
      `INSERT INTO enterprise_retention_settings
      (enterprise_user_id, retention_mode, retention_days, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(enterprise_user_id) DO UPDATE SET
        retention_mode = excluded.retention_mode,
        retention_days = excluded.retention_days,
        updated_by = excluded.updated_by,
        updated_at = CURRENT_TIMESTAMP`,
      [req.user.sub, normalized.mode, normalized.days, req.user.sub]
    );

    logSecurityEvent(req, {
      userId: req.user.sub,
      eventType: "enterprise_retention_update",
      resourceType: "enterprise_settings",
      resourceId: req.user.sub,
      success: true,
      details: { retention_mode: normalized.mode, retention_days: normalized.days }
    });

    const settings = getEnterpriseRetentionSettings(req.user.sub);
    return res.json(settings);
  } catch (err) {
    return res.status(500).json({ error: "Error al guardar configuracion de purga" });
  }
});

app.get("/api/security/events", authRequired, adminOnly, async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit || 200);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 1000) : 200;
    const eventType = cleanText(req.query.event_type, 80);
    const userId = cleanText(req.query.user_id, 120);

    if (eventType) {
      const rows = all(
        `SELECT id, user_id, event_type, resource_type, resource_id, success, details, ip, user_agent, request_id, created_at
         FROM security_events
         WHERE event_type = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [eventType, limit]
      );
      return res.json(rows);
    }

    if (userId) {
      const rows = all(
        `SELECT id, user_id, event_type, resource_type, resource_id, success, details, ip, user_agent, request_id, created_at
         FROM security_events
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [userId, limit]
      );
      return res.json(rows);
    }

    const rows = all(
      `SELECT id, user_id, event_type, resource_type, resource_id, success, details, ip, user_agent, request_id, created_at
       FROM security_events
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: "Error al listar eventos de seguridad" });
  }
});

// -------------------- AUTH --------------------
app.post("/api/auth/register", authLimiter, async (req, res) => {
  try {
    const validated = validateBody(registerSchema, req.body);
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error });
    }
    const { email, password, account_type } = validated.data;
    const requestedAccountType = String(account_type || "user").trim().toLowerCase();
    if (requestedAccountType === "enterprise") {
      return res.status(403).json({
        error: "El alta de cuentas empresa se realiza solo por administracion de RFA"
      });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({
        error: "La contrasena debe tener entre 8 y 72 caracteres, con letras y numeros"
      });
    }

    const emailNorm = cleanText(email, 180)?.toLowerCase();
    if (!emailNorm) {
      return res.status(400).json({ error: "Email invalido" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const role = ADMIN_EMAILS.includes(emailNorm) ? "admin" : "user";
    const verificationToken = AUTH_REQUIRE_EMAIL_VERIFICATION ? randomUUID() : null;
    if (AUTH_REQUIRE_EMAIL_VERIFICATION && !CAN_SEND_AUTOMATIC_EMAIL) {
      return res.status(503).json({
        error: "Verificacion por email no configurada en el servidor",
        code: "EMAIL_SERVICE_NOT_CONFIGURED"
      });
    }

    const userId = randomUUID();
    run(
      "INSERT INTO users (id, email, password_hash, role, email_verified, verification_token, verification_sent_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
      [userId, emailNorm, passwordHash, role, AUTH_REQUIRE_EMAIL_VERIFICATION ? 0 : 1, verificationToken]
    );
    logSecurityEvent(req, {
      userId,
      eventType: "auth_register",
      resourceType: "user",
      resourceId: userId,
      success: true,
      details: { email: emailNorm, role }
    });
    if (AUTH_REQUIRE_EMAIL_VERIFICATION) {
      await sendVerificationEmail({ to: emailNorm, token: verificationToken });
      return res.status(201).json({ message: "Registro creado. Verifica tu email para activar la cuenta." });
    }
    return res.status(201).json({ message: "Registro creado correctamente." });
  } catch (err) {
    if (err?.code === "EMAIL_SEND_FAILED") {
      return res.status(502).json({ error: `No se pudo enviar el email de verificacion: ${err.message}` });
    }
    if (String(err.message || "").includes("UNIQUE")) {
      return res.status(409).json({ error: "El email ya esta registrado" });
    }
    console.error("REGISTER ERR:", req.requestId, err.message);
    return res.status(500).json({ error: "Error al registrar" });
  }
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    const validated = validateBody(loginSchema, req.body);
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error });
    }
    const { email, password } = validated.data;
    const emailNorm = cleanText(email, 180)?.toLowerCase();
    if (!emailNorm) {
      return res.status(400).json({ error: "Email invalido" });
    }

    const attemptKey = getLoginAttemptKey(req, emailNorm);
    const attemptState = getLoginAttemptState(attemptKey);
    if (attemptState?.lockUntil) {
      const waitSeconds = Math.ceil((attemptState.lockUntil - Date.now()) / 1000);
      logLoginAudit(req, {
        email: emailNorm,
        success: false,
        reason: "locked",
        attempts: attemptState.attempts || null,
        lockUntil: attemptState.lockUntil
      });
      return res.status(429).json({
        error: "Cuenta temporalmente bloqueada por intentos fallidos",
        retryAfterSeconds: Math.max(waitSeconds, 1)
      });
    }

    let user = get("SELECT id, email, password_hash, role, email_verified FROM users WHERE email = ?", [emailNorm]);
    if (!user) {
      const fail = registerLoginFailure(attemptKey);
      logLoginAudit(req, {
        email: emailNorm,
        success: false,
        reason: "user_not_found",
        attempts: fail.attempts,
        lockUntil: fail.lockUntil
      });
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      const fail = registerLoginFailure(attemptKey);
      logLoginAudit(req, {
        userId: user.id,
        email: emailNorm,
        success: false,
        reason: "invalid_password",
        attempts: fail.attempts,
        lockUntil: fail.lockUntil
      });
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    if (AUTH_REQUIRE_EMAIL_VERIFICATION && !user.email_verified) {
      logLoginAudit(req, {
        userId: user.id,
        email: emailNorm,
        success: false,
        reason: "email_not_verified"
      });
      return res.status(403).json({ error: "Email no verificado", code: "EMAIL_NOT_VERIFIED" });
    }

    if (user.role === "user") {
      logLoginAudit(req, {
        userId: user.id,
        email: emailNorm,
        success: false,
        reason: "user_portal_disabled"
      });
      return res.status(403).json({
        error: "El acceso para particulares se realiza desde 'Consultar caso' con email + ID de caso",
        code: "USER_PORTAL_DISABLED"
      });
    }

    if (ADMIN_EMAILS.includes(emailNorm) && user.role !== "admin") {
      run("UPDATE users SET role = ? WHERE id = ?", ["admin", user.id]);
      user = { ...user, role: "admin" };
    }

    clearLoginFailures(attemptKey);
    logLoginAudit(req, {
      userId: user.id,
      email: emailNorm,
      success: true,
      reason: "ok",
      attempts: 0
    });

    const token = signToken(user);
    const refreshSession = createRefreshTokenSession(req, user.id);
    res.cookie(REFRESH_TOKEN_COOKIE, refreshSession.token, getRefreshCookieOptions());
    setCsrfCookie(res);
    logSecurityEvent(req, {
      userId: user.id,
      eventType: "auth_login",
      resourceType: "user",
      resourceId: user.id,
      success: true
    });
    return res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error("LOGIN ERR:", req.requestId, err.message);
    return res.status(500).json({ error: "Error al iniciar sesion" });
  }
});

app.post("/api/auth/refresh", authLimiter, async (req, res) => {
  try {
    if (!requireCsrfToken(req, res)) {
      logSecurityEvent(req, {
        userId: null,
        eventType: "auth_refresh",
        resourceType: "session",
        success: false,
        details: { reason: "csrf_invalid" }
      });
      return;
    }
    const refreshToken = String(req.cookies?.[REFRESH_TOKEN_COOKIE] || "").trim();
    if (!refreshToken) {
      logSecurityEvent(req, {
        userId: null,
        eventType: "auth_refresh",
        resourceType: "session",
        success: false,
        details: { reason: "refresh_cookie_missing" }
      });
      return res.status(401).json({ error: "Sesion expirada. Inicia sesion nuevamente." });
    }

    const tokenHash = hashRefreshToken(refreshToken);
    const session = get(
      `SELECT id, user_id, token_hash, expires_at, revoked_at
       FROM refresh_tokens
       WHERE token_hash = ?`,
      [tokenHash]
    );

    if (!session || session.revoked_at) {
      clearRefreshCookie(res);
      clearCsrfCookie(res);
      logSecurityEvent(req, {
        userId: session?.user_id || null,
        eventType: "auth_refresh",
        resourceType: "session",
        success: false,
        details: { reason: "refresh_session_invalid" }
      });
      return res.status(401).json({ error: "Sesion expirada. Inicia sesion nuevamente." });
    }

    const expiresAtMs = Date.parse(session.expires_at);
    if (Number.isNaN(expiresAtMs) || expiresAtMs <= Date.now()) {
      revokeRefreshTokenByHash(tokenHash);
      clearRefreshCookie(res);
      clearCsrfCookie(res);
      logSecurityEvent(req, {
        userId: session.user_id,
        eventType: "auth_refresh",
        resourceType: "session",
        success: false,
        details: { reason: "refresh_expired" }
      });
      return res.status(401).json({ error: "Sesion expirada. Inicia sesion nuevamente." });
    }

    let user = get("SELECT id, email, role, email_verified FROM users WHERE id = ?", [session.user_id]);
    if (!user) {
      revokeRefreshTokenByHash(tokenHash);
      clearRefreshCookie(res);
      clearCsrfCookie(res);
      logSecurityEvent(req, {
        userId: session.user_id,
        eventType: "auth_refresh",
        resourceType: "session",
        success: false,
        details: { reason: "user_not_found" }
      });
      return res.status(401).json({ error: "Sesion invalida" });
    }

    if (AUTH_REQUIRE_EMAIL_VERIFICATION && !user.email_verified) {
      clearRefreshCookie(res);
      clearCsrfCookie(res);
      logSecurityEvent(req, {
        userId: user.id,
        eventType: "auth_refresh",
        resourceType: "session",
        success: false,
        details: { reason: "email_not_verified" }
      });
      return res.status(403).json({ error: "Email no verificado", code: "EMAIL_NOT_VERIFIED" });
    }

    if (ADMIN_EMAILS.includes(String(user.email || "").toLowerCase()) && user.role !== "admin") {
      run("UPDATE users SET role = ? WHERE id = ?", ["admin", user.id]);
      user = { ...user, role: "admin" };
    }

    const rotatedSession = createRefreshTokenSession(req, user.id);
    revokeRefreshTokenByHash(tokenHash, rotatedSession.sessionId);
    res.cookie(REFRESH_TOKEN_COOKIE, rotatedSession.token, getRefreshCookieOptions());
    setCsrfCookie(res);

    const token = signToken(user);
    logSecurityEvent(req, {
      userId: user.id,
      eventType: "auth_refresh",
      resourceType: "session",
      success: true
    });
    return res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error("REFRESH ERR:", req.requestId, err.message);
    clearRefreshCookie(res);
    clearCsrfCookie(res);
    return res.status(500).json({ error: "No se pudo renovar la sesion" });
  }
});

app.post("/api/auth/logout", async (req, res) => {
  try {
    if (!requireCsrfToken(req, res)) {
      logSecurityEvent(req, {
        userId: req.user?.sub || null,
        eventType: "auth_logout",
        resourceType: "session",
        success: false,
        details: { reason: "csrf_invalid" }
      });
      return;
    }
    const refreshToken = String(req.cookies?.[REFRESH_TOKEN_COOKIE] || "").trim();
    let userId = null;
    if (refreshToken) {
      const tokenHash = hashRefreshToken(refreshToken);
      const session = get("SELECT user_id FROM refresh_tokens WHERE token_hash = ?", [tokenHash]);
      userId = session?.user_id || null;
      revokeRefreshTokenByHash(tokenHash);
    }
    clearRefreshCookie(res);
    clearCsrfCookie(res);
    logSecurityEvent(req, {
      userId,
      eventType: "auth_logout",
      resourceType: "session",
      success: true
    });
    return res.json({ message: "Sesion cerrada" });
  } catch (err) {
    console.error("LOGOUT ERR:", req.requestId, err.message);
    clearRefreshCookie(res);
    clearCsrfCookie(res);
    return res.status(500).json({ error: "No se pudo cerrar sesion" });
  }
});

app.post("/api/auth/resend-verification", authLimiter, async (req, res) => {
  try {
    const validated = validateBody(resendVerificationSchema, req.body);
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error });
    }
    const { email } = validated.data;

    if (!AUTH_REQUIRE_EMAIL_VERIFICATION) {
      return res.status(200).json({ message: "La verificacion por email no es obligatoria actualmente." });
    }
    if (!CAN_SEND_AUTOMATIC_EMAIL) {
      return res.status(400).json({ error: "Envio de email no configurado" });
    }

    const emailNorm = cleanText(email, 180)?.toLowerCase();
    if (!emailNorm) {
      return res.status(400).json({ error: "Email invalido" });
    }

    const user = get("SELECT * FROM users WHERE email = ?", [emailNorm]);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    if (user.email_verified) {
      return res.status(200).json({ message: "El email ya esta verificado" });
    }

    const token = randomUUID();
    run("UPDATE users SET verification_token = ?, verification_sent_at = CURRENT_TIMESTAMP WHERE id = ?", [
      token,
      user.id
    ]);
    await sendVerificationEmail({ to: emailNorm, token });
    return res.json({ message: "Te enviamos un nuevo email de verificacion" });
  } catch (err) {
    if (err?.code === "EMAIL_SEND_FAILED") {
      return res.status(502).json({ error: `No se pudo reenviar la verificacion: ${err.message}` });
    }
    console.error("RESEND VERIFY ERR:", req.requestId, err.message);
    return res.status(500).json({ error: "No se pudo reenviar la verificacion" });
  }
});

app.get("/api/auth/verify", async (req, res) => {
  try {
    if (!AUTH_REQUIRE_EMAIL_VERIFICATION) {
      return res.status(200).json({ message: "La verificacion por email no es obligatoria actualmente." });
    }

    const token = String(req.query.token || "").trim();
    if (!token) {
      return res.status(400).json({ error: "Token invalido" });
    }

    const user = get("SELECT * FROM users WHERE verification_token = ?", [token]);
    if (!user) {
      return res.status(400).json({ error: "Token invalido o vencido" });
    }

    if (user.verification_sent_at) {
      const sentAtMs = Date.parse(user.verification_sent_at);
      const maxAgeMs = 24 * 60 * 60 * 1000;
      if (!Number.isNaN(sentAtMs) && Date.now() - sentAtMs > maxAgeMs) {
        return res.status(400).json({ error: "Token vencido. Reenvia la verificacion." });
      }
    }

    run("UPDATE users SET email_verified = 1, verification_token = NULL WHERE id = ?", [user.id]);
    const authToken = signToken(user);
    const refreshSession = createRefreshTokenSession(req, user.id);
    res.cookie(REFRESH_TOKEN_COOKIE, refreshSession.token, getRefreshCookieOptions());
    setCsrfCookie(res);
    logSecurityEvent(req, {
      userId: user.id,
      eventType: "auth_verify_email",
      resourceType: "user",
      resourceId: user.id,
      success: true
    });

    return res.json({
      message: "Email verificado correctamente",
      token: authToken,
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error("VERIFY ERR:", req.requestId, err.message);
    return res.status(500).json({ error: "No se pudo verificar el email" });
  }
});

app.get("/api/me", authRequired, async (req, res) => {
  try {
    const user = get("SELECT id, email, role, created_at FROM users WHERE id = ?", [req.user.sub]);
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ error: "Error al obtener usuario" });
  }
});
// -------------------- CASOS --------------------
app.get("/api/cases", authRequired, async (req, res) => {
  try {
    if (req.user.role === "admin") {
      const rows = all(`
        SELECT c.*, u.email AS user_email, eu.email AS enterprise_email
        FROM cases c
        JOIN users u ON u.id = c.user_id
        LEFT JOIN users eu ON eu.id = c.enterprise_user_id
        ORDER BY c.created_at DESC
      `);
      return res.json(rows);
    }
    if (req.user.role === "enterprise") {
      const rows = all(
        `SELECT c.*, u.email AS user_email
         FROM cases c
         JOIN users u ON u.id = c.user_id
         WHERE c.enterprise_user_id = ?
         ORDER BY c.created_at DESC`,
        [req.user.sub]
      );
      return res.json(rows);
    }
    const rows = all("SELECT * FROM cases WHERE user_id = ? ORDER BY created_at DESC", [req.user.sub]);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: "Error al listar casos" });
  }
});

app.post("/api/cases", authRequired, maybeUpload, async (req, res) => {
  try {
    const validated = validateBody(caseCreateSchema, req.body);
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error });
    }

    const body = validated.data;
    const {
      categoria,
      nombre_completo,
      dni_cuit,
      email_contacto,
      telefono,
      entidad,
      tipo_entidad,
      monto_valor,
      monto_escala,
      monto_moneda,
      medios_pago,
      relato,
      autorizacion,
      plan_elegido,
      detalle
    } = body;

    const detalleValue = cleanText(relato || detalle, 4000);
    if (!detalleValue) {
      return res.status(400).json({ error: "La descripcion del caso es obligatoria" });
    }

    const nombreCompletoClean = cleanText(nombre_completo, 120);
    const dniCuitClean = cleanText(dni_cuit, 40);
    const emailContactoClean = cleanText(email_contacto === "" ? null : email_contacto, 180)?.toLowerCase();
    const telefonoClean = cleanText(telefono, 60);
    const entidadClean = cleanText(entidad, 160);
    const tipoEntidadClean = cleanText(tipo_entidad, 160);
    const montoValorClean = cleanText(monto_valor, 40);
    const montoEscalaClean = cleanText(monto_escala, 40);
    const montoMonedaClean = cleanText(monto_moneda, 20);
    const relatoClean = cleanText(relato, 4000);
    const planElegidoClean = cleanText(plan_elegido, 120);
    const caseCode = generatePublicCaseCode();

    const caseId = randomUUID();
    const estadoInicial = "Recibido";
    run(
      `INSERT INTO cases (
        id, user_id, categoria, detalle, estado, nombre_completo, dni_cuit, email_contacto, telefono,
        entidad, tipo_entidad, monto_valor, monto_escala, monto_moneda, medios_pago, relato,
        autorizacion, adjuntos, plan_elegido, case_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        caseId,
        req.user.sub,
        cleanText(categoria, 120),
        detalleValue,
        estadoInicial,
        nombreCompletoClean,
        dniCuitClean,
        emailContactoClean,
        telefonoClean,
        entidadClean,
        tipoEntidadClean,
        montoValorClean,
        montoEscalaClean,
        montoMonedaClean,
        typeof medios_pago === "string" ? medios_pago : JSON.stringify(medios_pago || []),
        relatoClean,
        autorizacion === "true" || autorizacion === true ? 1 : 0,
        files.length ? JSON.stringify(files) : null,
        planElegidoClean,
        caseCode
      ]
    );

    const initialUpdateId = randomUUID();
    run("INSERT INTO case_updates (id, case_id, author_id, mensaje, estado, prioridad) VALUES (?, ?, ?, ?, ?, ?)", [
      initialUpdateId,
      caseId,
      req.user.sub,
      "Caso cargado por el usuario.",
      estadoInicial,
      null
    ]);
    logSecurityEvent(req, {
      userId: req.user.sub,
      eventType: "case_create",
      resourceType: "case",
      resourceId: caseId,
      success: true,
      details: {
        estado: estadoInicial,
        categoria: cleanText(categoria, 120)
      }
    });

    const created = get("SELECT * FROM cases WHERE id = ?", [caseId]);
    return res.status(201).json(created);
  } catch (err) {
    console.error("CREATE CASE ERR:", err.message);
    if (err.stack) console.error(err.stack);
    return res.status(500).json({ error: "Error al crear el caso" });
  }
});
app.get("/api/cases/:id", authRequired, async (req, res) => {
  try {
    const caso = get("SELECT * FROM cases WHERE id = ?", [req.params.id]);
    if (!caso) return res.status(404).json({ error: "Caso no encontrado" });

    if (!canAccessCase(req.user, caso)) {
      return res.status(403).json({ error: "Acceso restringido" });
    }
    return res.json(caso);
  } catch (err) {
    return res.status(500).json({ error: "Error al obtener caso" });
  }
});

app.get("/api/cases/:id/updates", authRequired, async (req, res) => {
  try {
    const caso = get("SELECT * FROM cases WHERE id = ?", [req.params.id]);
    if (!caso) return res.status(404).json({ error: "Caso no encontrado" });
    if (!canAccessCase(req.user, caso)) {
      return res.status(403).json({ error: "Acceso restringido" });
    }

    const rows = all(
      `
      SELECT cu.*, u.email AS author_email
      FROM case_updates cu
      LEFT JOIN users u ON u.id = cu.author_id
      WHERE cu.case_id = ?
      ORDER BY cu.created_at DESC, cu.rowid DESC
      `,
      [req.params.id]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: "Error al listar actualizaciones" });
  }
});

app.get("/api/cases/:id/files/:filename", authRequired, async (req, res) => {
  try {
    const caso = get("SELECT * FROM cases WHERE id = ?", [req.params.id]);
    if (!caso) return res.status(404).json({ error: "Caso no encontrado" });
    if (!canAccessCase(req.user, caso)) {
      return res.status(403).json({ error: "Acceso restringido" });
    }

    const requestedFilename = path.basename(String(req.params.filename || ""));
    if (!requestedFilename) {
      return res.status(400).json({ error: "Archivo invalido" });
    }

    let attachments = [];
    try {
      attachments = JSON.parse(caso.adjuntos || "[]");
      if (!Array.isArray(attachments)) attachments = [];
    } catch {
      attachments = [];
    }

    const attachment = attachments.find((item) => item?.filename === requestedFilename);
    if (!attachment) {
      return res.status(404).json({ error: "Adjunto no encontrado" });
    }

    const filePath = path.join(UPLOADS_DIR, requestedFilename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Archivo no disponible" });
    }

    const downloadName = attachment.originalName || requestedFilename;
    return res.download(filePath, downloadName);
  } catch (err) {
    return res.status(500).json({ error: "Error al descargar adjunto" });
  }
});

app.get("/api/cases/:id/payment-receipt", authRequired, async (req, res) => {
  try {
    const caso = get("SELECT * FROM cases WHERE id = ?", [req.params.id]);
    if (!caso) return res.status(404).json({ error: "Caso no encontrado" });
    if (!canAccessCase(req.user, caso)) {
      return res.status(403).json({ error: "Acceso restringido" });
    }

    const filename = path.basename(String(caso.payment_receipt_filename || "").trim());
    if (!filename) {
      return res.status(404).json({ error: "El caso no tiene comprobante cargado" });
    }
    const filePath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Comprobante no disponible" });
    }
    const downloadName = cleanText(caso.payment_receipt_original_name, 255) || `comprobante_${caso.case_code || caso.id}`;
    return res.download(filePath, downloadName);
  } catch (err) {
    return res.status(500).json({ error: "Error al descargar comprobante" });
  }
});

app.post("/api/cases/:id/updates", authRequired, async (req, res) => {
  try {
    const validated = validateBody(caseUpdateSchema, req.body);
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error });
    }
    const { mensaje, estado, prioridad } = validated.data;

    const caso = get("SELECT * FROM cases WHERE id = ?", [req.params.id]);
    if (!caso) return res.status(404).json({ error: "Caso no encontrado" });
    if (!canAccessCase(req.user, caso)) {
      return res.status(403).json({ error: "Acceso restringido" });
    }

    const isAdmin = req.user.role === "admin";
    const isEnterprise = req.user.role === "enterprise";
    if (!isAdmin && !isEnterprise) {
      return res.status(403).json({ error: "Acceso restringido" });
    }

    const allowedStatusEnterprise = new Set([
      "recibido",
      "en analisis",
      "pendiente interno",
      "cerrado"
    ]);
    const allowedStatusAdmin = new Set([
      "recibido",
      "en analisis",
      "documentacion solicitada",
      "viable (pendiente de pago)",
      "no viable",
      "presentado ante entidad",
      "en espera de respuesta",
      "respuesta recibida",
      "cerrado"
    ]);
    const allowedPriority = new Set(["alta", "media", "baja"]);

    const normalizedStatus = normalizeCompareText(estado);
    const normalizedPriority = normalizeCompareText(prioridad);

    if (isAdmin && estado && !allowedStatusAdmin.has(normalizedStatus)) {
      return res.status(400).json({ error: "Estado invalido" });
    }
    if (isEnterprise && estado && !allowedStatusEnterprise.has(normalizedStatus)) {
      return res.status(400).json({ error: "Estado invalido para usuario empresa" });
    }
    if (prioridad && !allowedPriority.has(normalizedPriority)) {
      return res.status(400).json({ error: "Prioridad invalida" });
    }

    const messageText = isNonEmptyString(mensaje)
      ? cleanText(mensaje, 3000)
      : isEnterprise
        ? "Actualizacion interna de empresa."
        : "";
    if (!isEnterprise && !messageText) {
      return res.status(400).json({ error: "El mensaje es obligatorio" });
    }

    const updateId = randomUUID();
    run("INSERT INTO case_updates (id, case_id, author_id, mensaje, estado, prioridad) VALUES (?, ?, ?, ?, ?, ?)", [
      updateId,
      req.params.id,
      req.user.sub,
      messageText,
      estado || null,
      prioridad || null
    ]);

    const newEstado = estado || caso.estado;
    const newPrioridad = prioridad || caso.prioridad || null;
    run(
      "UPDATE cases SET estado = ?, prioridad = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [newEstado, newPrioridad, req.params.id]
    );
    logSecurityEvent(req, {
      userId: req.user.sub,
      eventType: "case_update",
      resourceType: "case",
      resourceId: req.params.id,
      success: true,
      details: {
        fromEstado: caso.estado || null,
        toEstado: newEstado || null,
        fromPrioridad: caso.prioridad || null,
        toPrioridad: newPrioridad || null,
        actorRole: req.user.role
      }
    });

    const createdUpdate = get("SELECT * FROM case_updates WHERE id = ?", [updateId]);
    if (isAdmin && estado && estado !== caso.estado) {
      const owner = get("SELECT email FROM users WHERE id = ?", [caso.user_id]);
      const to = (caso.email_contacto || owner?.email || "").trim();
      await sendStatusEmail({ to, status: newEstado, message: messageText, caseId: caso.id });
    }
    return res.status(201).json(createdUpdate);
  } catch (err) {
    return res.status(500).json({ error: "Error al crear actualizacion" });
  }
});
app.post("/api/cases/import", authRequired, adminOnly, upload.single("file"), async (req, res) => {
  let importedCount = 0;
  let rejectedCount = 0;
  let importedFailed = false;
  try {
    const enterpriseUserId = String(req.body?.enterprise_user_id || "").trim();
    if (!enterpriseUserId) {
      return res.status(400).json({ error: "Debes seleccionar un usuario empresa" });
    }
    const enterpriseUser = get("SELECT id, email, role FROM users WHERE id = ?", [enterpriseUserId]);
    if (!enterpriseUser || enterpriseUser.role !== "enterprise") {
      return res.status(400).json({ error: "Usuario empresa invalido" });
    }
    if (!req.file?.path) {
      return res.status(400).json({ error: "Debes adjuntar un archivo CSV" });
    }

    const csvText = fs.readFileSync(req.file.path, "utf8");
    const rows = parseCsvText(csvText);
    if (!rows.length) {
      return res.status(400).json({ error: "Archivo vacio o sin filas validas" });
    }

    const allowedStatus = ["Recibido", "En analisis", "Pendiente interno", "Cerrado"];
    const allowedPriority = ["Alta", "Media", "Baja"];
    const importedRows = [];
    const rejectedRows = [];

    rows.forEach((row, idx) => {
      const line = idx + 2;
      const caseCode = String(row.case_code || "").trim();
      const empresa = String(row.empresa || "").trim();
      const fechaCaso = String(row.fecha_caso || "").trim();
      const clienteNombre = String(row.cliente_nombre || "").trim();
      const clienteDocumento = String(row.cliente_documento || "").trim();
      const entidad = String(row.entidad || "").trim();
      const tipoReclamo = String(row.tipo_reclamo || "").trim();
      const descripcion = String(row.descripcion || "").trim();
      const monto = String(row.monto || "").trim();
      const moneda = String(row.moneda || "").trim().toUpperCase();
      const canalOrigen = String(row.canal_origen || "").trim();
      const estado = String(row.estado || "").trim();
      const prioridad = String(row.prioridad || "").trim();
      const observaciones = String(row.observaciones_internas || "").trim();

      if (!caseCode || !fechaCaso || !clienteNombre || !entidad || !tipoReclamo || !descripcion || !estado || !prioridad) {
        rejectedRows.push({ line, reason: "Faltan campos obligatorios" });
        return;
      }
      if (!allowedStatus.includes(estado)) {
        rejectedRows.push({ line, reason: "Estado invalido" });
        return;
      }
      if (!allowedPriority.includes(prioridad)) {
        rejectedRows.push({ line, reason: "Prioridad invalida" });
        return;
      }
      const duplicate = get("SELECT id FROM cases WHERE case_code = ? AND enterprise_user_id = ?", [
        caseCode,
        enterpriseUserId
      ]);
      if (duplicate) {
        rejectedRows.push({ line, reason: "Codigo de caso duplicado para esa empresa" });
        return;
      }

      const caseId = randomUUID();
      run(
        `INSERT INTO cases (
          id, user_id, categoria, detalle, estado, nombre_completo, dni_cuit, entidad,
          monto_valor, monto_moneda, relato, autorizacion, case_code, empresa, prioridad,
          fecha_caso, canal_origen, enterprise_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          caseId,
          req.user.sub,
          tipoReclamo,
          descripcion,
          estado,
          clienteNombre,
          clienteDocumento || null,
          entidad,
          monto || null,
          moneda || null,
          descripcion,
          0,
          caseCode,
          empresa || enterpriseUser.email,
          prioridad,
          fechaCaso,
          canalOrigen || null,
          enterpriseUserId
        ]
      );

      run("INSERT INTO case_updates (id, case_id, author_id, mensaje, estado, prioridad) VALUES (?, ?, ?, ?, ?, ?)", [
        randomUUID(),
        caseId,
        req.user.sub,
        observaciones || "Caso importado masivamente por RFA.",
        estado,
        prioridad
      ]);
      importedRows.push({ line, case_code: caseCode });
    });

    importedCount = importedRows.length;
    rejectedCount = rejectedRows.length;

    return res.status(201).json({
      total: rows.length,
      imported: importedRows.length,
      rejected: rejectedRows.length,
      rejectedRows
    });
  } catch (err) {
    importedFailed = true;
    console.error("IMPORT CASES ERR:", err.message);
    return res.status(500).json({ error: "Error al importar casos masivos" });
  } finally {
    try {
      logSecurityEvent(req, {
        userId: req.user?.sub || null,
        eventType: "case_import",
        resourceType: "enterprise",
        resourceId: String(req.body?.enterprise_user_id || ""),
        success: !importedFailed && (importedCount > 0 || rejectedCount > 0),
        details: {
          imported: importedCount,
          rejected: rejectedCount
        }
      });
    } catch (_e) {
      // noop
    }
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

// Alias antiguos por compatibilidad
app.get("/api/casos", (req, res) => res.redirect(307, "/api/cases"));
app.post("/api/casos", (req, res) => res.redirect(307, "/api/cases"));

app.use((err, _req, res, next) => {
  if (!err) return next();
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "Adjunto demasiado grande (maximo 25MB por archivo)" });
    }
    return res.status(400).json({ error: "Error de carga de archivos" });
  }
  if (String(err.message || "").includes("CORS")) {
    return res.status(403).json({ error: "Origen no permitido" });
  }
  return res.status(500).json({ error: "Error interno del servidor" });
});

initSqlJs({ locateFile: (file) => path.join(__dirname, "node_modules", "sql.js", "dist", file) })
  .then((SQL) => {
    if (fs.existsSync(DB_PATH)) {
      const filebuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(new Uint8Array(filebuffer));
    } else {
      db = new SQL.Database();
    }
    // Recuperacion simple ante corte durante persistencia atomica.
    try {
      const bakPath = `${DB_PATH}.bak`;
      if (!fs.existsSync(DB_PATH) && fs.existsSync(bakPath)) {
        fs.renameSync(bakPath, DB_PATH);
      }
      const tmpPath = `${DB_PATH}.tmp`;
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      // Si existe .bak y DB existe, limpiamos el backup viejo.
      if (fs.existsSync(DB_PATH) && fs.existsSync(bakPath)) fs.unlinkSync(bakPath);
    } catch (err) {
      console.warn("DB RECOVERY WARN:", err.message);
    }
    initDb();
    ensureAdminAccounts();
    if (!CAN_SEND_AUTOMATIC_EMAIL) {
      console.warn("AUTH WARN: envio automatico de email desactivado.");
    }
    try {
      const firstPurge = purgeExpiredClosedCases();
      console.log("PURGE INIT:", JSON.stringify(firstPurge));
    } catch (err) {
      console.error("PURGE INIT ERR:", err.message);
    }
    const purgeIntervalMs = DATA_PURGE_INTERVAL_HOURS * 60 * 60 * 1000;
    setInterval(() => {
      try {
        const result = purgeExpiredClosedCases();
        if (result.deletedUserCases > 0 || result.deletedEnterpriseCases > 0) {
          console.log("PURGE RUN:", JSON.stringify(result));
        }
      } catch (err) {
        console.error("PURGE RUN ERR:", err.message);
      }
    }, purgeIntervalMs);
    server = app.listen(PORT, () => {
      console.log(`Servidor corriendo en el puerto ${PORT}`);
    });

    const shutdown = (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`SHUTDOWN: ${signal}`);
      try {
        if (flushTimer) clearTimeout(flushTimer);
      } catch (_e) {}
      try {
        flushPersistDb();
      } catch (_e) {}
      if (server) {
        server.close(() => {
          process.exit(0);
        });
        // hard-exit if close hangs
        setTimeout(() => process.exit(0), 8000).unref();
      } else {
        process.exit(0);
      }
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  })
  .catch((err) => {
    console.error("DB INIT ERR:", err.message);
    process.exit(1);
  });
