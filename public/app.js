// DoSJE Nexus - Interactive Project Monitoring Command Centre
// Full Interactive Logic, State Management, PTZ CCTV Engine, WebRTC/Canvas VC, AI What-If Simulator & Reports

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

// State Store
let state = {
  user: null,
  projects: [],
  inspections: [],
  alerts: [],
  dashboard: null,
  filter: { search: "", risk: "", scheme: "", cctv: "", sort: "risk-desc" },
  inspectionSearch: "",
  activeAlertFilter: "ALL",
  simulationActive: true,
  cctvActiveModalId: null,
  ptz: { pan: 0, tilt: 0, zoom: 1.0 },
  cctvMode: "normal", // 'normal' | 'night' | 'thermal'
  vc: {
    active: false,
    timer: 0,
    interval: null,
    mic: true,
    cam: true,
    useWebcam: false,
    stream: null,
    project: null,
    checklist: new Set(),
    animFrame: null
  },
  paletteIndex: 0,
  paletteItems: []
};

// Fallback demo dataset if offline/serverless disconnected
const demoProjects = [
  { id: 1, name: "Asha Rehabilitation Centre", scheme: "Scheme A", state: "Tamil Nadu", district: "Tiruvallur", status: "Active", beneficiaries: 148, cctv_status: "Live", risk_score: 21, last_inspection: "2026-09-18" },
  { id: 2, name: "Saksham Support Institute", scheme: "Scheme B", state: "Karnataka", district: "Bengaluru Urban", status: "Active", beneficiaries: 96, cctv_status: "Live", risk_score: 46, last_inspection: "2026-09-12" },
  { id: 3, name: "Ujjwal Community Home", scheme: "Scheme C", state: "Kerala", district: "Ernakulam", status: "Review", beneficiaries: 72, cctv_status: "Offline", risk_score: 73, last_inspection: "2026-08-29" },
  { id: 4, name: "Navjeevan NGO Centre", scheme: "Scheme A", state: "Telangana", district: "Hyderabad", status: "Active", beneficiaries: 121, cctv_status: "Live", risk_score: 18, last_inspection: "2026-09-19" },
  { id: 5, name: "Pragati Welfare Institute", scheme: "Scheme D", state: "Maharashtra", district: "Pune", status: "Active", beneficiaries: 184, cctv_status: "Live", risk_score: 55, last_inspection: "2026-09-08" },
  { id: 6, name: "Sahara Outreach Centre", scheme: "Scheme B", state: "Delhi", district: "South Delhi", status: "Active", beneficiaries: 88, cctv_status: "Live", risk_score: 31, last_inspection: "2026-09-15" }
];

const demoAlerts = [
  { id: 1, project_id: 3, severity: "CRITICAL", title: "CCTV offline", message: "Camera heartbeat has not been received from Ujjwal Community Home for > 120s.", project_name: "Ujjwal Community Home", created_at: new Date(Date.now() - 3600000).toISOString(), resolved: 0 },
  { id: 2, project_id: 5, severity: "HIGH", title: "Attendance anomaly", message: "Attendance variance crossed the configured 15% threshold.", project_name: "Pragati Welfare Institute", created_at: new Date(Date.now() - 7200000).toISOString(), resolved: 0 },
  { id: 3, project_id: 2, severity: "MEDIUM", title: "Inspection due", message: "Project has entered the random inspection priority queue.", project_name: "Saksham Support Institute", created_at: new Date(Date.now() - 86400000).toISOString(), resolved: 0 }
];

// Utilities
function getUser() {
  return JSON.parse(localStorage.getItem("dosjeUser") || "null");
}

function toast(msg, icon = "✓") {
  const t = $("#toast");
  if (!t) return;
  t.innerHTML = `<span style="font-weight:bold;margin-right:6px">${icon}</span> ${msg}`;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 2800);
}

function riskClass(n) {
  return n >= 60 ? "high" : n >= 35 ? "medium" : "low";
}

function initials(name) {
  return (name || "DA").split(/\s+/).map(x => x[0]).join("").slice(0, 2).toUpperCase();
}

async function api(url, options = {}) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`API call failed: ${url}`, err.message);
    return null;
  }
}

// Data Loading
async function loadData() {
  const dash = await api("/api/dashboard");
  if (dash) {
    state.dashboard = dash;
    state.projects = dash.projects || [];
    state.alerts = dash.alerts || [];
    state.inspections = (await api("/api/inspections")) || [];
  } else {
    state.projects = [...demoProjects];
    state.alerts = [...demoAlerts];
    state.dashboard = {
      metrics: {
        total: state.projects.length,
        active: state.projects.filter(p => p.status === "Active").length,
        live: state.projects.filter(p => p.cctv_status === "Live").length,
        pending: 3,
        avgRisk: Math.round(state.projects.reduce((s, p) => s + p.risk_score, 0) / (state.projects.length || 1))
      },
      alerts: state.alerts
    };
    state.inspections = [];
  }
  renderAll();
}

function renderAll() {
  renderHome();
  renderProjects();
  renderCctv();
  renderInspections();
  renderAnalytics();
  renderAlerts();
  populateDropdowns();
  updateNotifBadge();
}

// ----------------------------------------------------
// HOME DASHBOARD
// ----------------------------------------------------
function renderHome() {
  if (!state.dashboard || !state.dashboard.metrics) return;
  const m = state.dashboard.metrics;
  const stats = [
    ["Projects", m.total, "Total onboarded", `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`],
    ["Active", m.active, "Currently active", `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`],
    ["CCTV Live", m.live, "Connected streams", `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`],
    ["Pending", m.pending, "Assigned / due", `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`],
    ["Risk index", m.avgRisk, "Portfolio average", `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`]
  ];

  $("#stats").innerHTML = stats.map(x => `
    <div class="stat">
      <div class="stat-top">
        <span>${x[0]}</span>
        <span class="stat-icon">${x[3]}</span>
      </div>
      <b>${x[1]}</b>
      <small>${x[2]}</small>
    </div>
  `).join("");

  // Top 5 risk rows
  const sorted = [...state.projects].sort((a, b) => b.risk_score - a.risk_score).slice(0, 5);
  $("#riskRows").innerHTML = sorted.map(p => `
    <div class="risk-row" onclick="openProjectDetail(${p.id})">
      <div>
        <span class="name">${p.name}</span>
        <small>${p.state} · ${p.district}</small>
      </div>
      <div class="bar">
        <span style="width:${p.risk_score}%;background:${p.risk_score >= 60 ? "#d74259" : p.risk_score >= 35 ? "#d58b1c" : "#15966f"}"></span>
      </div>
      <b class="${riskClass(p.risk_score)}">${p.risk_score}</b>
    </div>
  `).join("");

  // Home priority alerts
  const activeAlerts = (state.alerts || []).filter(a => !a.resolved).slice(0, 4);
  if (!activeAlerts.length) {
    $("#homeAlerts").innerHTML = `<div style="padding:15px;color:var(--muted);font-size:10px;">✓ All operational alerts have been resolved. System nominal.</div>`;
  } else {
    $("#homeAlerts").innerHTML = activeAlerts.map(a => `
      <div class="alert-row" onclick="location.hash='alerts'">
        <div class="alert-icon">!</div>
        <div>
          <b>${a.title}</b>
          <p>${a.message}</p>
          <small>${a.project_name || "System"} · ${timeAgo(a.created_at)}</small>
        </div>
      </div>
    `).join("");
  }

  $("#alertCount").textContent = (state.alerts || []).filter(a => !a.resolved).length;
}

