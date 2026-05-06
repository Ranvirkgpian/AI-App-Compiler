# ⚡ AI App Compiler

> Natural Language → Structured Config → Validated → Executable → Working Application

A compiler-like system that converts natural language descriptions into structured, validated, cross-consistent application configurations and renders them as working applications via a built-in runtime.

## 🏗️ Architecture

```
User Prompt
    ↓
Stage 1: Intent Extraction    →  Entities, Features, Roles, Business Rules
    ↓
Stage 2: System Design        →  Architecture, Flows, Permissions, Pages
    ↓
Stage 3: Schema Generation    →  UI + API + DB + Auth configs
    ↓
Stage 4: Refinement           →  Validation → Auto-Repair → LLM Repair
    ↓
Runtime Renderer              →  Live Working Application
```

## 🚀 Quick Start

```bash
npm install
npm run dev
```

1. Open `http://localhost:5173`
2. Click **⚙️ Settings** → select **Gemini** or **Groq** → paste your API key
3. Enter a prompt (e.g., *"Build a CRM with login, contacts, dashboard, and role-based access"*)
4. Click **⚡ Compile Application**
5. Watch the 4-stage pipeline execute in real-time
6. View the generated JSON config
7. Switch to **🖥️ Preview** to interact with the live rendered app

## 🧩 Pipeline Stages

| Stage | Input | Output | LLM Call |
|-------|-------|--------|----------|
| **1. Intent Extraction** | Raw prompt | Entities, features, roles, rules | ✅ |
| **2. System Design** | Intent object | Architecture, flows, permissions | ✅ |
| **3. Schema Generation** | System design | UI + API + DB + Auth configs | ✅ |
| **4. Refinement** | Raw config | Validated, repaired config | ✅ (only if errors) |

## ✅ Validation Engine (3 Levels)

1. **Structural** — Zod schema validation (types, required fields)
2. **Referential** — Cross-layer consistency (API↔DB, UI↔API, Auth↔Pages)
3. **Logical** — Business rules (auth coverage, CRUD completeness, dashboard components)

## 🔧 Repair Engine

- **Deterministic auto-fix** — Missing IDs, duplicate keys, auth logic (no LLM needed)
- **Targeted LLM repair** — Only re-generates broken sections, not full retry
- **Max 3 cycles** — Fails gracefully with detailed error report

## 🧪 Evaluation Framework

- **10 real product prompts** (CRM, e-commerce, project management, etc.)
- **10 edge cases** (vague, conflicting, incomplete, overly complex, non-app)
- **Tracked metrics**: success rate, latency, retries, failure types, completeness

## 📁 Project Structure

```
src/
├── compiler/               # Multi-stage pipeline
│   ├── pipeline.js         # Orchestrator
│   ├── stages/             # 4 pipeline stages
│   ├── schemas/            # Zod schemas + JSON Schema
│   ├── llm/                # Gemini + Groq client
│   └── validation/         # Validator + Repair engine
├── runtime/                # App renderer (execution awareness)
│   ├── AppRenderer.jsx     # Master renderer
│   ├── components/         # Dynamic UI components
│   ├── auth/               # Auth simulator
│   └── data/               # In-memory CRUD store
├── ui/                     # Compiler interface
│   ├── CompilerInterface.jsx
│   ├── PipelineVisualizer.jsx
│   ├── ConfigViewer.jsx
│   └── MetricsPanel.jsx
└── evaluation/             # Test suite + dashboard
    ├── testCases.js
    ├── evaluator.js
    └── EvalDashboard.jsx
```

## ⚙️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vite + React |
| LLM | Gemini Flash / Groq (Llama 3.3 70B) |
| Validation | Zod |
| Runtime | React Dynamic Renderer |
| Styling | Vanilla CSS (dark mode, glassmorphism) |

## 📊 Cost vs Quality Tradeoff

| Strategy | Latency | Quality | Cost |
|----------|---------|---------|------|
| 4-stage pipeline (default) | ~10-15s | Good | Free |
| + repair cycles | ~20-40s | High | Free |
| Gemini vs Groq | Gemini faster | Gemini more reliable | Both free |

## 🔑 API Keys

- **Gemini**: Get free key at [aistudio.google.com](https://aistudio.google.com/)
- **Groq**: Get free key at [console.groq.com](https://console.groq.com/)

## 📦 Deploy

```bash
npm run build     # Creates dist/ folder
# Deploy dist/ to Vercel, Netlify, or any static host
```
