const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const os = require("os");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;
const isVercel = Boolean(process.env.VERCEL);

// On Vercel serverless functions, the root filesystem is read-only except for os.tmpdir() (/tmp)
const dataDir = isVercel ? path.join(os.tmpdir(), "dosje-data") : path.join(__dirname, "data");
const uploadDir = path.join(dataDir, "uploads");
const dbFile = path.join(dataDir, "dosje-store.json");

try {
  fs.mkdirSync(uploadDir, { recursive: true });
} catch (e) {
  console.warn("Storage directory notice:", e.message);
}

const initialData = {
  users: [
    { id: 1, name: "Department Administrator", email: "admin@dosje.gov.in", password: "admin123", role: "Department Official", mobile: "" },
    { id: 2, name: "PMU Officer", email: "pmu@dosje.gov.in", password: "pmu123", role: "PMU Team", mobile: "" }
  ],
  projects: [
    { id: 1, name: "Asha Rehabilitation Centre", scheme: "Scheme A", state: "Tamil Nadu", district: "Tiruvallur", status: "Active", beneficiaries: 148, cctv_status: "Live", risk_score: 21, last_inspection: "2026-09-18" },
    { id: 2, name: "Saksham Support Institute", scheme: "Scheme B", state: "Karnataka", district: "Bengaluru Urban", status: "Active", beneficiaries: 96, cctv_status: "Live", risk_score: 46, last_inspection: "2026-09-12" },
    { id: 3, name: "Ujjwal Community Home", scheme: "Scheme C", state: "Kerala", district: "Ernakulam", status: "Review", beneficiaries: 72, cctv_status: "Offline", risk_score: 73, last_inspection: "2026-08-29" },
    { id: 4, name: "Navjeevan NGO Centre", scheme: "Scheme A", state: "Telangana", district: "Hyderabad", status: "Active", beneficiaries: 121, cctv_status: "Live", risk_score: 18, last_inspection: "2026-09-19" },
    { id: 5, name: "Pragati Welfare Institute", scheme: "Scheme D", state: "Maharashtra", district: "Pune", status: "Active", beneficiaries: 184, cctv_status: "Live", risk_score: 55, last_inspection: "2026-09-08" },
    { id: 6, name: "Sahara Outreach Centre", scheme: "Scheme B", state: "Delhi", district: "South Delhi", status: "Active", beneficiaries: 88, cctv_status: "Live", risk_score: 31, last_inspection: "2026-09-15" }
  ],
  inspections: [],
  alerts: [
    { id: 1, project_id: 3, severity: "CRITICAL", title: "CCTV offline", message: "Camera heartbeat has not been received from Ujjwal Community Home.", created_at: new Date().toISOString(), resolved: 0 },
    { id: 2, project_id: 5, severity: "HIGH", title: "Attendance anomaly", message: "Attendance variance crossed the configured threshold.", created_at: new Date().toISOString(), resolved: 0 },
    { id: 3, project_id: 2, severity: "MEDIUM", title: "Inspection due", message: "Project has entered the random inspection queue.", created_at: new Date().toISOString(), resolved: 0 }
  ],
  attendance: []
};

function loadStore() {
  try {
    if (fs.existsSync(dbFile)) {
      const parsed = JSON.parse(fs.readFileSync(dbFile, "utf8"));
      return { ...initialData, ...parsed };
    }
  } catch (e) {
    console.warn("Notice reading store file:", e.message);
  }
  saveStore(initialData);
  return JSON.parse(JSON.stringify(initialData));
}

function saveStore(data) {
  try {
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.warn("Notice saving store file:", e.message);
  }
}