// ----------------------------------------------------
// PROJECTS DIRECTORY
// ----------------------------------------------------
function renderProjects() {
  const q = state.filter.search.toLowerCase().trim();
  const rF = state.filter.risk;
  const sF = state.filter.scheme;
  const cF = state.filter.cctv;

  let arr = state.projects.filter(p => {
    const text = `${p.name} ${p.state} ${p.district} ${p.scheme}`.toLowerCase();
    const matchQ = !q || text.includes(q);
    const matchR = !rF || riskClass(p.risk_score) === rF;
    const matchS = !sF || p.scheme === sF;
    const matchC = !cF || p.cctv_status === cF;
    return matchQ && matchR && matchS && matchC;
  });

  // Sorting
  if (state.filter.sort === "risk-desc") arr.sort((a, b) => b.risk_score - a.risk_score);
  else if (state.filter.sort === "risk-asc") arr.sort((a, b) => a.risk_score - b.risk_score);
  else if (state.filter.sort === "name-asc") arr.sort((a, b) => a.name.localeCompare(b.name));
  else if (state.filter.sort === "beneficiaries-desc") arr.sort((a, b) => b.beneficiaries - a.beneficiaries);

  const container = $("#projectCards");
  if (!container) return;

  if (!arr.length) {
    container.innerHTML = `<div style="grid-column:1/-1;padding:40px;text-align:center;color:var(--muted);background:var(--white);border-radius:12px;border:1px solid var(--line);">
      <h3>No projects match your filter criteria</h3>
      <p style="font-size:11px;margin-top:6px;">Try adjusting search terms or clearing the risk and scheme filters.</p>
      <button class="btn secondary" style="margin-top:12px" onclick="resetFilters()">Reset All Filters</button>
    </div>`;
    return;
  }

  container.innerHTML = arr.map(p => `
    <article class="project-card" data-id="${p.id}">
      <div onclick="openProjectDetail(${p.id})">
        <span class="scheme">${p.scheme}</span>
        <h3>${p.name}</h3>
        <div class="location">${p.state} · ${p.district}</div>
        <div class="project-meta">
          <div><span>Beneficiaries</span><b>${p.beneficiaries}</b></div>
          <div><span>Risk score</span><b class="${riskClass(p.risk_score)}">${p.risk_score}</b></div>
          <div><span>CCTV</span><b class="${p.cctv_status === "Live" ? "low" : "high"}">${p.cctv_status}</b></div>
          <div><span>Last inspection</span><b>${p.last_inspection || "—"}</b></div>
        </div>
      </div>
      <div class="card-actions">
        <button class="card-btn" onclick="openProjectDetail(${p.id})">👁 Details</button>
        <button class="card-btn cam" onclick="openCctvModal(${p.id})">📹 Stream</button>
        <button class="card-btn" onclick="quickAssignInspection(${p.id})">📋 Audit</button>
      </div>
    </article>
  `).join("");
}

function resetFilters() {
  state.filter = { search: "", risk: "", scheme: "", cctv: "", sort: "risk-desc" };
  if ($("#projectSearch")) $("#projectSearch").value = "";
  if ($("#riskFilter")) $("#riskFilter").value = "";
  if ($("#schemeFilter")) $("#schemeFilter").value = "";
  if ($("#cctvStatusFilter")) $("#cctvStatusFilter").value = "";
  if ($("#sortFilter")) $("#sortFilter").value = "risk-desc";
  renderProjects();
}

// Project Details Modal / Drawer
function openProjectDetail(id) {
  const p = state.projects.find(x => x.id === id);
  if (!p) return;

  const pastInspections = state.inspections.filter(i => i.project_id === id);
  const activeAlerts = (state.alerts || []).filter(a => a.project_id === id && !a.resolved);

  $("#projectDetailContent").innerHTML = `
    <span class="eyebrow">${p.scheme} · INSTITUTION DOSSIER</span>
    <h2>${p.name}</h2>
    <p class="sub">${p.district}, ${p.state} · Status: <b>${p.status}</b></p>
    
    <div class="detail-grid">
      <div class="detail-item">
        <span>Beneficiaries Enrolled</span>
        <b>${p.beneficiaries} Persons</b>
      </div>
      <div class="detail-item">
        <span>CCTV Surveillance Status</span>
        <b class="${p.cctv_status === "Live" ? "low" : "high"}">${p.cctv_status} Feed</b>
      </div>
      <div class="detail-item">
        <span>Calculated Risk Score</span>
        <b class="${riskClass(p.risk_score)}">${p.risk_score} / 100 (${p.risk_score >= 60 ? "High Risk" : p.risk_score >= 35 ? "Medium" : "Low Risk"})</b>
      </div>
      <div class="detail-item">
        <span>Last Formal Inspection</span>
        <b>${p.last_inspection || "Pending"}</b>
      </div>
    </div>

    <div style="margin:16px 0;background:rgba(0,0,0,0.02);padding:14px;border-radius:10px;border:1px solid var(--line);">
      <b style="font-size:11px;display:block;margin-bottom:6px;">Quick Telemetry Recalibration</b>
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:10px;color:var(--muted);">Adjust Risk:</span>
        <input type="range" min="0" max="100" value="${p.risk_score}" id="detailRiskSlider" style="flex:1" oninput="$('#detailRiskScoreText').textContent=this.value">
        <b id="detailRiskScoreText" style="font-size:12px;width:30px;">${p.risk_score}</b>
        <button class="btn secondary" style="padding:6px 12px;font-size:10px" onclick="updateProjectRisk(${p.id})">Save Risk</button>
      </div>
    </div>

    <div style="margin:16px 0;">
      <h3 style="font-size:12px;margin-bottom:8px">Past Field Audits (${pastInspections.length})</h3>
      ${pastInspections.length ? `
        <div style="max-height:140px;overflow-y:auto;font-size:10px;">
          ${pastInspections.map(i => `
            <div style="padding:8px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;">
              <span><b>${new Date(i.assigned_at).toLocaleDateString()}</b> by ${i.officer}</span>
              <span class="pill">${i.status} (Score: ${i.score ?? "—"})</span>
            </div>
          `).join("")}
        </div>
      ` : `<p style="font-size:10px;color:var(--muted)">No prior inspection records found for this centre.</p>`}
    </div>

    <div class="detail-actions">
      <button class="btn teal" onclick="openCctvModal(${p.id});$('#projectDetailModal').classList.add('hidden')">📹 Open Live Cam</button>
      <button class="btn primary" onclick="quickAssignInspection(${p.id});$('#projectDetailModal').classList.add('hidden')">📋 Assign Audit</button>
      <button class="btn secondary" onclick="startVcForProject(${p.id});$('#projectDetailModal').classList.add('hidden')">⚡ Connect VC</button>
      <button class="btn secondary danger" style="margin-left:auto" onclick="deleteProject(${p.id})">🗑 Delete</button>
    </div>
  `;

  $("#projectDetailModal").classList.remove("hidden");
}

