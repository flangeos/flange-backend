require('dotenv').config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

const db = new sqlite3.Database("./flanges.db", (err) => {
  if (err) return console.error("Database connection error:", err.message);
  console.log("Connected to SQLite database.");
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      password TEXT,
      role TEXT,
      name TEXT,
      company TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS flanges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flangeId TEXT,
      tag TEXT,
      isometric TEXT,
      pid TEXT,
      rating TEXT,
      type TEXT,
      gasket TEXT,
      material TEXT,
      size TEXT,
      boltSize TEXT,
      kFactor TEXT,
      yieldStrength TEXT,
      torque TEXT,
      workpackId INTEGER,
      comments TEXT,
      status TEXT,
      system TEXT,
      facility TEXT,
      workpackName TEXT,
      torqueortension TEXT,
      equipmentManufacturer TEXT,
      equipmentQuantity TEXT,
      wrenchSize TEXT,
      toolcerts TEXT,
      studSpec TEXT,
      nutSpec TEXT,
      nutSize TEXT,
      washer TEXT,
      lubricant TEXT,
      Pass1 TEXT,
      Pass2 TEXT,
      Pass3 TEXT,
      roundpass TEXT,
      finalpass TEXT,
      breakoutName TEXT, breakoutSignature TEXT, breakoutDate TEXT, breakoutCompany TEXT, breakoutNotes TEXT,
      assembledName TEXT, assembledSignature TEXT, assembledDate TEXT, assembledCompany TEXT, assembledNotes TEXT,
      tightenedName TEXT, tightenedSignature TEXT, tightenedDate TEXT, tightenedCompany TEXT, tightenedNotes TEXT,
      qcName TEXT, qcSignature TEXT, qcDate TEXT, qcCompany TEXT, qcNotes TEXT,
      clientName TEXT, clientSignature TEXT, clientDate TEXT, clientCompany TEXT, clientNotes TEXT,
      FOREIGN KEY(workpackId) REFERENCES workpacks(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      customerId INTEGER,
      FOREIGN KEY(customerId) REFERENCES customers(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      assetId INTEGER,
      FOREIGN KEY(assetId) REFERENCES assets(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS workpacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      projectId INTEGER,
      FOREIGN KEY(projectId) REFERENCES projects(id)
    )
  `);
});

// Force-create/reset admin user
app.get("/api/force-admin", async (req, res) => {
  const email = "jose.rodriguez@independentos.com";
  const plainPassword = "mighty85";
  const hashedPassword = bcrypt.hashSync(plainPassword, 10);
  const role = "admin";

  const stmt = db.prepare(`INSERT OR REPLACE INTO users (email, password, role, company, name) VALUES (?, ?, ?, ?, ?)`);
  stmt.run(email, hashedPassword, role, "IOS", "Jose Rodriguez", function (err) {
    if (err) return res.status(500).send("Insert failed: " + err.message);
    res.send("Admin reset successfully. You can now log in with email and password.");
  });
});

// Register
app.post("/api/register", (req, res) => {
  const { email, password, role, company, name } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run(
    `INSERT INTO users (email, password, role, company, name) VALUES (?, ?, ?, ?, ?)`,
    [email, hashedPassword, role, company, name],
    function (err) {
      if (err) return res.status(400).json({ message: "User already exists." });
      res.status(201).json({ message: "User created." });
    }
  );
});

// Login
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  db.get(
    `SELECT email, role, company, name, password FROM users WHERE email = ?`,
    [email],
    (err, row) => {
      if (err) return res.status(500).json({ message: "Server error" });

      if (!row || !bcrypt.compareSync(password, row.password)) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      res.json({
        email: row.email,
        role: row.role,
        name: row.name,
        company: row.company
      });
    }
  );
});

// Get all users
app.get("/api/users", (req, res) => {
  db.all(`SELECT email, role, company FROM users`, [], (err, rows) => {
    if (err) return res.status(500).json({ message: "Failed to get users." });
    res.json(rows);
  });
});

// Delete user
app.delete("/api/users/:email", (req, res) => {
  const { email } = req.params;
  db.run(`DELETE FROM users WHERE email = ?`, [email], function (err) {
    if (err) return res.status(500).json({ message: "Failed to delete user." });
    res.json({ message: "User deleted." });
  });
});

// Add flange
app.post("/api/flanges", (req, res) => {
  console.log("Received flange POST:", req.body);
  const {
    tag, size, isometric, pid, rating, type, gasket,
    boltSize, material, kFactor, yieldStrength,
    torque, workpackId,
    comments, status
  } = req.body;

  const sql = `
    INSERT INTO flanges (
      flangeId, tag, isometric, pid, rating, type, gasket,
      material, size, boltSize, kFactor, yieldStrength, torque,
      workpackId, comments, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    req.body.flangeId, tag, req.body.isometric, req.body.pid, rating, type, gasket,
    material, size, boltSize, kFactor, yieldStrength, torque,
    workpackId, comments, status
  ];
  db.run(sql, values, function (err) {
    if (err) {
      console.error("DB INSERT ERROR:", err);
      return res.status(500).json({ message: "Failed to insert flange." });
    }
    res.json({ id: this.lastID });
  });
});

app.put("/api/flanges/:id", (req, res) => {
  const { id } = req.params;
  const {
    flangeId, tag, isometric, pid, rating, type, gasket,
    material, size, boltSize, kFactor, yieldStrength, torque,
    comments, status, workpackId
  } = req.body;

  const sql = `
    UPDATE flanges SET
      flangeId = ?, tag = ?, isometric = ?, pid = ?, rating = ?, type = ?, gasket = ?,
      material = ?, size = ?, boltSize = ?, kFactor = ?, yieldStrength = ?, torque = ?,
      comments = ?, status = ?, workpackId = ?
    WHERE id = ?
  `;

  const values = [
    flangeId, tag, isometric, pid, rating, type, gasket,
    material, size, boltSize, kFactor, yieldStrength, torque,
    comments, status, workpackId, id
  ];

  db.run(sql, values, function (err) {
    if (err) {
      console.error("Flange update error:", err.message);
      return res.status(500).json({ message: "Failed to update flange." });
    }
    res.json({ message: "Flange updated." });
  });
});

app.put("/api/flanges/:id/details", (req, res) => {
  const id = req.params.id;
  const {
    flangeId, tag, system, pid, isometric, facility, workpackName,
    torqueortension, equipmentManufacturer, equipmentQuantity, wrenchSize, toolcerts,
    size, type, rating, gasket, studSpec, boltSize, nutSpec, nutSize, washer, lubricant, torque,
    Pass1, Pass2, Pass3, roundpass, finalpass,
    breakoutName, breakoutSignature, breakoutDate, breakoutCompany, breakoutNotes,
    assembledName, assembledSignature, assembledDate, assembledCompany, assembledNotes,
    tightenedName, tightenedSignature, tightenedDate, tightenedCompany, tightenedNotes,
    qcName, qcSignature, qcDate, qcCompany, qcNotes,
    clientName, clientSignature, clientDate, clientCompany, clientNotes,
    status
  } = req.body;

  db.run(
    `UPDATE flanges SET
      flangeId=?, tag=?, system=?, pid=?, isometric=?, facility=?, workpackName=?,
      torqueortension=?, equipmentManufacturer=?, equipmentQuantity=?, wrenchSize=?, toolcerts=?,
      size=?, type=?, rating=?, gasket=?, studSpec=?, boltSize=?, nutSpec=?, nutSize=?, washer=?, lubricant=?, torque=?,
      Pass1=?, Pass2=?, Pass3=?, roundpass=?, finalpass=?,
      breakoutName=?, breakoutSignature=?, breakoutDate=?, breakoutCompany=?, breakoutNotes=?,
      assembledName=?, assembledSignature=?, assembledDate=?, assembledCompany=?, assembledNotes=?,
      tightenedName=?, tightenedSignature=?, tightenedDate=?, tightenedCompany=?, tightenedNotes=?,
      qcName=?, qcSignature=?, qcDate=?, qcCompany=?, qcNotes=?,
      clientName=?, clientSignature=?, clientDate=?, clientCompany=?, clientNotes=?,
      status=?
     WHERE id=?`,
    [
      flangeId, tag, system, pid, isometric, facility, workpackName,
      torqueortension, equipmentManufacturer, equipmentQuantity, wrenchSize, toolcerts,
      size, type, rating, gasket, studSpec, boltSize, nutSpec, nutSize, washer, lubricant, torque,
      Pass1, Pass2, Pass3, roundpass, finalpass,
      breakoutName, breakoutSignature, breakoutDate, breakoutCompany, breakoutNotes,
      assembledName, assembledSignature, assembledDate, assembledCompany, assembledNotes,
      tightenedName, tightenedSignature, tightenedDate, tightenedCompany, tightenedNotes,
      qcName, qcSignature, qcDate, qcCompany, qcNotes,
      clientName, clientSignature, clientDate, clientCompany, clientNotes,
      status,
      id
    ],
    (err) => {
      if (err) {
        console.error("Update error:", err);
        return res.status(500).json({ error: "Failed to update flange details" });
      }
      res.json({ success: true });
    }
  );
});

// Get all flanges by project
app.get("/api/flanges/by-project", (req, res) => {
  const { projectId } = req.query;
  if (!projectId) return res.status(400).json({ message: "Missing projectId" });

  const sql = `
    SELECT f.*, w.name AS workpackName
    FROM flanges f
    JOIN workpacks w ON f.workpackId = w.id
    WHERE w.projectId = ?
  `;

  db.all(sql, [projectId], (err, rows) => {
    if (err) {
      console.error("DB error fetching flanges by project:", err.message);
      return res.status(500).json({ message: "DB error", error: err.message });
    }
    console.log(`Flanges fetched for projectId ${projectId}:`, rows.length);
    res.json(rows);
  });
});

app.get("/api/flanges/:id", (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT f.*, w.name AS workpackName
    FROM flanges f
    LEFT JOIN workpacks w ON f.workpackId = w.id
    WHERE f.id = ?
  `;
  db.get(sql, [id], (err, row) => {
    if (err) {
      console.error("Failed to fetch flange:", err.message);
      return res.status(500).json({ message: "Error fetching flange." });
    }
    res.json(row);
  });
});

// Get all flanges (unfiltered)
app.get("/api/flanges/all", (req, res) => {
  const sql = `
    SELECT f.*, w.name AS workpackName
    FROM flanges f
    LEFT JOIN workpacks w ON f.workpackId = w.id
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ message: "Failed to get all flanges." });
    res.json(rows);
  });
});

