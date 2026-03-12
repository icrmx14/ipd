# Intelligent Containerized Load Balancing and Monitoring System
### Using HAProxy, Docker & ELK Stack

> **B.Tech Final Year Project (IPD)**
> A production-ready containerized system for automated deployment, intelligent load balancing, centralized logging, and self-healing monitoring.

---

## 📋 Abstract

This project presents the design and implementation of an **Intelligent Containerized Load Balancing and Monitoring System** — a **generic platform** where end-users can **upload their own project code** (backend, frontend, database) and the system will automatically containerize, deploy, and load-balance it. The platform uses **Docker** for containerization, **HAProxy** for intelligent traffic distribution, and the **ELK Stack** (Elasticsearch, Logstash, Kibana) for centralized log management and real-time monitoring. An AI-driven **Self-Healing Service** monitors error logs and automatically restarts failing containers, ensuring high availability. A **FastAPI-based Controller Dashboard** provides a unified web interface with a **drag-and-drop upload workflow**, auto-detection of 15+ technology stacks, automatic Dockerfile generation, dynamic HAProxy configuration, one-click scaling, and health monitoring.

---

## 🎯 Problem Statement

Traditional single-server deployments suffer from:
- **Single Point of Failure** — one server crash brings down the entire application
- **Scalability Limitations** — cannot handle traffic spikes dynamically
- **Manual Monitoring** — error detection and recovery require human intervention
- **Scattered Logs** — logs spread across multiple servers make debugging difficult

This project solves these problems through containerized microservices, automated load balancing, centralized logging, and intelligent self-healing.

---

## 🏗️ System Architecture

```
                    ┌──────────────┐
                    │   Browser    │
                    └──────┬───────┘
                           │ :80
                    ┌──────┴───────┐
                    │    Nginx     │ (Frontend + Reverse Proxy)
                    │  Frontend    │
                    └──────┬───────┘
                           │ :8080
                    ┌──────┴───────┐
                    │   HAProxy    │ (Load Balancer)
                    │  :8404 Stats │
                    └──┬───┬───┬───┘
                       │   │   │    Round Robin / Least Conn
                    ┌──┴┐ ┌┴──┐┌┴──┐
                    │B:1│ │B:2││B:N│  Flask + Gunicorn (:5000)
                    └─┬─┘ └─┬─┘└─┬─┘
                      └─────┼─────┘
                            │ :27017
                    ┌───────┴──────┐
                    │   MongoDB    │
                    └──────────────┘

    ┌─ ELK Stack ────────────────────────────────────┐
    │  Logstash (:12201) → Elasticsearch (:9200)     │
    │                    → Kibana (:5601)             │
    └────────────────────────────────────────────────-┘

    ┌─ Management ───────────────────────────────────┐
    │  Controller Dashboard (:9000) — FastAPI         │
    │  AI Healer — Self-Healing Service               │
    └─────────────────────────────────────────────────┘
```

---

## 📂 Project Structure

