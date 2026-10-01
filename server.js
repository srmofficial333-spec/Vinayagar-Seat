require("dotenv").config();

const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const bcrypt = require("bcrypt");
const mysql = require("mysql2/promise");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

const uploadDir = path.join(__dirname, "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 8
  }
}));

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(uploadDir, {
  index: false,
  dotfiles: "deny"
}));

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, safe);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("Only JPG, PNG or WEBP images are allowed"), ok);
  }
});

function adminOnly(req, res, next) {
  if (!req.session.adminId) {
    return res.status(401).json({ error: "Admin login required" });
  }
  next();
}

app.post("/api/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const [rows] = await pool.query(
      "SELECT * FROM admin_users WHERE username = ? LIMIT 1", [username]
    );

    if (!rows.length) return res.status(401).json({ error: "Invalid login" });

    const ok = await bcrypt.compare(password, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid login" });

    req.session.adminId = rows[0].id;
    req.session.adminUsername = rows[0].username;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Login failed" });
  }
});

app.post("/api/admin/logout", adminOnly, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/admin/me", (req, res) => {
  res.json({
    loggedIn: Boolean(req.session.adminId),
    username: req.session.adminUsername || null
  });
});

app.get("/api/admin/members", adminOnly, async (req, res) => {
  const [rows] = await pool.query(`
    SELECT m.id, m.name, m.mobile,
           COALESCE(SUM(p.amount),0) AS total_paid,
           COUNT(p.id) AS payment_count
    FROM members m
    LEFT JOIN payments p ON p.member_id = m.id
    GROUP BY m.id
    ORDER BY m.name
  `);
  res.json(rows);
});

app.get("/api/admin/members/:id/payments", adminOnly, async (req, res) => {
  const [rows] = await pool.query(`
    SELECT p.*, m.name AS member_name, m.mobile
    FROM payments p
    JOIN members m ON m.id = p.member_id
    WHERE p.member_id = ?
    ORDER BY p.payment_date DESC, p.payment_time DESC, p.id DESC
  `, [req.params.id]);
  res.json(rows);
});

app.post("/api/admin/payments", adminOnly, upload.single("screenshot"), async (req, res) => {
  const {
    member_id, amount, payment_date, payment_time, payment_method,
    transaction_id, google_transaction_id, sender_name, sender_upi,
    receiver_name, receiver_upi, bank_name
  } = req.body;

  if (!member_id || !amount || !payment_date || !payment_time || !payment_method) {
    return res.status(400).json({ error: "Member, amount, date, time and payment method are required" });
  }

  if (!["Online", "Cash"].includes(payment_method)) {
    return res.status(400).json({ error: "Invalid payment method" });
  }

  const [members] = await pool.query("SELECT * FROM members WHERE id = ?", [member_id]);
  if (!members.length) return res.status(404).json({ error: "Member not found" });

  const member = members[0];
  const d = payment_date.replaceAll("-", "");
  const shortName = member.name.replace(/\s+/g, "").slice(0, 6).toUpperCase();
  const billNo = `VS-${d}-${shortName}-${Date.now().toString().slice(-5)}`;
  const screenshotPath = req.file ? `/uploads/${req.file.filename}` : null;

  const [result] = await pool.query(`
    INSERT INTO payments
    (member_id, amount, payment_date, payment_time, payment_method,
     transaction_id, google_transaction_id, sender_name, sender_upi,
     receiver_name, receiver_upi, bank_name, bill_no, screenshot_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    member_id, amount, payment_date, payment_time, payment_method,
    transaction_id || null, google_transaction_id || null,
    sender_name || null, sender_upi || null,
    receiver_name || null, receiver_upi || null,
    bank_name || null, billNo, screenshotPath
  ]);

  res.json({ ok: true, id: result.insertId, bill_no: billNo });
});

app.delete("/api/admin/payments/:id", adminOnly, async (req, res) => {
  const [rows] = await pool.query("SELECT screenshot_path FROM payments WHERE id = ?", [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: "Payment not found" });

  const p = rows[0];
  if (p.screenshot_path) {
    const file = path.join(__dirname, p.screenshot_path.replace("/uploads/", "uploads/"));
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }

  await pool.query("DELETE FROM payments WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

/* Public/member APIs: read-only. No payment creation is exposed here. */
app.get("/api/members", async (req, res) => {
  const [rows] = await pool.query(`
    SELECT id, name, mobile FROM members ORDER BY name
  `);
  res.json(rows);
});

app.get("/api/members/:id", async (req, res) => {
  const [members] = await pool.query(
    "SELECT id, name, mobile FROM members WHERE id = ?", [req.params.id]
  );
  if (!members.length) return res.status(404).json({ error: "Member not found" });

  const [payments] = await pool.query(`
    SELECT id, amount, payment_date, payment_time, payment_method,
           transaction_id, google_transaction_id, sender_name, sender_upi,
           receiver_name, receiver_upi, bank_name, bill_no, screenshot_path
    FROM payments
    WHERE member_id = ?
    ORDER BY payment_date DESC, payment_time DESC, id DESC
  `, [req.params.id]);

  res.json({ member: members[0], payments });
});

app.get("/api/payments/:id", async (req, res) => {
  const [rows] = await pool.query(`
    SELECT p.*, m.name AS member_name, m.mobile
    FROM payments p
    JOIN members m ON m.id = p.member_id
    WHERE p.id = ?
  `, [req.params.id]);

  if (!rows.length) return res.status(404).json({ error: "Payment not found" });
  res.json(rows[0]);
});

app.get("/api/setup", async (req, res) => {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    return res.status(500).send("Set ADMIN_USERNAME and ADMIN_PASSWORD in .env first.");
  }

  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    "INSERT INTO admin_users (username, password_hash) VALUES (?, ?) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)",
    [username, hash]
  );
  res.send("Admin created/updated. Remove or disable /api/setup after first use.");
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

app.listen(PORT, () => {
  console.log(`Vinayagar Seettu running on http://localhost:${PORT}`);
});