// Get flanges by workpackId
app.get("/api/flanges", (req, res) => {
  const { workpackId } = req.query;
  console.log("📦 Request for flanges with workpackId:", workpackId);

  if (!workpackId) {
    return res.status(400).json({ message: "Missing workpackId in query." });
  }

  const sql = `
    SELECT f.*, w.name AS workpackName
    FROM flanges f
    JOIN workpacks w ON f.workpackId = w.id
    WHERE f.workpackId = ?
  `;
  console.log("Executing SQL:", sql, "with workpackId:", workpackId);
  db.all(sql, [workpackId], (err, rows) => {
    if (err) {
      console.error("DB error fetching flanges for workpackId:", workpackId, err.message);
      return res.status(500).json({ message: "Failed to get flanges.", error: err.message });
    }
    console.log(`Flanges fetched for workpackId ${workpackId}:`, rows.length, "rows:", rows);
    res.json(rows);
  });
});

// Delete flange
app.delete("/api/flanges/:id", (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM flanges WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ message: "Failed to delete flange." });
    res.json({ message: "Flange deleted." });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Customer routes
app.get("/api/customers", (_, res) => {
  db.all(`SELECT * FROM customers`, [], (err, rows) => {
    if (err) return res.status(500).json({ message: "Error fetching customers" });
    res.json(rows);
  });
});