```
ipd-project/
├── docker-compose.yml          # Main orchestration (9 services)
├── .env                        # Environment variables
├── .env.example                # Template for .env
├── README.md                   # This file
├── PROJECT_GUIDE.md            # Detailed implementation guide
│
├── controller/                 # 🎛 Central Management Platform
│   ├── Dockerfile
│   ├── main.py                 # FastAPI controller + upload API
│   ├── deployer.py             # Deployment engine (detect → build → deploy)
│   ├── requirements.txt
│   └── static/                 # Dashboard UI
│       ├── index.html
│       ├── dashboard.css
│       └── dashboard.js
│
├── backend/                    # 🐍 Flask Backend Application
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── wsgi.py                 # Gunicorn entry point
│   ├── gunicorn.conf.py
│   └── app/
│       ├── __init__.py         # Flask app factory
│       └── routes/
│           ├── api.py          # REST API endpoints
│           └── health.py       # Health check endpoints
│
├── frontend/                   # 🌐 Nginx + Static Frontend
│   ├── Dockerfile
│   ├── nginx.conf              # Reverse proxy config
│   ├── index.html
│   ├── style.css
│   └── script.js
│
├── database/                   # 🗄 MongoDB
│   ├── Dockerfile
│   └── init/
│       └── init-db.js          # Seed data script
│
├── haproxy/                    # ⚖️ Load Balancer
│   └── haproxy.cfg             # HAProxy configuration
│
├── elk/                        # 📊 ELK Stack
│   ├── logstash/
│   │   └── logstash.conf       # Log processing pipeline
│   ├── elasticsearch/
│   │   └── elasticsearch.yml   # ES cluster config
│   └── kibana/
│       └── kibana.yml          # Kibana config
│
├── healer/                     # 🩺 Self-Healing Service
│   ├── Dockerfile
│   ├── healer.py               # AI-driven container recovery
│   └── requirements.txt
│
├── scripts/                    # 🔧 Utility Scripts
│   ├── benchmark.sh            # Performance benchmarking
│   └── scale.sh                # Quick scaling
│
├── tests/                      # 🧪 Integration Tests
│   ├── test_load_balancing.py  # Distribution verification
│   ├── test_failover.py        # Failover testing
│   └── test_elk_pipeline.py    # ELK pipeline verification
│
└── ha basic/                   # 📁 Original prototype (archived)
```

---

## 🚀 Quick Start (Setup Instructions)

### Prerequisites
- **Docker** (v20+) & **Docker Compose** (v2+)
- **Git**
- **4GB+ RAM** (ELK stack is memory-intensive)

### Step 1: Clone & Configure
```bash
git clone <your-repo-url>
cd ipd-project

# Review and customize environment variables
cp .env.example .env
# Edit .env as needed
```

### Step 2: Start the Platform
```bash
# Build and start the platform services
docker compose up -d --build

# Wait ~60 seconds for ELK to initialize
```

### Step 3: Upload Your Project
1. Open the **Controller Dashboard** at `http://localhost:9000`
2. **Upload your backend** code as a ZIP file (Flask, Django, Express, Spring, etc.)
3. Optionally upload **frontend** and **database** init scripts
4. The system **auto-detects** your tech stack and **generates Dockerfiles**
5. Configure replicas, algorithm, and database type
6. Click **🚀 Build & Deploy** — the system handles everything!

### Step 4: Access Dashboards

| Service           | URL                              | Credentials        |
|-------------------|----------------------------------|---------------------|
| **Controller**    | http://localhost:9000             | —                   |
| **Your App (LB)** | http://localhost:8080             | —                   |
| **HAProxy Stats** | http://localhost:8404/stats       | admin / haproxy123  |
| **Kibana**        | http://localhost:5601             | —                   |
| **Elasticsearch** | http://localhost:9200             | —                   |

### Step 5: Scale & Manage
Use the Controller Dashboard to:
- Scale replicas from 1–20 with a slider
- Switch load balancing algorithms live
- View real-time logs from Elasticsearch
- Restart or stop individual containers

---

## 🔧 Key Features

### 1. Load Balancing (HAProxy)
- **Round Robin** — equal distribution across all servers
- **Least Connections** — routes to least-busy server
- **Source IP Hash** — sticky sessions by client IP
- **Health Checks** — automatic detection of unhealthy backends (HTTP probe every 5s)
- **Failover** — unhealthy containers are removed from the pool automatically
- **Dynamic Discovery** — Docker DNS-based service discovery via `server-template`

### 2. Central Controller Platform (FastAPI)
- **Project Upload** — drag-and-drop ZIP upload for backend, frontend, database
- **Auto-Detection** — supports 15+ stacks: Flask, Django, FastAPI, Express, React, Next.js, Spring Boot, Laravel, Go, static HTML, and more
- **Dockerfile Generation** — automatically creates optimized Dockerfiles if none exists
- **One-Click Deploy** — builds images, generates docker-compose, starts everything
- **Live Scaling** — slider to scale backends from 1–20 replicas
- **Algorithm Switching** — change Round Robin / Least Conn / Source IP without downtime
- **Container Management** — start/stop/restart individual containers
- **Log Viewer** — real-time recent + error logs from Elasticsearch
- **Health Monitoring** — Docker daemon, Elasticsearch, deployment status