const db = loadStore();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadDir));
app.use(express.static(path.join(__dirname, "public")));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname || "evidence.jpg"}`)
});
const upload = multer({ storage });
const now = () => new Date().toISOString();

// Root route fallback
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Authentication endpoints
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const user = db.users.find(u => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  const { password: _, ...safeUser } = user;
  res.json({ user: safeUser });
});

app.post("/api/register", (req, res) => {
  const { name, email, password, role, mobile } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "All required fields must be completed" });
  }
  if (db.users.some(u => u.email === email)) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }
  const id = db.users.length ? Math.max(...db.users.map(u => u.id)) + 1 : 1;
  const newUser = { id, name, email, password, role, mobile: mobile || "" };
  db.users.push(newUser);
  saveStore(db);
  const { password: _, ...safeUser } = newUser;
  res.json({ user: safeUser });
});

// Dashboard metrics & alerts
app.get("/api/dashboard", (req, res) => {
  const projects = [...db.projects].sort((a, b) => b.risk_score - a.risk_score);
  const alerts = db.alerts
    .filter(a => !a.resolved)
    .sort((a, b) => b.id - a.id)
    .map(a => {
      const p = db.projects.find(proj => proj.id === a.project_id);
      return { ...a, project_name: p ? p.name : "System" };
    });

  const total = projects.length;
  const active = projects.filter(x => x.status === "Active").length;
  const live = projects.filter(x => x.cctv_status === "Live").length;
  const avgRisk = Math.round(projects.reduce((s, x) => s + x.risk_score, 0) / (total || 1));
  const pending = db.inspections.filter(x => x.status !== "Completed").length || 3;

  res.json({
    metrics: { total, active, live, pending, avgRisk },
    projects,
    alerts
  });
});

// Inspections
app.get("/api/inspections", (req, res) => {
  const list = [...db.inspections]
    .sort((a, b) => b.id - a.id)
    .map(i => {
      const p = db.projects.find(proj => proj.id === i.project_id);
      return { ...i, project_name: p ? p.name : "Unknown Project" };
    });
  res.json(list);
});

app.post("/api/inspections/assign-random", (req, res) => {
  const p = db.projects[Math.floor(Math.random() * db.projects.length)];
  const eligible = db.users.filter(u => u.role && (u.role.includes("PMU") || u.role.includes("Inspection")));
  const officer = eligible.length ? eligible[Math.floor(Math.random() * eligible.length)].name : "Inspection Officer";
  const id = db.inspections.length ? Math.max(...db.inspections.map(i => i.id)) + 1 : 1;
  const newInspection = {
    id,
    project_id: p.id,
    officer,
    assigned_at: now(),
    status: "Assigned"
  };
  db.inspections.push(newInspection);
  saveStore(db);
  res.json({ id, officer, project: p });
});

app.post("/api/inspections", upload.single("evidence"), (req, res) => {
  const id = db.inspections.length ? Math.max(...db.inspections.map(i => i.id)) + 1 : 1;
  const newInspection = {
    id,
    project_id: Number(req.body.project_id),
    officer: req.body.officer,
    assigned_at: now(),
    status: "Completed",
    latitude: req.body.latitude ? Number(req.body.latitude) : null,
    longitude: req.body.longitude ? Number(req.body.longitude) : null,
    findings: req.body.findings || "",
    evidence: req.file ? "/uploads/" + req.file.filename : null,
    score: req.body.score ? Number(req.body.score) : null
  };
  db.inspections.push(newInspection);
  saveStore(db);
  res.json({ id });
});

// Alerts resolution
app.post("/api/alerts/:id/resolve", (req, res) => {
  const targetId = Number(req.params.id);
  const alert = db.alerts.find(a => a.id === targetId);
  if (alert) {
    alert.resolved = 1;
    saveStore(db);
  }
  res.json({ ok: true });
});

// Projects CRUD
app.get("/api/projects", (req, res) => {
  res.json(db.projects);
});

app.post("/api/projects", (req, res) => {
  const { name, scheme, state, district, beneficiaries, cctv_status, risk_score } = req.body;
  if (!name || !scheme || !state || !district) {
    return res.status(400).json({ error: "Name, scheme, state, and district are required" });
  }
  const id = db.projects.length ? Math.max(...db.projects.map(p => p.id)) + 1 : 1;
  const newProject = {
    id,
    name,
    scheme: scheme || "Scheme A",
    state,
    district,
    status: req.body.status || "Active",
    beneficiaries: Number(beneficiaries) || 50,
    cctv_status: cctv_status || "Live",
    risk_score: Number(risk_score) || 20,
    last_inspection: new Date().toISOString().split("T")[0]
  };
  db.projects.push(newProject);
  saveStore(db);
  res.status(201).json(newProject);
});

app.put("/api/projects/:id", (req, res) => {
  const id = Number(req.params.id);
  const pIndex = db.projects.findIndex(p => p.id === id);
  if (pIndex === -1) return res.status(404).json({ error: "Project not found" });

  const current = db.projects[pIndex];
  db.projects[pIndex] = {
    ...current,
    ...req.body,
    id: current.id,
    beneficiaries: req.body.beneficiaries !== undefined ? Number(req.body.beneficiaries) : current.beneficiaries,
    risk_score: req.body.risk_score !== undefined ? Number(req.body.risk_score) : current.risk_score
  };
  saveStore(db);
  res.json(db.projects[pIndex]);
});

app.delete("/api/projects/:id", (req, res) => {
  const id = Number(req.params.id);
  const pIndex = db.projects.findIndex(p => p.id === id);
  if (pIndex === -1) return res.status(404).json({ error: "Project not found" });
  
  const removed = db.projects.splice(pIndex, 1)[0];
  // Remove related alerts or inspections optionally
  saveStore(db);
  res.json({ ok: true, removed });
});

// Trigger or simulate new alert
app.post("/api/alerts", (req, res) => {
  const { project_id, severity, title, message } = req.body;
  const id = db.alerts.length ? Math.max(...db.alerts.map(a => a.id)) + 1 : 1;
  const newAlert = {
    id,
    project_id: project_id ? Number(project_id) : (db.projects[0] ? db.projects[0].id : null),
    severity: severity || "MEDIUM",
    title: title || "Automated Anomaly",
    message: message || "Flagged by automated monitoring.",
    created_at: now(),
    resolved: 0
  };
  db.alerts.unshift(newAlert);
  saveStore(db);
  res.status(201).json(newAlert);
});

// Record VC Verification session
app.post("/api/vc/session", (req, res) => {
  const { project_id, officer, checklist, notes } = req.body;
  const id = db.inspections.length ? Math.max(...db.inspections.map(i => i.id)) + 1 : 1;
  const newInspection = {
    id,
    project_id: Number(project_id) || (db.projects[0] ? db.projects[0].id : 1),
    officer: officer || "Verification Officer",
    assigned_at: now(),
    status: "Completed",
    latitude: 13.0827,
    longitude: 80.2707,
    findings: `[Video Verification Session] Verified: ${checklist ? checklist.join(", ") : "All parameters"}. Notes: ${notes || "Verification conducted via live video conference."}`,
    evidence: null,
    score: 95
  };
  db.inspections.push(newInspection);
  saveStore(db);
  res.json({ ok: true, inspection: newInspection });
});

// Generate dynamic report data
app.get("/api/reports/:type", (req, res) => {
  const { type } = req.params;
  const summary = {
    generated_at: now(),
    total_projects: db.projects.length,
    active_projects: db.projects.filter(p => p.status === "Active").length,
    live_cctv: db.projects.filter(p => p.cctv_status === "Live").length,
    average_risk: Math.round(db.projects.reduce((s, p) => s + p.risk_score, 0) / (db.projects.length || 1)),
    total_inspections: db.inspections.length,
    completed_inspections: db.inspections.filter(i => i.status === "Completed").length,
    unresolved_alerts: db.alerts.filter(a => !a.resolved).length,
    projects: db.projects,
    inspections: db.inspections.map(i => {
      const p = db.projects.find(x => x.id === i.project_id);
      return { ...i, project_name: p ? p.name : "Unknown" };
    }),
    alerts: db.alerts.filter(a => !a.resolved).map(a => {
      const p = db.projects.find(x => x.id === a.project_id);
      return { ...a, project_name: p ? p.name : "System" };
    })
  };
  res.json(summary);
});

// Only listen when running standalone directly (not when required by Vercel serverless function)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`DoSJE Nexus running on http://localhost:${PORT}`);
  });
}

module.exports = app;