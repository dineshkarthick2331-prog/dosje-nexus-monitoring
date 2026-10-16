# DoSJE Nexus – Project Monitoring Platform

A full-stack centralized monitoring dashboard for the **Department of Social Justice & Empowerment (DoSJE)**, Government of India.

## Features

- 🛡️ **Role-based Authentication** – Administrator, Field Officer, PMU Team portals
- 📊 **Live Dashboard** – Real-time risk scores, CCTV status, metrics
- ◉ **CCTV Surveillance** – Simulated live camera feeds with PTZ controls, night vision, thermal modes
- ✓ **Field Inspections** – GPS-geotagged inspections with photo evidence upload
- ⚑ **Alerts & Anomaly Detection** – AI-assisted anomaly flags, alert simulation
- ◌ **Random VC Verification** – Video conference-based surprise audits
- ▤ **Reports** – Monthly monitoring, inspection compliance, AI anomaly exports
- ✉ **Contact / Feedback** – Formspree-integrated contact form for team communication

## Formspree Integration

All key data events (user registration, project creation, field inspections, alerts, VC sessions) are **automatically forwarded to Formspree** (`https://formspree.io/f/xyeklbpy`) as email notifications for offline backup and real-time awareness.

A dedicated **Contact & Feedback** page is also available inside the portal, powered by the `/api/contact` endpoint which routes directly to Formspree.

## Tech Stack

| Layer    | Technology                  |
|----------|-----------------------------|
| Frontend | HTML5, Vanilla CSS, JS (ES6+) |
| Backend  | Node.js, Express.js          |
| Database | JSON file store (local/Vercel `/tmp`) |
| Forms    | Formspree (`xyeklbpy`)       |
| Deploy   | Vercel (serverless)         |

## API Endpoints

| Method | Route                         | Description                         |
|--------|-------------------------------|-------------------------------------|
| POST   | `/api/login`                  | Authenticate user                   |
| POST   | `/api/register`               | Register new user → notifies Formspree |
| GET    | `/api/dashboard`              | Metrics, risk table, active alerts  |
| GET    | `/api/projects`               | List all projects                   |
| POST   | `/api/projects`               | Create project → notifies Formspree |
| PUT    | `/api/projects/:id`           | Update project                      |
| DELETE | `/api/projects/:id`           | Delete project                      |
| GET    | `/api/inspections`            | List inspections                    |
| POST   | `/api/inspections`            | Submit inspection → notifies Formspree |
| POST   | `/api/inspections/assign-random` | Random surprise assignment       |
| POST   | `/api/alerts`                 | Create alert → notifies Formspree   |
| POST   | `/api/alerts/:id/resolve`     | Resolve alert                       |
| POST   | `/api/vc/session`             | Seal VC session → notifies Formspree |
| POST   | `/api/contact`                | Contact form → forwards to Formspree |
| GET    | `/api/reports/:type`          | Generate governance reports         |

## Demo Credentials

| Role              | Username | Password  |
|-------------------|----------|-----------|
| Administrator     | admin    | admin123  |
| Field Officer     | user     | user123   |
| PMU Team          | pmu      | pmu123    |

## Setup

```bash
npm install
npm run dev        # Development (http://localhost:3000)
npm start          # Production
```
