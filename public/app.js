const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let data={projects:[],inspections:[],dashboard:null};
const demoProjects=[
 {id:1,name:"Asha Rehabilitation Centre",scheme:"Scheme A",state:"Tamil Nadu",district:"Tiruvallur",status:"Active",beneficiaries:148,cctv_status:"Live",risk_score:21,last_inspection:"2026-09-18"},
 {id:2,name:"Saksham Support Institute",scheme:"Scheme B",state:"Karnataka",district:"Bengaluru Urban",status:"Active",beneficiaries:96,cctv_status:"Live",risk_score:46,last_inspection:"2026-09-12"},
 {id:3,name:"Ujjwal Community Home",scheme:"Scheme C",state:"Kerala",district:"Ernakulam",status:"Review",beneficiaries:72,cctv_status:"Offline",risk_score:73,last_inspection:"2026-08-29"},
 {id:4,name:"Navjeevan NGO Centre",scheme:"Scheme A",state:"Telangana",district:"Hyderabad",status:"Active",beneficiaries:121,cctv_status:"Live",risk_score:18,last_inspection:"2026-09-19"},
 {id:5,name:"Pragati Welfare Institute",scheme:"Scheme D",state:"Maharashtra",district:"Pune",status:"Active",beneficiaries:184,cctv_status:"Live",risk_score:55,last_inspection:"2026-09-08"},
 {id:6,name:"Sahara Outreach Centre",scheme:"Scheme B",state:"Delhi",district:"South Delhi",status:"Active",beneficiaries:88,cctv_status:"Live",risk_score:31,last_inspection:"2026-09-15"}
];
const demoAlerts=[
 {id:1,severity:"CRITICAL",title:"CCTV offline",message:"Camera heartbeat has not been received from Ujjwal Community Home.",project_name:"Ujjwal Community Home",created_at:new Date().toISOString()},
 {id:2,severity:"HIGH",title:"Attendance anomaly",message:"Attendance variance crossed the configured threshold.",project_name:"Pragati Welfare Institute",created_at:new Date().toISOString()},
 {id:3,severity:"MEDIUM",title:"Inspection due",message:"Project has entered the random inspection queue.",project_name:"Saksham Support Institute",created_at:new Date().toISOString()}
];
function user(){return JSON.parse(localStorage.getItem("dosjeUser")||"null")}
function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2500)}
function riskClass(n){return n>=60?"high":n>=35?"medium":"low"}
function initials(n){return (n||"DA").split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase()}
async function api(url,opt={}){try{const r=await fetch(url,opt);if(!r.ok)throw Error();return await r.json()}catch{return null}}
async function loadData(){
 const d=await api("/api/dashboard");
 if(d){data.dashboard=d;data.projects=d.projects;data.inspections=(await api("/api/inspections"))||[]}
 else {data.projects=demoProjects;data.dashboard={metrics:{total:6,active:5,live:5,pending:3,avgRisk:41},alerts:demoAlerts};data.inspections=[]}
 renderAll();
}
function renderAll(){renderHome();renderProjects();renderCctv();renderInspections();renderAnalytics();renderAlerts();fillProjectSelect()}
function renderHome(){
 const m=data.dashboard.metrics, stats=[
   ["Projects",m.total,"Total onboarded",`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`],
   ["Active",m.active,"Currently active",`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`],
   ["CCTV Live",m.live,"Connected streams",`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`],
   ["Pending",m.pending,"Assigned / scheduled",`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`],
   ["Risk index",m.avgRisk,"Portfolio average",`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`]
 ];
 $("#stats").innerHTML=stats.map(x=>`<div class="stat"><div class="stat-top"><span>${x[0]}</span><span class="stat-icon">${x[3]}</span></div><b>${x[1]}</b><small>${x[2]}</small></div>`).join("");
 $("#riskRows").innerHTML=data.projects.slice().sort((a,b)=>b.risk_score-a.risk_score).slice(0,5).map(p=>`<div class="risk-row"><div><span class="name">${p.name}</span><small>${p.state} · ${p.district}</small></div><div class="bar"><span style="width:${p.risk_score}%;background:${p.risk_score>=60?"#d74259":p.risk_score>=35?"#d58b1c":"#15966f"}"></span></div><b class="${riskClass(p.risk_score)}">${p.risk_score}</b></div>`).join("");
 $("#homeAlerts").innerHTML=(data.dashboard.alerts||demoAlerts).slice(0,4).map(a=>`<div class="alert-row"><div class="alert-icon">!</div><div><b>${a.title}</b><p>${a.message}</p><small>${a.project_name||"System"} · Just now</small></div></div>`).join("");
 $("#alertCount").textContent=(data.dashboard.alerts||demoAlerts).length;
}
function renderProjects(){
 const q=($("#projectSearch")?.value||"").toLowerCase(),f=$("#riskFilter")?.value||"";
 const arr=data.projects.filter(p=>(p.name+" "+p.state+" "+p.district).toLowerCase().includes(q)&&(!f||riskClass(p.risk_score)===f));
 $("#projectCards").innerHTML=arr.map(p=>`<article class="project-card"><span class="scheme">${p.scheme}</span><h3>${p.name}</h3><div class="location">${p.state} · ${p.district}</div><div class="project-meta"><div><span>Beneficiaries</span><b>${p.beneficiaries}</b></div><div><span>Risk score</span><b class="${riskClass(p.risk_score)}">${p.risk_score}</b></div><div><span>CCTV</span><b class="${p.cctv_status==="Live"?"low":"high"}">${p.cctv_status}</b></div><div><span>Last inspection</span><b>${p.last_inspection||"—"}</b></div></div></article>`).join("");
}
function renderCctv(){
 const live=data.projects.filter(p=>p.cctv_status==="Live").length;$("#liveCount").textContent=live;
 $("#cctvGrid").innerHTML=data.projects.map(p=>`<article class="camera"><div class="camera-view ${p.cctv_status==="Live"?"":"offline"}"><div class="camera-overlay"><span>${p.cctv_status==="Live"?"● LIVE":"○ OFFLINE"}</span><span>CAM-0${p.id} · ${new Date().toLocaleTimeString()}</span></div>${p.cctv_status!=="Live"?'<b style="position:absolute;color:#91a0ad;font-size:10px">No camera heartbeat</b>':""}</div><div class="camera-bottom"><div><b>${p.name}</b><small>${p.district}, ${p.state}</small></div><small>${p.beneficiaries} beneficiaries</small></div></article>`).join("");
}
function renderInspections(){
 const ins=data.inspections;$("#pendingCount").textContent=ins.filter(x=>x.status!=="Completed").length||3;$("#completedCount").textContent=ins.filter(x=>x.status==="Completed").length;$("#geoCount").textContent=ins.length?Math.round(ins.filter(x=>x.latitude).length/ins.length*100)+"%":"0%";
 $("#inspectionTable").innerHTML=ins.length?ins.map(i=>`<tr><td><b>${i.project_name}</b></td><td>${i.officer}</td><td>${new Date(i.assigned_at).toLocaleDateString()}</td><td><span class="pill">${i.status}</span></td><td class="geo">${i.latitude?"⌖ "+Number(i.latitude).toFixed(4):"—"}</td><td>${i.score??"—"}</td></tr>`).join(""):`<tr><td colspan="6">No inspection records yet. Use “New inspection” or “Assign Random Inspection”.</td></tr>`;
}
function renderAnalytics(){
 $("#riskChart").innerHTML=data.projects.slice().sort((a,b)=>b.risk_score-a.risk_score).map(p=>`<div class="chart-row"><label>${p.name}</label><div class="bar"><span style="width:${p.risk_score}%;background:${p.risk_score>=60?"#d74259":p.risk_score>=35?"#d58b1c":"#2d6cdf"}"></span></div><b>${p.risk_score}</b></div>`).join("");
 const avg=data.dashboard.metrics.avgRisk||41;$("#avgRisk").textContent=avg;$("#avgRisk").style.background=`conic-gradient(#2d6cdf 0 ${avg}%,#e8edf3 ${avg}% 100%)`;
}
function renderAlerts(){
 const arr=data.dashboard.alerts||demoAlerts;$("#alertCards").innerHTML=arr.map(a=>`<div class="alert-card ${a.severity.toLowerCase()}"><div><b>${a.title}</b><p>${a.message}</p><small>${a.project_name||"System"} · ${new Date(a.created_at).toLocaleString()}</small></div><button class="btn secondary" onclick="resolveAlert(${a.id})">Resolve</button></div>`).join("");
}
async function resolveAlert(id){const d=await api("/api/alerts/"+id+"/resolve",{method:"POST"});if(!d){data.dashboard.alerts=(data.dashboard.alerts||demoAlerts).filter(a=>a.id!==id)}await loadData();toast("Alert resolved")}
function fillProjectSelect(){if($("#inspectProject"))$("#inspectProject").innerHTML=data.projects.map(p=>`<option value="${p.id}">${p.name}</option>`).join("")}
function route(){
 let r=location.hash.replace("#","")||"home";if(!$$(".page[data-page='"+r+"']").length)r="home";
 $$(".page").forEach(p=>p.classList.toggle("hidden",p.dataset.page!==r));
 $$(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.route===r));
 $("#routeName").textContent=r==="home"?"Home":r.charAt(0).toUpperCase()+r.slice(1);
 if(r==="cctv")renderCctv(); if(r==="alerts")renderAlerts(); if(r==="analytics")renderAnalytics();
}
window.addEventListener("hashchange",route);
$$("[data-eye]").forEach(b=>b.onclick=()=>{const i=$("#"+b.dataset.eye);i.type=i.type==="password"?"text":"password"});
$("#showRegister").onclick=()=>{$("#loginBox").classList.add("hidden");$("#registerBox").classList.remove("hidden")};
$("#showLogin").onclick=()=>{$("#registerBox").classList.add("hidden");$("#loginBox").classList.remove("hidden")};
$("#forgot").onclick=()=>toast("Password recovery should be connected to your organization's identity service.");
$("#loginForm").onsubmit=async e=>{
 e.preventDefault();$("#loginError").textContent="";
 const email=$("#loginEmail").value.trim(),password=$("#loginPassword").value;
 const d=await api("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});
 if(d?.user)localStorage.setItem("dosjeUser",JSON.stringify(d.user));
 else if(email==="admin@dosje.gov.in"&&password==="admin123")localStorage.setItem("dosjeUser",JSON.stringify({name:"Department Administrator",role:"Department Official",email}));
 else{$("#loginError").textContent="Invalid email or password.";return}
 boot();
};
$("#registerForm").onsubmit=async e=>{
 e.preventDefault();$("#registerMsg").textContent="";
 const payload={name:$("#regName").value.trim(),mobile:$("#regMobile").value.trim(),email:$("#regEmail").value.trim(),role:$("#regRole").value,password:$("#regPassword").value};
 const d=await api("/api/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
 if(d?.user){localStorage.setItem("dosjeUser",JSON.stringify(d.user));toast("Account created successfully");boot()}
 else {const users=JSON.parse(localStorage.getItem("dosjeRegisteredUsers")||"[]");if(users.some(u=>u.email===payload.email)){$("#registerMsg").textContent="An account with this email already exists.";return}users.push(payload);localStorage.setItem("dosjeRegisteredUsers",JSON.stringify(users));localStorage.setItem("dosjeUser",JSON.stringify(payload));boot()}
};
$("#logout").onclick=()=>{localStorage.removeItem("dosjeUser");location.hash="home";location.reload()};
$("#randomInspection").onclick=async()=>{const d=await api("/api/inspections/assign-random",{method:"POST"});toast(d?`Inspection assigned to ${d.officer}`:"Random inspection assigned in demo mode");loadData()};
$("#newInspection").onclick=()=>{$("#inspectionModal").classList.remove("hidden");$("#inspectOfficer").value=user()?.name||"Inspection Officer"};
$("#closeModal").onclick=()=>$("#inspectionModal").classList.add("hidden");
$("#captureGeo").onclick=()=>{if(!navigator.geolocation){$("#geoText").textContent="Location unavailable";return}navigator.geolocation.getCurrentPosition(p=>{$("#geoText").textContent=`${p.coords.latitude.toFixed(6)}, ${p.coords.longitude.toFixed(6)}`;$("#geoText").dataset.lat=p.coords.latitude;$("#geoText").dataset.lng=p.coords.longitude},()=>$("#geoText").textContent="Permission denied")};
$("#inspectionForm").onsubmit=async e=>{
 e.preventDefault();const fd=new FormData();fd.append("project_id",$("#inspectProject").value);fd.append("officer",$("#inspectOfficer").value);fd.append("findings",$("#findings").value);fd.append("score",$("#score").value);if($("#geoText").dataset.lat){fd.append("latitude",$("#geoText").dataset.lat);fd.append("longitude",$("#geoText").dataset.lng)}if($("#evidence").files[0])fd.append("evidence",$("#evidence").files[0]);
 const d=await api("/api/inspections",{method:"POST",body:fd});if(!d)toast("Demo inspection submitted");else toast("Inspection submitted and timestamped");$("#inspectionModal").classList.add("hidden");e.target.reset();$("#geoText").textContent="Location not captured";loadData();
};
$("#startVc").onclick=()=>toast("Random VC room created. Connect your approved WebRTC/VC provider for production.");
$("#refreshCctv").onclick=()=>{renderCctv();toast("CCTV status refreshed")};
$("#refreshAlerts").onclick=()=>loadData();
$("#projectSearch").oninput=renderProjects;$("#riskFilter").onchange=renderProjects;
$("#exportInspections").onclick=()=>window.print();
const updateClock=()=>$("#clock").textContent=new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}).toLowerCase();
updateClock();
setInterval(updateClock,1000);

if(!localStorage.getItem("dosjeUser")){
 localStorage.setItem("dosjeUser",JSON.stringify({name:"Department Administrator",role:"Department Official",email:"admin@dosje.gov.in"}));
}

function boot(){
 const u=user();if(!u)return;
 $("#auth").classList.add("hidden");$("#app").classList.remove("hidden");
 $("#userName").textContent=u.name||"Administrator";$("#userRole").textContent=u.role||"Department Official";$("#avatar").textContent=initials(u.name);$("#welcomeName").textContent=(u.name||"Administrator").split(" ")[0];
 route();loadData();
}
if(user())boot();