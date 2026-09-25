const express=require("express");
const cors=require("cors");
const path=require("path");
const fs=require("fs");
const Database=require("better-sqlite3");
const multer=require("multer");
const app=express(),PORT=process.env.PORT||3000;
const dataDir=path.join(__dirname,"data"),uploadDir=path.join(dataDir,"uploads");
fs.mkdirSync(uploadDir,{recursive:true});
const db=new Database(path.join(dataDir,"dosje.db"));
db.pragma("journal_mode=WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT,mobile TEXT);
CREATE TABLE IF NOT EXISTS projects(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,scheme TEXT,state TEXT,district TEXT,status TEXT,beneficiaries INTEGER,cctv_status TEXT,risk_score INTEGER,last_inspection TEXT);
CREATE TABLE IF NOT EXISTS inspections(id INTEGER PRIMARY KEY AUTOINCREMENT,project_id INTEGER,officer TEXT,assigned_at TEXT,status TEXT,latitude REAL,longitude REAL,findings TEXT,evidence TEXT,score INTEGER);
CREATE TABLE IF NOT EXISTS alerts(id INTEGER PRIMARY KEY AUTOINCREMENT,project_id INTEGER,severity TEXT,title TEXT,message TEXT,created_at TEXT,resolved INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS attendance(id INTEGER PRIMARY KEY AUTOINCREMENT,project_id INTEGER,date TEXT,expected INTEGER,present INTEGER,anomaly_score INTEGER);
`);
if(!db.prepare("SELECT COUNT(*) c FROM users").get().c){
 const u=db.prepare("INSERT INTO users(name,email,password,role,mobile) VALUES(?,?,?,?,?)");
 u.run("Department Administrator","admin@dosje.gov.in","admin123","Department Official","");
 u.run("PMU Officer","pmu@dosje.gov.in","pmu123","PMU Team","");
}
if(!db.prepare("SELECT COUNT(*) c FROM projects").get().c){
 const p=db.prepare("INSERT INTO projects(name,scheme,state,district,status,beneficiaries,cctv_status,risk_score,last_inspection) VALUES(?,?,?,?,?,?,?,?,?)");
 [
 ["Asha Rehabilitation Centre","Scheme A","Tamil Nadu","Tiruvallur","Active",148,"Live",21,"2026-09-18"],
 ["Saksham Support Institute","Scheme B","Karnataka","Bengaluru Urban","Active",96,"Live",46,"2026-09-12"],
 ["Ujjwal Community Home","Scheme C","Kerala","Ernakulam","Review",72,"Offline",73,"2026-08-29"],
 ["Navjeevan NGO Centre","Scheme A","Telangana","Hyderabad","Active",121,"Live",18,"2026-09-19"],
 ["Pragati Welfare Institute","Scheme D","Maharashtra","Pune","Active",184,"Live",55,"2026-09-08"],
 ["Sahara Outreach Centre","Scheme B","Delhi","South Delhi","Active",88,"Live",31,"2026-09-15"]
 ].forEach(x=>p.run(...x));
 const a=db.prepare("INSERT INTO alerts(project_id,severity,title,message,created_at) VALUES(?,?,?,?,?)");
 a.run(3,"CRITICAL","CCTV offline","Camera heartbeat has not been received from Ujjwal Community Home.",new Date().toISOString());
 a.run(5,"HIGH","Attendance anomaly","Attendance variance crossed the configured threshold.",new Date().toISOString());
 a.run(2,"MEDIUM","Inspection due","Project has entered the random inspection queue.",new Date().toISOString());
}
app.use(cors());app.use(express.json());app.use(express.urlencoded({extended:true}));
app.use("/uploads",express.static(uploadDir));app.use(express.static(path.join(__dirname,"public")));
const upload=multer({dest:uploadDir});
const now=()=>new Date().toISOString();

app.post("/api/login",(req,res)=>{const u=db.prepare("SELECT id,name,email,role,mobile FROM users WHERE email=? AND password=?").get(req.body.email,req.body.password);if(!u)return res.status(401).json({error:"Invalid credentials"});res.json({user:u})});
app.post("/api/register",(req,res)=>{const {name,email,password,role,mobile}=req.body;if(!name||!email||!password||!role)return res.status(400).json({error:"All required fields must be completed"});try{const r=db.prepare("INSERT INTO users(name,email,password,role,mobile) VALUES(?,?,?,?,?)").run(name,email,password,role,mobile||"");const u=db.prepare("SELECT id,name,email,role,mobile FROM users WHERE id=?").get(r.lastInsertRowid);res.json({user:u})}catch(e){res.status(409).json({error:"An account with this email already exists"})}});
app.get("/api/dashboard",(req,res)=>{const projects=db.prepare("SELECT * FROM projects ORDER BY risk_score DESC").all();const alerts=db.prepare("SELECT a.*,p.name project_name FROM alerts a LEFT JOIN projects p ON p.id=a.project_id WHERE a.resolved=0 ORDER BY a.id DESC").all();const total=projects.length,active=projects.filter(x=>x.status==="Active").length,live=projects.filter(x=>x.cctv_status==="Live").length,avgRisk=Math.round(projects.reduce((s,x)=>s+x.risk_score,0)/(total||1));const pending=db.prepare("SELECT COUNT(*) c FROM inspections WHERE status!='Completed'").get().c;res.json({metrics:{total,active,live,pending,avgRisk},projects,alerts})});
app.get("/api/inspections",(req,res)=>res.json(db.prepare("SELECT i.*,p.name project_name FROM inspections i LEFT JOIN projects p ON p.id=i.project_id ORDER BY i.id DESC").all()));
app.post("/api/inspections/assign-random",(req,res)=>{const p=db.prepare("SELECT * FROM projects ORDER BY RANDOM() LIMIT 1").get();const u=db.prepare("SELECT name FROM users WHERE role LIKE '%PMU%' OR role LIKE '%Inspection%' LIMIT 20").all();const officer=u.length?u[Math.floor(Math.random()*u.length)].name:"Inspection Officer";const r=db.prepare("INSERT INTO inspections(project_id,officer,assigned_at,status) VALUES(?,?,?,?)").run(p.id,officer,now(),"Assigned");res.json({id:r.lastInsertRowid,officer,project:p})});
app.post("/api/inspections",upload.single("evidence"),(req,res)=>{const r=db.prepare("INSERT INTO inspections(project_id,officer,assigned_at,status,latitude,longitude,findings,evidence,score) VALUES(?,?,?,?,?,?,?,?,?)").run(req.body.project_id,req.body.officer,now(),"Completed",req.body.latitude||null,req.body.longitude||null,req.body.findings||"",req.file?"/uploads/"+req.file.filename:null,req.body.score||null);res.json({id:r.lastInsertRowid})});
app.post("/api/alerts/:id/resolve",(req,res)=>{db.prepare("UPDATE alerts SET resolved=1 WHERE id=?").run(req.params.id);res.json({ok:true})});
app.listen(PORT,()=>console.log(`DoSJE Nexus running on http://localhost:${PORT}`));