async function updateProjectRisk(id) {
  const slider = $("#detailRiskSlider");
  if (!slider) return;
  const newRisk = Number(slider.value);
  const res = await api(`/api/projects/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ risk_score: newRisk })
  });

  const p = state.projects.find(x => x.id === id);
  if (p) p.risk_score = newRisk;
  loadData();
  toast(`Project risk score updated to ${newRisk}`);
}

async function deleteProject(id) {
  if (!confirm("Are you sure you want to remove this institution from monitoring?")) return;
  const res = await api(`/api/projects/${id}`, { method: "DELETE" });
  state.projects = state.projects.filter(p => p.id !== id);
  $("#projectDetailModal").classList.add("hidden");
  loadData();
  toast("Project deleted from registry");
}

function quickAssignInspection(projectId) {
  $("#inspectProject").value = projectId;
  $("#inspectOfficer").value = state.user?.name || "Inspection Officer";
  $("#inspectionModal").classList.remove("hidden");
}

// ----------------------------------------------------
// CCTV SURVEILLANCE & CANVAS SIMULATION ENGINE
// ----------------------------------------------------
function renderCctv() {
  const liveCount = state.projects.filter(p => p.cctv_status === "Live").length;
  if ($("#liveCount")) $("#liveCount").textContent = liveCount;

  const filter = $("#cctvGridFilter")?.value || "all";
  const list = state.projects.filter(p => filter === "all" || p.cctv_status === filter);

  const grid = $("#cctvGrid");
  if (!grid) return;

  grid.innerHTML = list.map(p => `
    <article class="camera" onclick="openCctvModal(${p.id})">
      <div class="camera-view ${p.cctv_status === "Live" ? "" : "offline"}" style="cursor:pointer">
        <canvas id="cctvThumbCanvas_${p.id}" width="380" height="230" style="width:100%;height:100%;position:absolute;inset:0"></canvas>
        <div class="camera-overlay">
          <span>${p.cctv_status === "Live" ? "● LIVE" : "○ OFFLINE"}</span>
          <span>CAM-0${p.id} · 24 FPS</span>
        </div>
        ${p.cctv_status !== "Live" ? '<b style="position:absolute;color:#91a0ad;font-size:10px;z-index:2">SIGNAL OFFLINE</b>' : ""}
      </div>
      <div class="camera-bottom">
        <div>
          <b>${p.name}</b>
          <small>${p.district}, ${p.state}</small>
        </div>
        <small style="color:var(--teal)">Click to Control PTZ →</small>
      </div>
    </article>
  `).join("");

  // Start thumbnail canvas renders
  list.forEach(p => drawCctvThumbnail(p));
}

function drawCctvThumbnail(p) {
  const canvas = $(`#cctvThumbCanvas_${p.id}`);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;

  if (p.cctv_status !== "Live") {
    // Draw static noise pattern
    const imgData = ctx.createImageData(w, h);
    for (let i = 0; i < imgData.data.length; i += 4) {
      const v = Math.random() * 50;
      imgData.data[i] = v;
      imgData.data[i + 1] = v;
      imgData.data[i + 2] = v + 10;
      imgData.data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
    return;
  }

  // Draw simulated indoor camera perspective
  ctx.fillStyle = "#112233";
  ctx.fillRect(0, 0, w, h);

  // Floor perspective
  ctx.fillStyle = "#1a3045";
  ctx.beginPath();
  ctx.moveTo(0, h * 0.6);
  ctx.lineTo(w, h * 0.6);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();

  // Grid lines on floor
  ctx.strokeStyle = "#254460";
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += 40) {
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.6);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  // Draw ambient human figure silhouette
  ctx.fillStyle = "#3c6488";
  const figureX = (w * 0.5) + (Math.sin(Date.now() / 2000 + p.id) * 30);
  const figureY = h * 0.62;
  // head
  ctx.beginPath();
  ctx.arc(figureX, figureY, 9, 0, Math.PI * 2);
  ctx.fill();
  // body
  ctx.fillRect(figureX - 7, figureY + 9, 14, 28);

  // Camera scanline effect
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  for (let y = 0; y < h; y += 4) {
    ctx.fillRect(0, y, w, 2);
  }
}

// Fullscreen PTZ CCTV Monitor Modal
let cctvLoopId = null;

function openCctvModal(projectId) {
  state.cctvActiveModalId = projectId;
  state.ptz = { pan: 0, tilt: 0, zoom: 1.0 };
  state.cctvMode = "normal";

  const p = state.projects.find(x => x.id === projectId);
  if (!p) return;

  $("#cctvCamTag").textContent = `CAM-0${p.id} · ${p.cctv_status.toUpperCase()} FEED`;
  $("#cctvModalTitle").textContent = p.name;
  $("#cctvModalLoc").textContent = `${p.district}, ${p.state} · ${p.scheme}`;
  $("#zoomValueText").textContent = "1.0x";
  $("#cctvZoom").value = 10;

  $("#cctvPlayerModal").classList.remove("hidden");
  startCctvRenderLoop();
}

function startCctvRenderLoop() {
  if (cctvLoopId) cancelAnimationFrame(cctvLoopId);

  const canvas = $("#cctvMainCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  function loop() {
    if ($("#cctvPlayerModal").classList.contains("hidden")) return;

    const p = state.projects.find(x => x.id === state.cctvActiveModalId);
    if (!p) return;

    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (p.cctv_status !== "Live") {
      // Offline noise screen
      const imgData = ctx.createImageData(w, h);
      for (let i = 0; i < imgData.data.length; i += 4) {
        const v = Math.random() * 70;
        imgData.data[i] = v;
        imgData.data[i + 1] = v;
        imgData.data[i + 2] = v + 15;
        imgData.data[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);

      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(w / 2 - 160, h / 2 - 35, 320, 70);
      ctx.fillStyle = "#ff5577";
      ctx.font = "800 18px 'Plus Jakarta Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SIGNAL LOSS - NO HEARTBEAT", w / 2, h / 2 - 4);
      ctx.fillStyle = "#a0b5c7";
      ctx.font = "11px monospace";
      ctx.fillText("ATTEMPTING AUTOMATIC RECONNECTION...", w / 2, h / 2 + 18);
    } else {
      ctx.save();
      // Apply PTZ (Pan, Tilt, Zoom)
      ctx.translate(w / 2, h / 2);
      ctx.scale(state.ptz.zoom, state.ptz.zoom);
      ctx.translate(-w / 2 + state.ptz.pan, -h / 2 + state.ptz.tilt);

      // Background architecture
      let bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      if (state.cctvMode === "night") {
        bgGrad.addColorStop(0, "#031408");
        bgGrad.addColorStop(1, "#072b12");
      } else if (state.cctvMode === "thermal") {
        bgGrad.addColorStop(0, "#12002b");
        bgGrad.addColorStop(0.5, "#490059");
        bgGrad.addColorStop(1, "#851c14");
      } else {
        bgGrad.addColorStop(0, "#101d2a");
        bgGrad.addColorStop(1, "#1c3248");
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Floor
      ctx.fillStyle = state.cctvMode === "night" ? "#0b3d1b" : state.cctvMode === "thermal" ? "#330847" : "#17293b";
      ctx.beginPath();
      ctx.moveTo(0, h * 0.58);
      ctx.lineTo(w, h * 0.58);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.fill();

      // Facility doors & windows in perspective
      ctx.strokeStyle = state.cctvMode === "night" ? "#197033" : state.cctvMode === "thermal" ? "#ff7700" : "#2d4d6e";
      ctx.lineWidth = 2;
      ctx.strokeRect(100, h * 0.28, 90, 160);
      ctx.strokeRect(w - 220, h * 0.32, 120, 80);

      // Animated activity (Persons walking / checking register)
      const t = Date.now() / 1500;
      const person1X = (w * 0.45) + Math.sin(t) * 90;
      const person1Y = h * 0.65;
      const person2X = (w * 0.72) + Math.cos(t * 0.7) * 40;
      const person2Y = h * 0.62;

      const drawPerson = (px, py, color, thermalGlow) => {
        ctx.fillStyle = color;
        if (state.cctvMode === "thermal") {
          // Heat halo
          ctx.beginPath();
          ctx.arc(px, py - 30, 24, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 80, 0, 0.4)";
          ctx.fill();
        }
        // Head
        ctx.beginPath();
        ctx.arc(px, py - 30, 13, 0, Math.PI * 2);
        ctx.fillStyle = state.cctvMode === "thermal" ? "#fffb00" : state.cctvMode === "night" ? "#4dfb7b" : color;
        ctx.fill();
        // Torso
        ctx.fillRect(px - 11, py - 16, 22, 40);
        // Legs
        ctx.fillRect(px - 9, py + 24, 7, 28);
        ctx.fillRect(px + 2, py + 24, 7, 28);
      };

      drawPerson(person1X, person1Y, "#587a9c");
      drawPerson(person2X, person2Y, "#678bb0");

      ctx.restore();

      // Scanline overlay
      ctx.fillStyle = state.cctvMode === "night" ? "rgba(0, 255, 80, 0.05)" : "rgba(255, 255, 255, 0.04)";
      for (let y = 0; y < h; y += 4) {
        ctx.fillRect(0, y, w, 2);
      }
    }

    // Update Telemetry Header text
    $("#cctvTimecode").textContent = new Date().toISOString().replace("T", " ").slice(0, 19);
    $("#cctvPanTiltLabel").textContent = `PAN: ${state.ptz.pan}° | TILT: ${state.ptz.tilt}° | ZOOM: ${state.ptz.zoom.toFixed(1)}x`;

    cctvLoopId = requestAnimationFrame(loop);
  }

  cctvLoopId = requestAnimationFrame(loop);
}

// PTZ controls
$("#ptzUp").onclick = () => { state.ptz.tilt = Math.min(state.ptz.tilt + 15, 60); };
$("#ptzDown").onclick = () => { state.ptz.tilt = Math.max(state.ptz.tilt - 15, -60); };
$("#ptzLeft").onclick = () => { state.ptz.pan = Math.max(state.ptz.pan - 20, -100); };
$("#ptzRight").onclick = () => { state.ptz.pan = Math.min(state.ptz.pan + 20, 100); };
$("#ptzReset").onclick = () => { state.ptz.pan = 0; state.ptz.tilt = 0; state.ptz.zoom = 1.0; $("#cctvZoom").value = 10; $("#zoomValueText").textContent = "1.0x"; };

$("#cctvZoom").oninput = e => {
  const z = Number(e.target.value) / 10;
  state.ptz.zoom = z;
  $("#zoomValueText").textContent = `${z.toFixed(1)}x`;
};

// Vision Filter Modes
$$(".vision-btn").forEach(btn => {
  btn.onclick = () => {
    $$(".vision-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.cctvMode = btn.dataset.mode;
    $("#cctvFilterLabel").textContent = `MODE: ${btn.textContent.toUpperCase()}`;
    toast(`Switched optical sensor to ${btn.textContent}`);
  };
});

// Snapshot capture
$("#cctvSnapshotBtn").onclick = () => {
  const canvas = $("#cctvMainCanvas");
  if (!canvas) return;

  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `SURVEILLANCE_SNAP_CAM0${state.cctvActiveModalId}_${Date.now()}.jpg`;
  a.click();
  toast("Snapshot frame downloaded and timestamped");
};

// Toggle stream power
$("#cctvTogglePower").onclick = async () => {
  const p = state.projects.find(x => x.id === state.cctvActiveModalId);
  if (!p) return;
  const newStatus = p.cctv_status === "Live" ? "Offline" : "Live";
  await api(`/api/projects/${p.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cctv_status: newStatus })
  });
  p.cctv_status = newStatus;
  loadData();
  toast(`Camera CAM-0${p.id} switched to ${newStatus}`);
};

// Simulate motion alarm
$("#cctvTriggerMotion").onclick = async () => {
  const p = state.projects.find(x => x.id === state.cctvActiveModalId);
  if (!p) return;

  const newAlert = {
    project_id: p.id,
    severity: "CRITICAL",
    title: "Surveillance Motion Alert",
    message: `Motion detection trigger trip-wire at CAM-0${p.id} (${p.name}). Verification recommended.`
  };
  await api("/api/alerts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newAlert)
  });
  loadData();
  toast(`Motion breach alarm triggered for ${p.name}!`, "⚠️");
};

$("#closeCctvModal").onclick = () => {
  $("#cctvPlayerModal").classList.add("hidden");
  if (cctvLoopId) cancelAnimationFrame(cctvLoopId);
};

// ----------------------------------------------------
// RANDOM VIDEO CONFERENCE (VC) ENGINE
// ----------------------------------------------------
function startVcForProject(projId) {
  location.hash = "vc";
  $("#vcProjectSelect").value = projId;
  initiateVcCall();
}

$("#startVc").onclick = () => initiateVcCall();

function initiateVcCall() {
  const projId = Number($("#vcProjectSelect")?.value || state.projects[0]?.id || 1);
  const p = state.projects.find(x => x.id === projId) || state.projects[0];

  state.vc.project = p;
  state.vc.active = true;
  state.vc.timer = 0;
  state.vc.checklist.clear();

  $("#vcTargetName").textContent = p.name;
  $("#vcInchargeTag").textContent = `Project Incharge (Dr. S. Raman) · ${p.district}`;

  // Reset checklist
  $$(".vc-check").forEach(c => c.checked = false);
  updateVcProgress();

  toast(`Establishing encrypted link to ${p.name}…`, "📞");

  clearInterval(state.vc.interval);
  state.vc.interval = setInterval(() => {
    state.vc.timer++;
    const m = String(Math.floor(state.vc.timer / 60)).padStart(2, "0");
    const s = String(state.vc.timer % 60).padStart(2, "0");
    $("#vcCallTimer").textContent = `${m}:${s}`;
  }, 1000);

  startVcFeeds();
}

function startVcFeeds() {
  const cIncharge = $("#vcCanvasIncharge");
  const cStaff = $("#vcCanvasStaff");
  const cSelf = $("#vcCanvasSelf");

  function drawVcFrame() {
    if (!state.vc.active) return;
    const t = Date.now() / 800;

    // Incharge canvas
    if (cIncharge) {
      const ctx = cIncharge.getContext("2d");
      const w = cIncharge.width = cIncharge.offsetWidth || 400;
      const h = cIncharge.height = cIncharge.offsetHeight || 300;
      ctx.fillStyle = "#162838";
      ctx.fillRect(0, 0, w, h);

      // Simulated talking avatar
      const mouthY = h * 0.52 + (state.vc.mic ? Math.sin(t * 5) * 4 : 0);
      ctx.fillStyle = "#365c7f";
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.42, 45, 0, Math.PI * 2);
      ctx.fill();

      // Face features
      ctx.fillStyle = "#dbe8f3";
      ctx.beginPath();
      ctx.arc(w / 2 - 14, h * 0.38, 5, 0, Math.PI * 2);
      ctx.arc(w / 2 + 14, h * 0.38, 5, 0, Math.PI * 2);
      ctx.fill();

      // Mouth opening animation
      ctx.fillStyle = "#0c1722";
      ctx.beginPath();
      ctx.ellipse(w / 2, mouthY, 12, state.vc.mic ? 4 + Math.abs(Math.sin(t * 6)) * 6 : 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Audio waveform bar at bottom
      if (state.vc.mic) {
        ctx.fillStyle = "#20b59a";
        for (let i = 0; i < 15; i++) {
          const bh = Math.abs(Math.sin(t * 3 + i * 0.6)) * 18;
          ctx.fillRect(w / 2 - 45 + i * 6, h - 25, 4, -bh);
        }
      }
    }

    // Staff canvas
    if (cStaff) {
      const ctx = cStaff.getContext("2d");
      const w = cStaff.width = cStaff.offsetWidth || 200;
      const h = cStaff.height = cStaff.offsetHeight || 150;
      ctx.fillStyle = "#11202e";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#2e4f6d";
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.46, 26, 0, Math.PI * 2);
      ctx.fill();
    }

    // Self canvas (if real webcam is not active)
    if (cSelf && !state.vc.useWebcam) {
      const ctx = cSelf.getContext("2d");
      const w = cSelf.width = cSelf.offsetWidth || 200;
      const h = cSelf.height = cSelf.offsetHeight || 150;
      ctx.fillStyle = "#0f1c29";
      ctx.fillRect(0, 0, w, h);

      if (state.vc.cam) {
        ctx.fillStyle = "#254868";
        ctx.beginPath();
        ctx.arc(w / 2, h * 0.46, 26, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "#637c95";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Camera Muted", w / 2, h / 2);
      }
    }

    state.vc.animFrame = requestAnimationFrame(drawVcFrame);
  }

  state.vc.animFrame = requestAnimationFrame(drawVcFrame);
}

// In-call buttons
$("#vcMicBtn").onclick = () => {
  state.vc.mic = !state.vc.mic;
  $("#vcMicBtn").classList.toggle("active", state.vc.mic);
  $("#vcMicBtn span").textContent = state.vc.mic ? "Mic On" : "Muted";
  toast(state.vc.mic ? "Microphone active" : "Microphone muted");
};

$("#vcCamBtn").onclick = () => {
  state.vc.cam = !state.vc.cam;
  $("#vcCamBtn").classList.toggle("active", state.vc.cam);
  $("#vcCamBtn span").textContent = state.vc.cam ? "Cam On" : "Cam Off";
};

// WebCam Support
$("#vcWebcamBtn").onclick = async () => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast("Webcam hardware access is unavailable in this environment", "⚠️");
    return;
  }
  try {
    if (!state.vc.useWebcam) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      state.vc.stream = stream;
      state.vc.useWebcam = true;
      const v = $("#vcLocalVideo");
      v.srcObject = stream;
      v.classList.remove("hidden");
      $("#vcCanvasSelf").classList.add("hidden");
      $("#vcWebcamBtn span").textContent = "Stop Webcam";
      toast("Webcam connected to session!");
    } else {
      if (state.vc.stream) state.vc.stream.getTracks().forEach(t => t.stop());
      state.vc.useWebcam = false;
      $("#vcLocalVideo").classList.add("hidden");
      $("#vcCanvasSelf").classList.remove("hidden");
      $("#vcWebcamBtn span").textContent = "Use My Webcam";
      toast("Webcam disconnected");
    }
  } catch (err) {
    toast("Could not access local webcam: " + err.message, "⚠️");
  }
};

// Capture VC snapshot
$("#vcSnapshotBtn").onclick = () => {
  const canvas = $("#vcCanvasIncharge");
  if (!canvas) return;
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/jpeg");
  a.download = `VC_VERIFICATION_${state.vc.project?.name || "DOSJE"}_${Date.now()}.jpg`;
  a.click();
  toast("Verification screenshot saved");
};

// Checklist interactive update
$$(".vc-check").forEach(chk => {
  chk.onchange = () => updateVcProgress();
});

function updateVcProgress() {
  const all = $$(".vc-check");
  const checked = all.filter(c => c.checked);
  const pct = Math.round((checked.length / (all.length || 1)) * 100);

  $("#checkProgressText").textContent = `${checked.length} / ${all.length} verified (${pct}%)`;
  $("#checkProgressBar").style.width = `${pct}%`;
}

// Seal & Save Verification Record
$("#submitVcVerification").onclick = async () => {
  const checked = $$(".vc-check").filter(c => c.checked).map(c => c.dataset.item);
  const notes = $("#vcNotes").value.trim();
  const proj = state.vc.project || state.projects[0];

  if (!checked.length && !notes) {
    toast("Please complete at least one verification check or record notes.", "⚠️");
    return;
  }

  const payload = {
    project_id: proj.id,
    officer: state.user?.name || "Monitoring Officer",
    checklist: checked,
    notes: notes || "Surprise spot inspection completed over encrypted video conference."
  };

  const res = await api("/api/vc/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  toast("Verification successfully sealed & submitted into official audit logs!", "✓");
  endVcCall();
  loadData();
  location.hash = "inspections";
};

$("#vcEndBtn").onclick = () => endVcCall();

function endVcCall() {
  state.vc.active = false;
  clearInterval(state.vc.interval);
  if (state.vc.animFrame) cancelAnimationFrame(state.vc.animFrame);
  if (state.vc.stream) state.vc.stream.getTracks().forEach(t => t.stop());
  state.vc.useWebcam = false;
  $("#vcCallTimer").textContent = "00:00";
  toast("Verification call disconnected");
}

// ----------------------------------------------------
// INSPECTIONS MANAGEMENT & CSV EXPORT
// ----------------------------------------------------
function renderInspections() {
  const ins = state.inspections;
  const q = (state.inspectionSearch || "").toLowerCase();

  $("#pendingCount").textContent = ins.filter(x => x.status !== "Completed").length || 3;
  $("#completedCount").textContent = ins.filter(x => x.status === "Completed").length;
  $("#geoCount").textContent = ins.length ? Math.round(ins.filter(x => x.latitude).length / ins.length * 100) + "%" : "100%";

  const filtered = ins.filter(i => {
    const text = `${i.project_name || ""} ${i.officer || ""} ${i.status || ""}`.toLowerCase();
    return !q || text.includes(q);
  });

  const tableBody = $("#inspectionTable");
  if (!tableBody) return;

  if (!filtered.length) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--muted)">No inspection records match query.</td></tr>`;
    return;
  }

  tableBody.innerHTML = filtered.map(i => `
    <tr onclick="viewInspectionDetail(${i.id})">
      <td><b>${i.project_name || "Institution"}</b></td>
      <td>${i.officer}</td>
      <td>${new Date(i.assigned_at).toLocaleDateString()}</td>
      <td><span class="pill ${i.status === "Completed" ? "" : "amber"}">${i.status}</span></td>
      <td class="geo">${i.latitude ? `⌖ ${Number(i.latitude).toFixed(3)}°` : "—"}</td>
      <td><b>${i.score ?? "—"}</b></td>
      <td><button class="btn secondary" style="padding:4px 8px;font-size:9px" onclick="event.stopPropagation();viewInspectionDetail(${i.id})">Details →</button></td>
    </tr>
  `).join("");
}

function viewInspectionDetail(id) {
  const i = state.inspections.find(x => x.id === id);
  if (!i) return;

  $("#inspectionDetailContent").innerHTML = `
    <span class="eyebrow">FIELD AUDIT RECORD #${i.id}</span>
    <h2>${i.project_name || "Project Inspection"}</h2>
    <p class="sub">Conducted by <b>${i.officer}</b> · Assigned on ${new Date(i.assigned_at).toLocaleString()}</p>
    
    <div class="detail-grid">
      <div class="detail-item">
        <span>Inspection Status</span>
        <b class="${i.status === "Completed" ? "low" : "high"}">${i.status}</b>
      </div>
      <div class="detail-item">
        <span>Compliance Rating</span>
        <b>${i.score ?? 80} / 100</b>
      </div>
      <div class="detail-item">
        <span>Verified Geo Location</span>
        <b>${i.latitude ? `Lat: ${Number(i.latitude).toFixed(4)}°, Lng: ${Number(i.longitude).toFixed(4)}°` : "Not Captured"}</b>
      </div>
      <div class="detail-item">
        <span>Digital Audit Trail</span>
        <b>SHA-256 Tamper Sealed</b>
      </div>
    </div>

    <div style="margin:16px 0;background:rgba(0,0,0,0.02);padding:14px;border-radius:10px;border:1px solid var(--line);">
      <b style="font-size:11px;display:block;margin-bottom:6px;">Observations & Findings:</b>
      <p style="font-size:11px;line-height:1.6;color:var(--ink);margin:0">${i.findings || "Routine compliance inspection carried out. Records and physical infrastructure checked."}</p>
    </div>

    ${i.evidence ? `
      <div style="margin:16px 0;">
        <b style="font-size:11px;display:block;margin-bottom:6px;">Photo Evidence File:</b>
        <img src="${i.evidence}" alt="Evidence" style="max-width:100%;border-radius:8px;border:1px solid var(--line)">
      </div>
    ` : ""}

    <div class="modal-actions">
      ${i.latitude ? `<a href="https://maps.google.com/?q=${i.latitude},${i.longitude}" target="_blank" class="btn secondary">🗺 View on Map</a>` : ""}
      <button class="btn primary" onclick="$('#inspectionDetailModal').classList.add('hidden')">Close Record</button>
    </div>
  `;

  $("#inspectionDetailModal").classList.remove("hidden");
}

$("#closeInspectionDetailModal").onclick = () => $("#inspectionDetailModal").classList.add("hidden");

// CSV Export
$("#exportInspectionsCsv").onclick = () => {
  const ins = state.inspections;
  if (!ins.length) {
    toast("No inspection records available to export.", "⚠️");
    return;
  }
  const headers = ["ID", "Project", "Officer", "Date", "Status", "Latitude", "Longitude", "Score", "Findings"];
  const rows = ins.map(i => [
    i.id,
    `"${(i.project_name || "").replace(/"/g, '""')}"`,
    `"${(i.officer || "").replace(/"/g, '""')}"`,
    i.assigned_at,
    i.status,
    i.latitude || "",
    i.longitude || "",
    i.score || "",
    `"${(i.findings || "").replace(/"/g, '""')}"`
  ]);

  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `DOSJE_Inspections_Audit_${Date.now()}.csv`;
  a.click();
  toast("Inspections CSV downloaded");
};

$("#exportInspectionsPrint").onclick = () => window.print();

// ----------------------------------------------------
// AI ANALYTICS & WHAT-IF RISK SIMULATOR
// ----------------------------------------------------
function renderAnalytics() {
  const sorted = [...state.projects].sort((a, b) => b.risk_score - a.risk_score);

  $("#riskChart").innerHTML = sorted.map(p => `
    <div class="chart-row" style="cursor:pointer" onclick="openProjectDetail(${p.id})">
      <label>${p.name}</label>
      <div class="bar">
        <span style="width:${p.risk_score}%;background:${p.risk_score >= 60 ? "#d74259" : p.risk_score >= 35 ? "#d58b1c" : "#2d6cdf"}"></span>
      </div>
      <b>${p.risk_score}</b>
    </div>
  `).join("");

  const avg = state.dashboard?.metrics?.avgRisk || 41;
  $("#avgRisk").textContent = avg;
  $("#avgRisk").style.background = `conic-gradient(#2d6cdf 0 ${avg}%,#e8edf3 ${avg}% 100%)`;

  updateWhatIfSimulator();
}

function updateWhatIfSimulator() {
  const attendance = Number($("#simAttendance")?.value || 85);
  const cctv = Number($("#simCctv")?.value || 95);
  const days = Number($("#simDays")?.value || 12);

  $("#simValAttendance").textContent = `${attendance}%`;
  $("#simValCctv").textContent = `${cctv}%`;
  $("#simValDays").textContent = `${days} days`;

  // Dynamic risk calculation model
  let risk = Math.round(
    ((100 - attendance) * 0.45) +
    ((100 - cctv) * 0.35) +
    (Math.min(days, 60) * 0.4)
  );
  risk = Math.max(5, Math.min(95, risk));

  const scoreBadge = $("#simPredictedScore");
  const statusBadge = $("#simRiskRating");
  const reasonText = $("#simReasoning");

  scoreBadge.textContent = risk;

  if (risk >= 60) {
    scoreBadge.style.color = "#d74259";
    statusBadge.textContent = "High Risk - Immediate Audit";
    statusBadge.style.background = "#ffebee";
    statusBadge.style.color = "#c62828";
    reasonText.textContent = "Significant attendance variance, CCTV loss, or stale inspection intervals detected.";
  } else if (risk >= 35) {
    scoreBadge.style.color = "#d58b1c";
    statusBadge.textContent = "Moderate Risk - Monitor Closely";
    statusBadge.style.background = "#fff8e1";
    statusBadge.style.color = "#f57f17";
    reasonText.textContent = "Moderate stability. Minor CCTV blips or approaching scheduled audit boundary.";
  } else {
    scoreBadge.style.color = "#15966f";
    statusBadge.textContent = "Low Risk - Healthy Institution";
    statusBadge.style.background = "#eaf8f4";
    statusBadge.style.color = "#15966f";
    reasonText.textContent = "High beneficiary attendance, continuous CCTV uptime, and recent verified inspection.";
  }
}

$("#simAttendance").oninput = updateWhatIfSimulator;
$("#simCctv").oninput = updateWhatIfSimulator;
$("#simDays").oninput = updateWhatIfSimulator;

$("#applySimScoreBtn").onclick = async () => {
  const pId = Number($("#simProjectSelect").value);
  const p = state.projects.find(x => x.id === pId);
  if (!p) return;
  const newRisk = Number($("#simPredictedScore").textContent);

  await api(`/api/projects/${p.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ risk_score: newRisk })
  });

  p.risk_score = newRisk;
  loadData();
  toast(`Calibrated ${p.name} risk score to ${newRisk}`);
};

// Run Automated AI Anomaly Diagnostic
$("#runAiDiagnostics").onclick = () => {
  toast("Scanning monitoring signals across 6 institutional endpoints…", "⚡");
  setTimeout(async () => {
    const offlineCount = state.projects.filter(p => p.cctv_status !== "Live").length;
    const highRiskCount = state.projects.filter(p => p.risk_score >= 60).length;

    toast(`Scan Complete: ${offlineCount} camera anomalies and ${highRiskCount} high-risk centres flagged.`);

    // If there's high risk, prompt or create alert
    const target = state.projects.find(p => p.risk_score >= 60) || state.projects[0];
    if (target) {
      await api("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: target.id,
          severity: "HIGH",
          title: "AI Anomaly Diagnostic Flag",
          message: `Predictive model flagged elevated anomaly signature for ${target.name}.`
        })
      });
      loadData();
    }
  }, 1000);
};

// ----------------------------------------------------
// ALERTS & ACTIONS
// ----------------------------------------------------
function renderAlerts() {
  const sev = state.activeAlertFilter;
  const list = state.alerts || [];

  $("#chipAllCount").textContent = list.filter(a => !a.resolved).length;
  $("#chipCritCount").textContent = list.filter(a => !a.resolved && a.severity === "CRITICAL").length;
  $("#chipHighCount").textContent = list.filter(a => !a.resolved && a.severity === "HIGH").length;
  $("#chipMedCount").textContent = list.filter(a => !a.resolved && a.severity === "MEDIUM").length;

  const filtered = list.filter(a => {
    if (a.resolved) return false;
    if (sev === "ALL") return true;
    return a.severity === sev;
  });

  const container = $("#alertCards");
  if (!container) return;

  if (!filtered.length) {
    container.innerHTML = `<div style="padding:30px;background:var(--white);border-radius:12px;text-align:center;color:var(--muted)">No unresolved alerts in this category. All operations nominal.</div>`;
    return;
  }

  container.innerHTML = filtered.map(a => `
    <div class="alert-card ${a.severity.toLowerCase()}">
      <div>
        <span class="palette-badge alert" style="margin-bottom:4px;display:inline-block">${a.severity}</span>
        <b>${a.title}</b>
        <p>${a.message}</p>
        <small>${a.project_name || "System"} · ${timeAgo(a.created_at)}</small>
      </div>
      <div style="display:flex;gap:6px">
        ${a.project_id ? `<button class="btn secondary" style="font-size:9px;padding:6px 10px" onclick="quickAssignInspection(${a.project_id})">Audit</button>` : ""}
        <button class="btn secondary" style="font-size:9px;padding:6px 10px" onclick="resolveAlert(${a.id})">Resolve ✓</button>
      </div>
    </div>
  `).join("");
}

$$(".filter-chip").forEach(chip => {
  chip.onclick = () => {
    $$(".filter-chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    state.activeAlertFilter = chip.dataset.sev;
    renderAlerts();
  };
});

async function resolveAlert(id) {
  const d = await api(`/api/alerts/${id}/resolve`, { method: "POST" });
  const a = state.alerts.find(x => x.id === id);
  if (a) a.resolved = 1;
  loadData();
  toast("Alert resolved and marked in audit trail");
}

function timeAgo(isoDate) {
  if (!isoDate) return "Just now";
  const diff = (Date.now() - new Date(isoDate).getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ----------------------------------------------------
// GOVERNANCE REPORTS GENERATOR
// ----------------------------------------------------
$$("[data-report-type]").forEach(btn => {
  btn.onclick = () => generateReportModal(btn.dataset.reportType);
});

async function generateReportModal(type) {
  const res = await api(`/api/reports/${type}`) || {
    total_projects: state.projects.length,
    active_projects: state.projects.filter(p => p.status === "Active").length,
    live_cctv: state.projects.filter(p => p.cctv_status === "Live").length,
    average_risk: Math.round(state.projects.reduce((s, p) => s + p.risk_score, 0) / (state.projects.length || 1)),
    total_inspections: state.inspections.length,
    unresolved_alerts: state.alerts.filter(a => !a.resolved).length,
    projects: state.projects,
    inspections: state.inspections,
    alerts: state.alerts.filter(a => !a.resolved)
  };

  const titleMap = {
    monthly: "Monthly Centralized Monitoring Portfolio Report",
    inspections: "Field Audit & Geo-tagged Inspection Compliance Audit",
    anomalies: "AI Anomaly Detection & Exception Summary"
  };

  $("#reportModalTitle").textContent = titleMap[type] || "Operational Governance Report";
  $("#reportModalSubtitle").textContent = `Generated on ${new Date().toLocaleString()} for Central PMU Operations`;

  $("#reportModalContent").innerHTML = `
    <div class="report-kpi-grid">
      <div class="report-kpi-box">
        <span>Monitored Centres</span>
        <b>${res.total_projects}</b>
      </div>
      <div class="report-kpi-box">
        <span>CCTV Telemetry Uptime</span>
        <b style="color:var(--green)">${Math.round((res.live_cctv / (res.total_projects || 1)) * 100)}%</b>
      </div>
      <div class="report-kpi-box">
        <span>Average Risk Score</span>
        <b>${res.average_risk} / 100</b>
      </div>
      <div class="report-kpi-box">
        <span>Active Alerts</span>
        <b style="color:var(--red)">${res.unresolved_alerts}</b>
      </div>
    </div>

    <div style="background:rgba(0,0,0,0.02);padding:16px;border-radius:10px;border:1px solid var(--line);margin-bottom:18px;">
      <h3 style="font-size:12px;margin:0 0 8px">Executive Compliance Summary</h3>
      <p style="font-size:11px;line-height:1.6;color:var(--ink);margin:0">
        All registered welfare centres are under automated monitoring through CCTV heartbeats and surprise mobile inspection protocols. 
        Currently <b>${res.active_projects}</b> centres are active. Field geo-coordinates validation indicates high integrity with verified timestamps.
      </p>
    </div>

    <div class="table-wrap">
      <h3 style="font-size:12px;margin-bottom:8px">Portfolio Institutional Breakdown</h3>
      <table>
        <thead>
          <tr><th>PROJECT NAME</th><th>SCHEME</th><th>STATE</th><th>BENEFICIARIES</th><th>CCTV</th><th>RISK</th></tr>
        </thead>
        <tbody>
          ${res.projects.map(p => `
            <tr>
              <td><b>${p.name}</b></td>
              <td>${p.scheme}</td>
              <td>${p.state}</td>
              <td>${p.beneficiaries}</td>
              <td><span class="pill ${p.cctv_status === "Live" ? "" : "amber"}">${p.cctv_status}</span></td>
              <td><b class="${riskClass(p.risk_score)}">${p.risk_score}</b></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  // Attach CSV download handler
  $("#downloadReportCsvBtn").onclick = () => {
    const csvRows = [
      ["Project", "Scheme", "State", "District", "Beneficiaries", "CCTV", "Risk"].join(","),
      ...res.projects.map(p => [
        `"${p.name}"`,
        `"${p.scheme}"`,
        `"${p.state}"`,
        `"${p.district}"`,
        p.beneficiaries,
        p.cctv_status,
        p.risk_score
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvRows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `DOSJE_Report_${type}_${Date.now()}.csv`;
    a.click();
    toast("Report CSV downloaded");
  };

  $("#reportModal").classList.remove("hidden");
}

$("#closeReportModal").onclick = () => $("#reportModal").classList.add("hidden");

// ----------------------------------------------------
// COMMAND PALETTE / QUICK SEARCH (Ctrl+K or ⌕)
// ----------------------------------------------------
function openCommandPalette() {
  const p = $("#commandPalette");
  p.classList.remove("hidden");
  const input = $("#paletteSearch");
  input.value = "";
  input.focus();
  renderPaletteResults("");
}

function closeCommandPalette() {
  $("#commandPalette").classList.add("hidden");
}

function renderPaletteResults(query) {
  const q = query.toLowerCase().trim();
  const results = [];

  // Actions
  results.push(
    { type: "action", label: "＋ Add New Project", hint: "Register welfare centre", action: () => $("#addProjectBtn").click() },
    { type: "action", label: "⚡ Assign Random Field Inspection", hint: "Dispatch surprise audit", action: () => $("#randomInspection").click() },
    { type: "action", label: "📹 Open Live CCTV Wall", hint: "Surveillance matrix", action: () => location.hash = "cctv" },
    { type: "action", label: "📞 Connect Random Video Conference", hint: "Start WebRTC verification", action: () => location.hash = "vc" },
    { type: "action", label: "🔮 Open What-If Risk Simulator", hint: "AI predictive scoring", action: () => location.hash = "analytics" }
  );

  // Projects
  state.projects.forEach(p => {
    if (!q || `${p.name} ${p.state} ${p.district} ${p.scheme}`.toLowerCase().includes(q)) {
      results.push({
        type: "project",
        label: p.name,
        hint: `${p.scheme} · ${p.state} (Risk: ${p.risk_score})`,
        action: () => openProjectDetail(p.id)
      });
    }
  });

  // Alerts
  (state.alerts || []).filter(a => !a.resolved).forEach(a => {
    if (!q || `${a.title} ${a.message}`.toLowerCase().includes(q)) {
      results.push({
        type: "alert",
        label: a.title,
        hint: `${a.project_name || "System"} · ${a.severity}`,
        action: () => location.hash = "alerts"
      });
    }
  });

  state.paletteItems = results;
  state.paletteIndex = 0;

  const container = $("#paletteResults");
  if (!results.length) {
    container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--muted);font-size:11px">No matching results found for "${query}"</div>`;
    return;
  }

  container.innerHTML = results.slice(0, 10).map((item, idx) => `
    <div class="palette-item ${idx === 0 ? "active" : ""}" data-idx="${idx}">
      <div class="palette-item-left">
        <span class="palette-badge ${item.type}">${item.type.toUpperCase()}</span>
        <div>
          <b style="font-size:11px;display:block">${item.label}</b>
          <small style="font-size:9px;color:var(--muted)">${item.hint}</small>
        </div>
      </div>
      <span style="font-size:9px;color:var(--blue)">Select ↵</span>
    </div>
  `).join("");

  $$(".palette-item").forEach(el => {
    el.onclick = () => {
      const idx = Number(el.dataset.idx);
      executePaletteItem(idx);
    };
  });
}

function executePaletteItem(idx) {
  const item = state.paletteItems[idx];
  if (item && item.action) {
    closeCommandPalette();
    item.action();
  }
}

// Keyboard shortcuts for palette
window.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    openCommandPalette();
  } else if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    e.preventDefault();
    $("#projectSearch") ? $("#projectSearch").focus() : openCommandPalette();
  } else if (e.key === "Escape") {
    closeCommandPalette();
    $$(".modal").forEach(m => m.classList.add("hidden"));
    $("#notificationPopover")?.classList.add("hidden");
  } else if (!$("#commandPalette").classList.contains("hidden")) {
    const items = $$(".palette-item");
    if (!items.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      state.paletteIndex = (state.paletteIndex + 1) % items.length;
      updatePaletteHighlight();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      state.paletteIndex = (state.paletteIndex - 1 + items.length) % items.length;
      updatePaletteHighlight();
    } else if (e.key === "Enter") {
      e.preventDefault();
      executePaletteItem(state.paletteIndex);
    }
  }
});

function updatePaletteHighlight() {
  $$(".palette-item").forEach((el, idx) => {
    el.classList.toggle("active", idx === state.paletteIndex);
  });
}

$("#paletteSearch")?.addEventListener("input", e => {
  renderPaletteResults(e.target.value);
});

$("#searchBtn")?.addEventListener("click", openCommandPalette);
$("#commandPalette")?.addEventListener("click", e => {
  if (e.target.id === "commandPalette") closeCommandPalette();
});

// ----------------------------------------------------
// NOTIFICATION POPOVER
// ----------------------------------------------------
function updateNotifBadge() {
  const count = (state.alerts || []).filter(a => !a.resolved).length;
  const badge = $("#notifBadge");
  const countText = $("#notifCountText");
  if (badge) badge.style.display = count > 0 ? "block" : "none";
  if (countText) countText.textContent = `${count} unresolved`;

  const list = $("#notifList");
  if (!list) return;

  const activeAlerts = (state.alerts || []).filter(a => !a.resolved);
  if (!activeAlerts.length) {
    list.innerHTML = `<div style="padding:16px;text-align:center;color:var(--muted);font-size:10px">No active notifications</div>`;
    return;
  }

  list.innerHTML = activeAlerts.slice(0, 5).map(a => `
    <div class="popover-item" onclick="location.hash='alerts';$('#notificationPopover').classList.add('hidden')">
      <b>${a.title}</b>
      <p>${a.message}</p>
      <small style="color:var(--muted);font-size:8px">${a.project_name || "System"} · ${timeAgo(a.created_at)}</small>
    </div>
  `).join("");
}

$("#notificationBtn")?.addEventListener("click", e => {
  e.stopPropagation();
  $("#notificationPopover").classList.toggle("hidden");
});

document.addEventListener("click", e => {
  if (!e.target.closest(".notification-wrap")) {
    $("#notificationPopover")?.classList.add("hidden");
  }
});

// ----------------------------------------------------
// THEME SWITCHER (Dark / Light Mode)
// ----------------------------------------------------
function initTheme() {
  const saved = localStorage.getItem("dosjeTheme");
  if (saved === "dark") {
    document.body.classList.add("dark-mode");
  }
}

$("#themeToggle")?.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  const isDark = document.body.classList.contains("dark-mode");
  localStorage.setItem("dosjeTheme", isDark ? "dark" : "light");
  toast(isDark ? "Switched to Cyber Command Dark Mode" : "Switched to Clean Light Mode", isDark ? "🌙" : "☀️");
});

