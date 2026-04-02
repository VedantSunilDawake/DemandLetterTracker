const express = require("express");
const bcrypt = require("bcrypt");
const Database = require("better-sqlite3");
const multer = require("multer");
const path = require("path");

const app = express();
const db = new Database("database.db");

app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

// FILE UPLOAD
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});
const upload = multer({ storage });

// CREATE TABLES
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT,
  password TEXT
);

CREATE TABLE IF NOT EXISTS property (
  id INTEGER PRIMARY KEY,
  userId INTEGER,
  builderName TEXT,
  totalCost REAL
);

CREATE TABLE IF NOT EXISTS demands (
  id INTEGER PRIMARY KEY,
  propertyId INTEGER,
  stage TEXT,
  amount REAL,
  dueDate TEXT,
  status TEXT,
  selfPaid REAL,
  bankPaid REAL,
  file TEXT
);

CREATE TABLE IF NOT EXISTS loan (
  id INTEGER PRIMARY KEY,
  propertyId INTEGER,
  bankName TEXT,
  sanctioned REAL,
  disbursed REAL
);

CREATE TABLE IF NOT EXISTS emi (
  id INTEGER PRIMARY KEY,
  loanId INTEGER,
  date TEXT,
  amount REAL
);
`);

// REGISTER
app.post("/register", async (req, res) => {
  const { email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);

  db.prepare("INSERT INTO users (email, password) VALUES (?, ?)").run(email, hash);
  res.send("Registered");
});

// LOGIN
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = db.prepare("SELECT * FROM users WHERE email=?").get(email);
  if (!user) return res.status(401).send("Invalid");

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).send("Invalid");

  res.json({ userId: user.id });
});

// ADD PROPERTY
app.post("/property", (req, res) => {
  const { totalCost } = req.body;

  // Remove old property (MVP = single property)
  db.prepare("DELETE FROM property").run();

  db.prepare("INSERT INTO property (totalCost) VALUES (?)")
    .run(totalCost);

  res.send("Property Saved");
});

// ADD DEMAND
app.post("/demand", (req, res) => {
  const { propertyId, stage, amount, dueDate, status, selfPaid, bankPaid } = req.body;

  db.prepare(`
    INSERT INTO demands 
    (propertyId, stage, amount, dueDate, status, selfPaid, bankPaid) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(propertyId, stage, amount, dueDate, status, selfPaid, bankPaid);

  res.send("Demand Added");
});

// FILE UPLOAD
app.post("/upload", upload.single("file"), (req, res) => {
  res.json({ file: req.file.filename });
});

// DASHBOARD
app.get("/dashboard", (req, res) => {

  const property = db.prepare("SELECT * FROM property LIMIT 1").get();
  const demands = db.prepare("SELECT * FROM demands").all();

  const flatCost = property ? property.totalCost : 0;

  const selfTotal = demands.reduce((a, d) => a + (d.selfPaid || 0), 0);
  const bankTotal = demands.reduce((a, d) => a + (d.bankPaid || 0), 0);

  const totalDisbursed = selfTotal + bankTotal;
  const remaining = flatCost - totalDisbursed;

  res.json({
    flatCost,
    totalDisbursed,
    remaining,
    selfTotal,
    bankTotal
  });
});

app.listen(process.env.PORT || 3000, () => console.log("Server running"));