app.post("/api/customers", (req, res) => {
  const { name } = req.body;
  db.run(`INSERT INTO customers (name) VALUES (?)`, [name], function (err) {
    if (err) return res.status(500).json({ message: "Error adding customer" });
    res.status(201).json({ id: this.lastID, name });
  });
});

app.delete("/api/customers/:id", (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM customers WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ message: "Failed to delete customer." });
    res.json({ message: "Customer deleted." });
  });
});

// Asset routes
app.get("/api/assets", (req, res) => {
  db.all(`SELECT * FROM assets WHERE customerId = ?`, [req.query.customerId], (err, rows) => {
    if (err) return res.status(500).json({ message: "Error fetching assets" });
    res.json(rows);
  });
});

app.post("/api/assets", (req, res) => {
  const { name, customerId } = req.body;
  db.run(`INSERT INTO assets (name, customerId) VALUES (?, ?)`, [name, customerId], function (err) {
    if (err) return res.status(500).json({ message: "Error adding asset" });
    res.status(201).json({ id: this.lastID, name });
  });
});

app.delete("/api/assets/:id", (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM assets WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ message: "Failed to delete asset." });
    res.json({ message: "Asset deleted." });
  });
});

// Project routes
app.get("/api/projects", (req, res) => {
  db.all(`SELECT * FROM projects WHERE assetId = ?`, [req.query.assetId], (err, rows) => {
    if (err) return res.status(500).json({ message: "Error fetching projects" });
    res.json(rows);
  });
});