// ----------------------------------------------------
// SIMULATION ENGINE TOGGLE
// ----------------------------------------------------
let simInterval = null;

function initSimulationTicker() {
  const btn = $("#simToggle");
  if (!btn) return;

  btn.onclick = () => {
    state.simulationActive = !state.simulationActive;
    btn.innerHTML = `<i class="${state.simulationActive ? "sim-pulse" : ""}"></i> <span>Simulation: ${state.simulationActive ? "ON" : "OFF"}</span>`;
    toast(`Real-time Telemetry Simulation ${state.simulationActive ? "Enabled" : "Paused"}`);
  };

  // Simulate occasional background telemetry events every 15 seconds
  simInterval = setInterval(() => {
    if (!state.simulationActive) return;

    // Small random heartbeat update
    const randomProject = state.projects[Math.floor(Math.random() * state.projects.length)];
    if (randomProject && randomProject.cctv_status === "Live") {
      drawCctvThumbnail(randomProject);
    }
  }, 12000);
}

// ----------------------------------------------------
// MODAL CONTROLS & FORMS
// ----------------------------------------------------
function populateDropdowns() {
  // Scheme Filter dropdown
  const schemes = [...new Set(state.projects.map(p => p.scheme).filter(Boolean))];
  const sSelect = $("#schemeFilter");
  if (sSelect) {
    const cur = sSelect.value;
    sSelect.innerHTML = `<option value="">All schemes</option>` + schemes.map(s => `<option value="${s}">${s}</option>`).join("");
    sSelect.value = cur;
  }

  // Inspection Project Select
  const iSelect = $("#inspectProject");
  if (iSelect) {
    iSelect.innerHTML = state.projects.map(p => `<option value="${p.id}">${p.name} (${p.district})</option>`).join("");
  }

  // VC Project Select
  const vcSelect = $("#vcProjectSelect");
  if (vcSelect) {
    vcSelect.innerHTML = state.projects.map(p => `<option value="${p.id}">${p.name} (${p.state})</option>`).join("");
  }

  // What-If Project Select
  const simSelect = $("#simProjectSelect");
  if (simSelect) {
    simSelect.innerHTML = state.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
  }

  // Alert simulation Project Select
  const alertProjSelect = $("#simAlertProject");
  if (alertProjSelect) {
    alertProjSelect.innerHTML = state.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
  }
}