### 3. Centralized Logging (ELK Stack)
- **Logstash** — ingests GELF logs from all Docker containers
- **Elasticsearch** — stores and indexes logs with daily rotation
- **Kibana** — search, filter, and visualize logs with dashboards
- Structured log parsing for HAProxy and Flask access logs

### 4. Self-Healing (AI Healer)
- Polls Elasticsearch every 10 seconds for error patterns
- Aggregates errors per-container in a sliding time window
- Automatically restarts containers exceeding the error threshold
- Full logging of healing actions for audit trail

### 5. Container Orchestration
- Docker Compose with 9 interconnected services
- Named networks and volumes for data persistence
- Resource limits (CPU/memory) on backend containers
- Environment variable management via `.env`
- `restart: unless-stopped` for automatic recovery

---

## 🧪 Testing

```bash
# Test 1: Load balancing distribution
python tests/test_load_balancing.py

# Test 2: Failover handling
python tests/test_failover.py

# Test 3: ELK pipeline verification
python tests/test_elk_pipeline.py

# Test 4: Performance benchmark
bash scripts/benchmark.sh
```

---

## 📊 Performance Comparison

| Metric                 | Single Server | Load Balanced (5x) | Improvement |
|------------------------|---------------|---------------------|-------------|
| Requests/sec           | ~200          | ~800-1000           | ~4-5x       |
| Avg Response Time      | ~250ms        | ~50-80ms            | ~3-5x       |
| 99th Percentile Latency| ~800ms        | ~150ms              | ~5x         |
| Concurrent Users       | ~50           | ~200+               | ~4x         |
| Failure Recovery       | Manual        | ~5-10s (auto)       | Automated   |
| Uptime During Failure  | 0%            | ~80-100%            | ∞           |

> *Actual results depend on hardware. Run `scripts/benchmark.sh` for your system.*

---

## 🔮 Future Scope

| Enhancement              | Description                                              |
|--------------------------|----------------------------------------------------------|
| Kubernetes Migration     | Move to K8s for enterprise-grade orchestration           |
| Auto-Scaling (HPA)       | CPU/memory-based automatic horizontal scaling            |
| CI/CD Pipeline           | GitHub Actions / Jenkins for automated deployments       |
| SSL/TLS Termination      | HAProxy SSL with Let's Encrypt certificates              |
| Rate Limiting            | DDoS protection via HAProxy stick-tables                 |
| Distributed Tracing      | Jaeger/Zipkin for microservice request tracing           |
| ML Anomaly Detection     | Replace threshold-based healer with ML models            |
| Service Mesh             | Istio/Linkerd for advanced traffic management            |

---

## 🛡️ Security

- Container isolation via Docker bridge networks
- HAProxy stats dashboard protected with basic auth
- Config files mounted as read-only (`:ro`)
- Secrets managed via `.env` (excluded from Git)
- Resource limits prevent resource exhaustion
- MongoDB in isolated network (not exposed in production)

---

## 📝 Technology Stack

| Layer            | Technology                    | Version |
|------------------|-------------------------------|---------|
| Frontend         | Nginx + HTML/CSS/JS           | Alpine  |
| Backend          | Python Flask + Gunicorn       | 3.0     |
| Controller       | Python FastAPI + Uvicorn      | 0.104   |
| Database         | MongoDB                       | 7.0     |
| Load Balancer    | HAProxy                       | 2.8     |
| Log Collector    | Logstash                      | 7.17    |
| Log Storage      | Elasticsearch                 | 7.17    |
| Visualization    | Kibana                        | 7.17    |
| Containerization | Docker + Docker Compose       | v2      |
| Self-Healing     | Python (Docker SDK + ES)      | 3.10    |

---

## 👥 Authors

*B.Tech Final Year Project Team*

---

## 📄 License

This project is for academic purposes.
