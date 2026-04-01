# Academic Tool — Group Presentation Ranking

A peer evaluation tool for class presentations at **Thammasat University**.
Students rate each other's group presentations across multiple dimensions, and teachers get a live dashboard with charts, rankings, and a one-click PDF report.

> **Version 1.0** — More features coming soon.

---

## What it does

During a class session where student groups present their startup ideas, every group evaluates all other groups by scoring them on five dimensions:

| Dimension | What is assessed |
|---|---|
| **Problem Clarity** | Is the problem real, specific, and significant? |
| **Solution Fit** | Does the tech solution actually solve the problem? |
| **Market Insight** | Do they understand the target customer deeply? |
| **Growth Thinking** | Are growth drivers plausible and evidence-based? |
| **Financing Rationale** | Does the financing mode fit the stage and context? |

Scores are submitted anonymously, stored in the cloud, and instantly visible to the teacher.

---

## Who uses it

| Role | What they do |
|---|---|
| **Students** | Open the survey, select their group, rate all other groups (1–5 per dimension), submit |
| **Teacher** | Log in to the admin dashboard, view live rankings and charts, export a PDF report |

---

## Pages

| Route | Description |
|---|---|
| `/` | Student survey form |
| `/results` | Live results (charts and rankings, public) |
| `/admin/login` | Teacher login |
| `/admin` | Teacher dashboard — rankings, charts, detail tables, PDF export, data reset |

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite 6 + TypeScript |
| UI components | shadcn/ui + Tailwind CSS + Radix UI |
| Charts | Recharts |
| Animations | Framer Motion |
| Backend / API | Hono running on Cloudflare Workers |
| Database | Cloudflare KV (globally distributed key-value store) |
| Auth | HMAC-signed session tokens (server-side credential validation) |
| PDF export | html2canvas + jsPDF (screenshots the live dashboard) |
| Hosting | Cloudflare Workers + Assets |

---

## Local development

```bash
npm install
npm run dev
```

App available at [http://localhost:5173](http://localhost:5173).

---

## Deployment

The project deploys automatically via Cloudflare's Git integration on every push to `main`.

To deploy manually:

```bash
npm run build
npm run deploy
```

---

## Required environment variables

Set these in **Cloudflare dashboard → Workers & Pages → academictool → Settings → Variables and Secrets**:

| Variable | Type | Description |
|---|---|---|
| `ADMIN_USER` | Plain text | Teacher username |
| `ADMIN_PASS` | Secret | Teacher password |
| `SESSION_SECRET` | Secret | Random 32-byte hex string — run `openssl rand -hex 32` |

The KV namespace binding (`SURVEY_KV`) is already configured in `wrangler.json`.

---

## Roadmap

- [ ] Custom group names (configured by teacher before the session)
- [ ] Multiple sessions / class support
- [ ] Student identity validation
- [ ] Automatic email report to teacher
- [ ] Historical session archive

---

*Built for the Technology and Entrepreneurship course at Thammasat University.*