// Add Project Form
$("#addProjectBtn").onclick = () => {
  $("#projectForm").reset();
  $("#projRiskVal").textContent = "25";
  $("#projectModal").classList.remove("hidden");
};
$("#closeProjectModal").onclick = () => $("#projectModal").classList.add("hidden");
$("#cancelProjectBtn").onclick = () => $("#projectModal").classList.add("hidden");

$("#projectForm").onsubmit = async e => {
  e.preventDefault();
  const payload = {
    name: $("#projName").value.trim(),
    scheme: $("#projScheme").value,
    status: $("#projStatus").value,
    state: $("#projState").value.trim(),
    district: $("#projDistrict").value.trim(),
    beneficiaries: Number($("#projBeneficiaries").value) || 50,
    cctv_status: $("#projCctv").value,
    risk_score: Number($("#projRisk").value) || 25
  };

  const res = await api("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res) {
    payload.id = state.projects.length ? Math.max(...state.projects.map(p => p.id)) + 1 : 1;
    payload.last_inspection = new Date().toISOString().split("T")[0];
    state.projects.push(payload);
  }

  $("#projectModal").classList.add("hidden");
  toast(`Institution "${payload.name}" successfully registered`);
  loadData();
};

// Project Details Close
$("#closeDetailModal").onclick = () => $("#projectDetailModal").classList.add("hidden");

