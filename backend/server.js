import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import axios from "axios";
import { parseStringPromise } from "xml2js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import sgMail from "@sendgrid/mail";
import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import multer from "multer";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const CORS_ORIGINS = (process.env.CORS_ORIGINS || "").split(",").map((v) => v.trim()).filter(Boolean);
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "";
const CAN_SEND_EMAIL = Boolean(SENDGRID_API_KEY && EMAIL_FROM);
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";
const SQLITE_PATH = process.env.SQLITE_PATH || "./rfa.db";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, SQLITE_PATH);
const UPLOADS_DIR = path.resolve(__dirname, "uploads");

app.use(cors({
  origin: CORS_ORIGINS.length ? CORS_ORIGINS : "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

let db = null;

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 25 * 1024 * 1024 }
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
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function run(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.run(params);
  stmt.free();
  persistDb();
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
  const userColumns = all("PRAGMA table_info(users)").map((c) => c.name);
  const addUserColumn = (name, type) => {
    if (!userColumns.includes(name)) {
      db.exec(`ALTER TABLE users ADD COLUMN ${name} ${type};`);
    }
  };
  addUserColumn("email_verified", "INTEGER DEFAULT 0");
  addUserColumn("verification_token", "TEXT");
  addUserColumn("verification_sent_at", "TEXT");
  run("UPDATE users SET email_verified = 1 WHERE email_verified IS NULL");
  persistDb();
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidEmail(value) {
  if (!isNonEmptyString(value)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

async function sendStatusEmail({ to, status, message, caseId }) {
  if (!SENDGRID_API_KEY || !EMAIL_FROM || !isValidEmail(to)) return;
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
  if (!SENDGRID_API_KEY || !EMAIL_FROM || !isValidEmail(to) || !token) return;
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
    console.error("EMAIL VERIFY ERR:", err.message);
  }
}

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No autorizado" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
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
  res.json({ emailVerificationEnabled: CAN_SEND_EMAIL });
});

// ---- Noticias RSS (caché 30 min) ----
const FEEDS = [
  "https://news.google.com/rss/search?q=site:ambito.com+OR+site:iprofesional.com+reclamos+financieros&hl=es-419&gl=AR&ceid=AR:es-419",
  "https://news.google.com/rss/search?q=billeteras+digitales+reclamos&hl=es-419&gl=AR&ceid=AR:es-419",
  "https://news.google.com/rss/search?q=BCRA+regulaci%C3%B3n+transferencias&hl=es-419&gl=AR&ceid=AR:es-419"
];

let cache = { data: [], ts: 0 };
const TTL_MS = 1000 * 60 * 30;

async function fetchFeed(url) {
  const { data: xml } = await axios.get(url, { timeout: 12000 });
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
    const results = (await Promise.all(FEEDS.map(fetchFeed))).flat();
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
app.post("/api/enterprise", async (req, res) => {
  try {
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
    } = req.body || {};

    if (!isNonEmptyString(empresa) || !isNonEmptyString(rubro) || !isNonEmptyString(contacto) ||
        !isNonEmptyString(email) || !isNonEmptyString(descripcion) || !isNonEmptyString(volumen)) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Email inválido" });
    }

    const inquiryId = randomUUID();
    run(
      `INSERT INTO enterprise_inquiries (
        id, empresa, rubro, contacto, email, telefono, servicios, descripcion, volumen, comentarios
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        inquiryId,
        empresa.trim(),
        rubro.trim(),
        contacto.trim(),
        email.trim().toLowerCase(),
        telefono || null,
        typeof servicios === "string" ? servicios : JSON.stringify(servicios || []),
        descripcion.trim(),
        volumen.trim(),
        comentarios || null
      ]
    );
    const created = get("SELECT * FROM enterprise_inquiries WHERE id = ?", [inquiryId]);
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ error: "Error al registrar consulta" });
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

// -------------------- AUTH --------------------
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      return res.status(400).json({ error: "Email y contraseña son obligatorios" });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Email inválido" });
    }
    const emailNorm = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 10);
    const role = ADMIN_EMAILS.includes(emailNorm) ? "admin" : "user";
    const verificationToken = randomUUID();
    if (!CAN_SEND_EMAIL) {
      return res.status(503).json({
        error: "Verificacion por email no configurada en el servidor",
        code: "EMAIL_SERVICE_NOT_CONFIGURED"
      });
    }

    const userId = randomUUID();
    run(
      "INSERT INTO users (id, email, password_hash, role, email_verified, verification_token, verification_sent_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
      [userId, emailNorm, passwordHash, role, 0, verificationToken]
    );
    await sendVerificationEmail({ to: emailNorm, token: verificationToken });
    return res.status(201).json({ message: "Registro creado. Verifica tu email para activar la cuenta." });
  } catch (err) {
    if (String(err.message || "").includes("UNIQUE")) {
      return res.status(409).json({ error: "El email ya está registrado" });
    }
    console.error("REGISTER ERR:", err.message);
    return res.status(500).json({ error: "Error al registrar" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      return res.status(400).json({ error: "Email y contraseña son obligatorios" });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Email inválido" });
    }
    const emailNorm = email.trim().toLowerCase();
    let user = get("SELECT id, email, password_hash, role, email_verified FROM users WHERE email = ?", [emailNorm]);
    if (!user) return res.status(401).json({ error: "Credenciales inválidas" });

    if (!user.email_verified) {
      return res.status(403).json({ error: "Email no verificado", code: "EMAIL_NOT_VERIFIED" });
    }
    if (ADMIN_EMAILS.includes(emailNorm) && user.role !== "admin") {
      run("UPDATE users SET role = ? WHERE id = ?", ["admin", user.id]);
      user = { ...user, role: "admin" };
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });

    const token = signToken(user);
    return res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error("LOGIN ERR:", err.message);
    return res.status(500).json({ error: "Error al iniciar sesión" });
  }
});


app.post("/api/auth/resend-verification", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Email inválido" });
    }
    if (!CAN_SEND_EMAIL) {
      return res.status(400).json({ error: "Envio de email no configurado" });
    }
    const emailNorm = email.trim().toLowerCase();
    const user = get("SELECT * FROM users WHERE email = ?", [emailNorm]);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    if (user.email_verified) {
      return res.status(200).json({ message: "El email ya está verificado" });
    }
    const token = randomUUID();
    run("UPDATE users SET verification_token = ?, verification_sent_at = CURRENT_TIMESTAMP WHERE id = ?", [
      token,
      user.id
    ]);
    await sendVerificationEmail({ to: emailNorm, token });
    return res.json({ message: "Te enviamos un nuevo email de verificacion" });
  } catch (err) {
    console.error("RESEND VERIFY ERR:", err.message);
    return res.status(500).json({ error: "No se pudo reenviar la verificacion" });
  }
});

app.get("/api/auth/verify", async (req, res) => {
  try {
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
        return res.status(400).json({ error: "Token vencido. ReenviÃ¡ la verificaciÃ³n." });
      }
    }
    run("UPDATE users SET email_verified = 1, verification_token = NULL WHERE id = ?", [user.id]);
    const authToken = signToken(user);
    return res.json({
      message: "Email verificado correctamente",
      token: authToken,
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error("VERIFY ERR:", err.message);
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
        SELECT c.*, u.email AS user_email
        FROM cases c
        JOIN users u ON u.id = c.user_id
        ORDER BY c.created_at DESC
      `);
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
    const body = req.body || {};
    const {
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
      plan_elegido
    } = body;

    const detalle = relato || body.detalle;
    if (!isNonEmptyString(detalle)) {
      return res.status(400).json({ error: "La descripción del caso es obligatoria" });
    }
    if (email_contacto && !isValidEmail(email_contacto)) {
      return res.status(400).json({ error: "Email de contacto inválido" });
    }

    const files = (req.files || []).map((file) => ({
      originalName: file.originalname,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype
    }));

    const caseId = randomUUID();
    const estadoInicial = "Recibido";
    run(
      `INSERT INTO cases (
        id, user_id, categoria, detalle, estado, nombre_completo, dni_cuit, email_contacto, telefono,
        entidad, tipo_entidad, monto_valor, monto_escala, monto_moneda, medios_pago, relato,
        autorizacion, adjuntos, plan_elegido
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        caseId,
        req.user.sub,
        body.categoria || null,
        detalle.trim(),
        estadoInicial,
        nombre_completo || null,
        dni_cuit || null,
        email_contacto || null,
        telefono || null,
        entidad || null,
        tipo_entidad || null,
        monto_valor || null,
        monto_escala || null,
        monto_moneda || null,
        typeof medios_pago === "string" ? medios_pago : JSON.stringify(medios_pago || []),
        relato || null,
        autorizacion === "true" || autorizacion === true ? 1 : 0,
        files.length ? JSON.stringify(files) : null,
        plan_elegido || null
      ]
    );
    const initialUpdateId = randomUUID();
    run("INSERT INTO case_updates (id, case_id, author_id, mensaje, estado) VALUES (?, ?, ?, ?, ?)", [
      initialUpdateId,
      caseId,
      req.user.sub,
      "Caso cargado por el usuario.",
      estadoInicial
    ]);
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

    if (req.user.role !== "admin" && caso.user_id !== req.user.sub) {
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
    if (req.user.role !== "admin" && caso.user_id !== req.user.sub) {
      return res.status(403).json({ error: "Acceso restringido" });
    }

    const rows = all(
      `
      SELECT cu.*, u.email AS author_email
      FROM case_updates cu
      LEFT JOIN users u ON u.id = cu.author_id
      WHERE cu.case_id = ?
      ORDER BY cu.created_at DESC
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
    if (req.user.role !== "admin" && caso.user_id !== req.user.sub) {
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

app.post("/api/cases/:id/updates", authRequired, adminOnly, async (req, res) => {
  try {
    const { mensaje, estado } = req.body || {};
    if (!isNonEmptyString(mensaje)) {
      return res.status(400).json({ error: "El mensaje es obligatorio" });
    }
    const caso = get("SELECT * FROM cases WHERE id = ?", [req.params.id]);
    if (!caso) return res.status(404).json({ error: "Caso no encontrado" });

    const updateId = randomUUID();
    run("INSERT INTO case_updates (id, case_id, author_id, mensaje, estado) VALUES (?, ?, ?, ?, ?)", [
      updateId,
      req.params.id,
      req.user.sub,
      mensaje.trim(),
      estado || null
    ]);

    const newEstado = estado || caso.estado;
    run("UPDATE cases SET estado = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
      newEstado,
      req.params.id
    ]);
    const createdUpdate = get("SELECT * FROM case_updates WHERE id = ?", [updateId]);
    if (estado && estado !== caso.estado) {
      const owner = get("SELECT email FROM users WHERE id = ?", [caso.user_id]);
      const to = (caso.email_contacto || owner?.email || "").trim();
      await sendStatusEmail({ to, status: newEstado, message: mensaje, caseId: caso.id });
    }
    return res.status(201).json(createdUpdate);
  } catch (err) {
    return res.status(500).json({ error: "Error al crear actualización" });
  }
});

// Alias antiguos por compatibilidad
app.get("/api/casos", (req, res) => res.redirect(307, "/api/cases"));
app.post("/api/casos", (req, res) => res.redirect(307, "/api/cases"));

initSqlJs({ locateFile: (file) => path.join(__dirname, "node_modules", "sql.js", "dist", file) })
  .then((SQL) => {
    if (fs.existsSync(DB_PATH)) {
      const filebuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(new Uint8Array(filebuffer));
    } else {
      db = new SQL.Database();
    }
    initDb();
    if (!CAN_SEND_EMAIL) {
      console.warn("AUTH WARN: verificacion por email desactivada (falta SENDGRID_API_KEY o EMAIL_FROM).");
    }
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en el puerto ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("DB INIT ERR:", err.message);
    process.exit(1);
  });
