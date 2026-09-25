const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;
const dataDir = path.join(__dirname, "data");
const uploadDir = path.join(dataDir, "uploads");
const dbFile = path.join(dataDir, "dosje-store.json");

fs.mkdirSync(uploadDir, { recursive: true });

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
  if (fs.existsSync(dbFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(dbFile, "utf8"));
      return { ...initialData, ...parsed };
    } catch (e) {
      console.error("Failed to parse store file, resetting to initial", e);
    }
  }
  saveStore(initialData);
  return JSON.parse(JSON.stringify(initialData));
}

function saveStore(data) {
  try {
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error("Failed to save store file", e);
  }
}

const db = loadStore();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadDir));
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({ dest: uploadDir });
const now = () => new Date().toISOString();

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

app.post("/api/alerts/:id/resolve", (req, res) => {
  const targetId = Number(req.params.id);
  const alert = db.alerts.find(a => a.id === targetId);
  if (alert) {
    alert.resolved = 1;
    saveStore(db);
  }
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`DoSJE Nexus running on http://localhost:${PORT}`);
});