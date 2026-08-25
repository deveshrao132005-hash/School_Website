
require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const initSqlJs = require("sql.js");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-this-password";

const dataDir = path.join(__dirname, "data");
const dbFile = path.join(dataDir, "enquiries.sqlite");
fs.mkdirSync(dataDir, { recursive: true });

let db;

function saveDb() {
  const data = db.export();
  fs.writeFileSync(dbFile, Buffer.from(data));
}

function clean(value, max = 2000) {
  if (value === undefined || value === null) return null;
  return String(value).trim().slice(0, max);
}

function rowsFromQuery(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

(async () => {
  const SQL = await initSqlJs({
    locateFile: file => path.join(__dirname, "node_modules", "sql.js", "dist", file)
  });

  if (fs.existsSync(dbFile)) {
    db = new SQL.Database(fs.readFileSync(dbFile));
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS enquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      parent_name TEXT,
      student_name TEXT,
      class_applying TEXT,
      name TEXT,
      email TEXT,
      phone TEXT,
      subject TEXT,
      message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);
  saveDb();

  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(__dirname));

  app.post("/api/enquiries", (req, res) => {
    const body = req.body || {};
    const type =
      body.type === "admission" ? "admission" :
      body.type === "contact" ? "contact" : null;

    if (!type) return res.status(400).json({ error: "Invalid enquiry type." });

    try {
      if (type === "admission") {
        const parentName = clean(body.parent_name, 150);
        const studentName = clean(body.student_name, 150);
        const phone = clean(body.phone, 30);

        if (!parentName || !studentName || !phone) {
          return res.status(400).json({
            error: "Parent name, student name and phone are required."
          });
        }

        const stmt = db.prepare(`
          INSERT INTO enquiries
          (type, parent_name, student_name, class_applying, phone, message)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        stmt.run([
          type,
          parentName,
          studentName,
          clean(body.class_applying, 50),
          phone,
          clean(body.message)
        ]);
        stmt.free();
      } else {
        const name = clean(body.name, 150);
        const email = clean(body.email, 200);
        const message = clean(body.message);

        if (!name || !email || !message) {
          return res.status(400).json({
            error: "Name, email and message are required."
          });
        }

        const stmt = db.prepare(`
          INSERT INTO enquiries
          (type, name, email, phone, subject, message)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        stmt.run([
          type,
          name,
          email,
          clean(body.phone, 30),
          clean(body.subject, 200),
          message
        ]);
        stmt.free();
      }

      saveDb();
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not save the enquiry." });
    }
  });

  function adminAuth(req, res, next) {
    const supplied = req.get("x-admin-password") || req.query.password;
    if (supplied !== ADMIN_PASSWORD) {
      return res.status(401).json({
        error: "Unauthorized. Enter the correct admin password."
      });
    }
    next();
  }

  app.get("/api/enquiries", adminAuth, (req, res) => {
    try {
      const rows = rowsFromQuery(
        "SELECT * FROM enquiries ORDER BY id DESC"
      );
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not read enquiries." });
    }
  });

  app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "admin.html"));
  });

  app.use((req, res) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ error: "API route not found." });
    }
    res.sendFile(path.join(__dirname, "index.html"));
  });

  app.listen(PORT, () => {
    console.log(`RBS Public School website running at http://localhost:${PORT}`);
    console.log(`Admin dashboard: http://localhost:${PORT}/admin`);
    console.log(`SQL database: ${dbFile}`);
  });
})().catch(err => {
  console.error("Could not start server:", err);
  process.exit(1);
});