app.post("/api/projects", (req, res) => {
  const { name, assetId } = req.body;
  db.run(`INSERT INTO projects (name, assetId) VALUES (?, ?)`, [name, assetId], function (err) {
    if (err) return res.status(500).json({ message: "Error adding project" });
    res.status(201).json({ id: this.lastID, name });
  });
});

app.delete("/api/projects/:id", (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM projects WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ message: "Failed to delete project." });
    res.json({ message: "Project deleted." });
  });
});

// Get all work packs for a given project
app.get("/api/workpacks", (req, res) => {
  db.all(`SELECT * FROM workpacks WHERE projectId = ?`, [req.query.projectId], (err, rows) => {
    if (err) return res.status(500).json({ message: "Error fetching workpacks" });
    res.json(rows);
  });
});

// Create a new work pack
app.post("/api/workpacks", (req, res) => {
  const { name, projectId } = req.body;
  db.run(`INSERT INTO workpacks (name, projectId) VALUES (?, ?)`, [name, projectId], function (err) {
    if (err) return res.status(500).json({ message: "Error adding workpack" });
    res.status(201).json({ id: this.lastID, name });
  });
});

app.delete("/api/workpacks/:id", (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM workpacks WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ message: "Failed to delete work pack." });
    res.json({ message: "Work pack deleted." });
  });
});

app.post("/api/flanges/:id/update-status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const sql = `UPDATE flanges SET status = ? WHERE id = ?`;
  db.run(sql, [status, id], function (err) {
    if (err) {
      console.error("Failed to update status:", err.message);
      return res.status(500).json({ message: "Update failed." });
    }
    res.json({ message: "Status updated." });
  });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `toolcert-${Date.now()}${ext}`;
    cb(null, unique);
  }
});

const upload = multer({ storage });

app.post("/api/upload-toolcert/:flangeId", upload.single("pdf"), (req, res) => {
  const { flangeId } = req.params;

  console.log("UPLOAD ATTEMPT for flangeId:", flangeId);
  console.log("File uploaded:", req.file);

  if (!req.file) return res.status(400).send("No file uploaded.");

  const filePath = `/uploads/${req.file.filename}`;

  db.run(
    `UPDATE flanges SET toolcerts = ? WHERE id = ?`,
    [filePath, flangeId],
    function (err) {
      if (err) {
        console.error("Failed to save toolcert PDF:", err.message);
        return res.status(500).json({ message: "Update failed." });
      }
      console.log("Successfully saved PDF path:", filePath);
      res.json({ message: "PDF uploaded.", filePath });
    }
  );
});

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));