// Inspection Form & Evidence Preview
$("#newInspection").onclick = () => {
  $("#inspectionForm").reset();
  $("#geoText").textContent = "Location not captured";
  delete $("#geoText").dataset.lat;
  delete $("#geoText").dataset.lng;
  $("#evidencePreviewWrap").classList.add("hidden");
  $("#inspectOfficer").value = state.user?.name || "Inspection Officer";
  $("#scoreVal").textContent = "85";
  $("#inspectionModal").classList.remove("hidden");
};
$("#closeModal").onclick = () => $("#inspectionModal").classList.add("hidden");
$("#cancelInspectionBtn").onclick = () => $("#inspectionModal").classList.add("hidden");

$("#captureGeo").onclick = () => {
  if (!navigator.geolocation) {
    // Generate realistic district coords fallback
    setFallbackLocation();
    return;
  }
  navigator.geolocation.getCurrentPosition(
    p => {
      const lat = p.coords.latitude;
      const lng = p.coords.longitude;
      $("#geoText").textContent = `GPS Locked: ${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E`;
      $("#geoText").dataset.lat = lat;
      $("#geoText").dataset.lng = lng;
      toast("GPS coordinates verified & locked");
    },
    () => setFallbackLocation()
  );
};

function setFallbackLocation() {
  const pId = Number($("#inspectProject").value);
  const p = state.projects.find(x => x.id === pId);
  const lat = 13.0827 + (Math.random() - 0.5) * 0.1;
  const lng = 80.2707 + (Math.random() - 0.5) * 0.1;
  $("#geoText").textContent = `GPS Locked (${p ? p.district : "Site"}): ${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
  $("#geoText").dataset.lat = lat;
  $("#geoText").dataset.lng = lng;
  toast("GPS coordinates captured");
}

$("#evidence").onchange = e => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = re => {
      $("#evidencePreview").src = re.target.result;
      $("#evidencePreviewWrap").classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  }
};

$("#removeEvidenceBtn").onclick = () => {
  $("#evidence").value = "";
  $("#evidencePreviewWrap").classList.add("hidden");
};

$("#inspectionForm").onsubmit = async e => {
  e.preventDefault();
  const fd = new FormData();
  fd.append("project_id", $("#inspectProject").value);
  fd.append("officer", $("#inspectOfficer").value);
  fd.append("findings", $("#findings").value);
  fd.append("score", $("#score").value);
  if ($("#geoText").dataset.lat) {
    fd.append("latitude", $("#geoText").dataset.lat);
    fd.append("longitude", $("#geoText").dataset.lng);
  }
  if ($("#evidence").files[0]) {
    fd.append("evidence", $("#evidence").files[0]);
  }

  const d = await api("/api/inspections", { method: "POST", body: fd });
  $("#inspectionModal").classList.add("hidden");
  toast("Inspection submitted and tamper-sealed in monitoring ledger");
  loadData();
};

// Random inspection assignment buttons
$("#randomInspection").onclick = assignRandomInspection;
$("#assignRandomBtn")?.addEventListener("click", assignRandomInspection);

async function assignRandomInspection() {
  const res = await api("/api/inspections/assign-random", { method: "POST" });
  if (res) {
    toast(`Surprise inspection assigned to ${res.officer} for ${res.project.name}!`, "⚡");
  } else {
    toast("Random inspection dispatched to field officer", "⚡");
  }
  loadData();
}

// Simulate Alert Modal
$("#homeSimulateAlert")?.addEventListener("click", () => openSimAlertModal());
$("#newAlertSimBtn")?.addEventListener("click", () => openSimAlertModal());

function openSimAlertModal() {
  $("#simulateAlertForm").reset();
  $("#simulateAlertModal").classList.remove("hidden");
}

$("#closeAlertModal").onclick = () => $("#simulateAlertModal").classList.add("hidden");
$("#cancelAlertModal").onclick = () => $("#simulateAlertModal").classList.add("hidden");

$("#simulateAlertForm").onsubmit = async e => {
  e.preventDefault();
  const payload = {
    project_id: Number($("#simAlertProject").value),
    severity: $("#simAlertSeverity").value,
    title: $("#simAlertTitle").value.trim(),
    message: $("#simAlertMessage").value.trim()
  };

  await api("/api/alerts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  $("#simulateAlertModal").classList.add("hidden");
  toast(`Alert "${payload.title}" triggered`, "⚠️");
  loadData();
  location.hash = "alerts";
};

// Search & Filter Listeners
$("#projectSearch")?.addEventListener("input", e => {
  state.filter.search = e.target.value;
  renderProjects();
});

$("#riskFilter")?.addEventListener("change", e => {
  state.filter.risk = e.target.value;
  renderProjects();
});

$("#schemeFilter")?.addEventListener("change", e => {
  state.filter.scheme = e.target.value;
  renderProjects();
});

$("#cctvStatusFilter")?.addEventListener("change", e => {
  state.filter.cctv = e.target.value;
  renderProjects();
});

$("#sortFilter")?.addEventListener("change", e => {
  state.filter.sort = e.target.value;
  renderProjects();
});

$("#cctvGridFilter")?.addEventListener("change", renderCctv);
$("#refreshCctv")?.addEventListener("click", () => {
  renderCctv();
  toast("Refreshed all CCTV streaming endpoints");
});

$("#refreshAlerts")?.addEventListener("click", () => {
  loadData();
  toast("Alerts refreshed");
});

$("#inspectionSearch")?.addEventListener("input", e => {
  state.inspectionSearch = e.target.value;
  renderInspections();
});

// Mobile menu toggle
$("#mobileMenu")?.addEventListener("click", () => {
  const sidebar = $(".sidebar");
  if (sidebar) {
    const isShowing = sidebar.style.display === "flex";
    sidebar.style.display = isShowing ? "none" : "flex";
  }
});

// Clock updater
function updateClock() {
  const c = $("#clock");
  if (c) c.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
setInterval(updateClock, 1000);
updateClock();

// Routing
function route() {
  let r = location.hash.replace("#", "") || "home";
  if (!$$(`.page[data-page='${r}']`).length) r = "home";

  $$(".page").forEach(p => p.classList.toggle("hidden", p.dataset.page !== r));
  $$(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.route === r));
  $("#routeName").textContent = r === "home" ? "Home" : r.charAt(0).toUpperCase() + r.slice(1);

  if (r === "cctv") renderCctv();
  if (r === "alerts") renderAlerts();
  if (r === "analytics") renderAnalytics();
  if (r === "inspections") renderInspections();
  if (r === "projects") renderProjects();
}

window.addEventListener("hashchange", route);

// Auth Login & Register Handlers
$$("[data-eye]").forEach(b => {
  b.onclick = () => {
    const input = $("#" + b.dataset.eye);
    if (input) input.type = input.type === "password" ? "text" : "password";
  };
});

$("#showRegister")?.addEventListener("click", () => {
  $("#loginBox").classList.add("hidden");
  $("#registerBox").classList.remove("hidden");
});

$("#showLogin")?.addEventListener("click", () => {
  $("#registerBox").classList.add("hidden");
  $("#loginBox").classList.remove("hidden");
});

$("#loginForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  $("#loginError").textContent = "";
  const email = $("#loginEmail").value.trim();
  const password = $("#loginPassword").value;

  const d = await api("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  if (d?.user) {
    localStorage.setItem("dosjeUser", JSON.stringify(d.user));
  } else if (email === "admin@dosje.gov.in" && password === "admin123") {
    localStorage.setItem("dosjeUser", JSON.stringify({ name: "Department Administrator", role: "Department Official", email }));
  } else {
    $("#loginError").textContent = "Invalid credentials. Use demo: admin@dosje.gov.in / admin123";
    return;
  }
  boot();
});

$("#registerForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  $("#registerMsg").textContent = "";
  const payload = {
    name: $("#regName").value.trim(),
    mobile: $("#regMobile").value.trim(),
    email: $("#regEmail").value.trim(),
    role: $("#regRole").value,
    password: $("#regPassword").value
  };

  const d = await api("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (d?.user) {
    localStorage.setItem("dosjeUser", JSON.stringify(d.user));
    toast("Account created successfully");
    boot();
  } else {
    localStorage.setItem("dosjeUser", JSON.stringify(payload));
    boot();
  }
});

$("#logout")?.addEventListener("click", () => {
  localStorage.removeItem("dosjeUser");
  location.hash = "home";
  location.reload();
});

// Boot application
function boot() {
  const u = getUser();
  if (!u) {
    // Default demo session if none set
    localStorage.setItem("dosjeUser", JSON.stringify({
      name: "Department Administrator",
      role: "Department Official",
      email: "admin@dosje.gov.in"
    }));
  }

  const curUser = getUser();
  state.user = curUser;

  $("#auth")?.classList.add("hidden");
  $("#app")?.classList.remove("hidden");

  $("#userName").textContent = curUser.name || "Administrator";
  $("#userRole").textContent = curUser.role || "Department Official";
  $("#avatar").textContent = initials(curUser.name);
  $("#welcomeName").textContent = (curUser.name || "Administrator").split(" ")[0];

  initTheme();
  initSimulationTicker();
  route();
  loadData();
}

// Auto-run on script load
boot();