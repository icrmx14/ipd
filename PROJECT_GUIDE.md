# Containerized Load Balancing System using HAProxy, Docker, and ELK Stack

## B.Tech Final Year Project — Complete System Design & Implementation Guide

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Component Deep-Dive](#3-component-deep-dive)
4. [Final Folder Structure](#4-final-folder-structure)
5. [Implementation Phases](#5-implementation-phases)
6. [Phase 1 — Core Infrastructure](#phase-1--core-infrastructure-week-1-2)
7. [Phase 2 — Load Balancing & Scaling](#phase-2--load-balancing--scaling-week-3-4)
8. [Phase 3 — ELK Stack Integration](#phase-3--elk-stack-logging--monitoring-week-5-6)
9. [Phase 4 — Self-Healing & Automation](#phase-4--self-healing--automation-week-7-8)
10. [Phase 5 — Security & Hardening](#phase-5--security--hardening-week-9)
11. [Phase 6 — Testing & Benchmarking](#phase-6--testing--benchmarking-week-10-11)
12. [Phase 7 — Documentation & Presentation](#phase-7--documentation--presentation-week-12)
13. [Testing Strategy](#6-testing-strategy)
14. [Performance Comparison](#7-performance-comparison)
15. [Future Scope](#8-future-scope)

---

## 1. Project Overview

### 1.1 Problem Statement
Modern web applications require high availability, fault tolerance, and scalability. Deploying monolithic applications on single servers creates single points of failure, performance bottlenecks, and makes scaling difficult. This project addresses these challenges by building a **centralized containerized system** that automates deployment, load balancing, logging, and monitoring.

### 1.2 Objective
To design and implement a **Main Controller Application** that:
- Accepts separate frontend, backend, and database service folders
- Automatically containerizes services using Docker
- Dynamically creates multiple backend server instances
- Integrates HAProxy for intelligent load balancing
- Provides centralized logging via the ELK Stack
- Includes self-healing capabilities through AI-driven container monitoring

### 1.3 Technology Stack

| Layer            | Technology                        | Purpose                           |
|------------------|-----------------------------------|-----------------------------------|
| Frontend         | HTML/CSS/JS + Nginx               | User interface & static serving   |
| Backend          | Python Flask                      | REST API application server       |
| Database         | MongoDB                           | Persistent data storage           |
| Load Balancer    | HAProxy 2.8                       | Traffic distribution & health     |
| Containerization | Docker + Docker Compose           | Service isolation & orchestration |
| Log Collector    | Logstash 7.17                     | Log ingestion & processing        |
| Log Storage      | Elasticsearch 7.17                | Indexed log storage & search      |
| Visualization    | Kibana 7.17                       | Dashboards & log visualization    |
| Self-Healing     | Python (Docker SDK + ES client)   | Automated container recovery      |

---

## 2. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                        │
│                     [ User / Web Browser ]                                   │
│                            │                                                 │
└────────────────────────────┼─────────────────────────────────────────────────┘
                             │ HTTP (Port 80)
                             ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    REVERSE PROXY & FRONTEND LAYER                            │
│  ┌─────────────────────┐          ┌──────────────────────────────────┐       │
│  │   Nginx (Frontend)  │ ──────►  │   HAProxy Load Balancer          │      │
│  │   Port: 80          │  API     │   Port: 8080 (LB)               │       │
│  │   Static Assets     │  Proxy   │   Port: 8404 (Stats Dashboard)  │       │
│  └─────────────────────┘          └──────────────┬───────────────────┘       │
└──────────────────────────────────────────────────┼───────────────────────────┘
                                                   │
                          ┌────────────────────────┼────────────────────────┐
                          │    Round Robin / Least Connections              │
                          ▼                        ▼                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER (Docker Network)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Flask App    │  │ Flask App    │  │ Flask App    │  │ Flask App    │     │
│  │ Container 1  │  │ Container 2  │  │ Container 3  │  │ Container N  │    │
│  │ :5000        │  │ :5000        │  │ :5000        │  │ :5000        │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                 │                 │                 │              │
└─────────┼─────────────────┼─────────────────┼─────────────────┼──────────────┘
          │                 │                 │                 │
          └─────────────────┴────────┬────────┴─────────────────┘
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         DATABASE LAYER                                       │
│                  ┌──────────────────────────┐                                │
│                  │  MongoDB Container        │                               │
│                  │  Port: 27017              │                               │
│                  │  Volume: mongo_data       │                               │
│                  └──────────────────────────┘                                │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│              LOGGING & MONITORING LAYER (ELK Stack)                          │
│                                                                              │
│  ┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐         │
│  │  Logstash    │ ──► │  Elasticsearch   │ ──► │  Kibana          │         │
│  │  Port: 12201 │     │  Port: 9200      │     │  Port: 5601      │         │
│  │  GELF Input  │     │  Log Indexing    │     │  Dashboard UI    │         │
│  └──────────────┘     └────────┬─────────┘     └──────────────────┘         │
│        ▲                       │                                             │
│        │ GELF Logs             │ Query Errors                                │
│   (All Containers)             ▼                                             │
│                      ┌──────────────────┐                                    │
│                      │  AI Healer       │ ──► Docker Socket                  │
│                      │  Self-Healing    │     (Restart Containers)            │
│                      └──────────────────┘                                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Data Flow

1. **User → Nginx** — Browser sends HTTP request to port 80
2. **Nginx → HAProxy** — Nginx reverse-proxies API calls to HAProxy on port 8080
3. **HAProxy → Flask Containers** — HAProxy distributes requests using round-robin/least-conn
4. **Flask → MongoDB** — Application reads/writes data to the database
5. **All Containers → Logstash** — GELF log driver sends container logs to Logstash (UDP 12201)
6. **Logstash → Elasticsearch** — Logstash parses and indexes logs
7. **Elasticsearch → Kibana** — Kibana reads from ES for visualization
8. **Elasticsearch → AI Healer** — Healer queries error logs, restarts unhealthy containers

---

## 3. Component Deep-Dive

### 3.1 HAProxy Load Balancer
| Feature             | Implementation                                     |
|---------------------|-----------------------------------------------------|
| Algorithm           | Round Robin (default), switchable to Least Connections |
| Health Checks       | `check inter 5s fall 3 rise 2` on each backend      |
| Service Discovery   | `server-template` with Docker DNS resolver           |
| Stats Dashboard     | Built-in dashboard at `:8404/stats`                  |
| Failover            | Automatic removal of unhealthy backends              |

### 3.2 ELK Stack
| Component       | Role                                                        |
|-----------------|-------------------------------------------------------------|
| **Logstash**    | Receives GELF logs on UDP 12201, adds filters, forwards     |
| **Elasticsearch** | Stores logs in daily indices (`logstash-YYYY.MM.dd`)      |
| **Kibana**      | Provides dashboards: request rates, error rates, container health |

### 3.3 AI Healer (Self-Healing Service)
- Polls Elasticsearch every 10 seconds
- Queries for 500-error logs within a 30-second window
- Aggregates errors by container ID
- If errors ≥ threshold (3), automatically restarts the container via Docker Socket
- Logs all healing actions for audit trail

---

## 4. Final Folder Structure

```
d:\ipd-project\
│
├── README.md                         # Project overview and setup instructions
├── PROJECT_GUIDE.md                  # This comprehensive guide
├── .env                              # Environment variables (secrets, configs)
├── .gitignore                        # Git ignore rules
│
├── docker-compose.yml                # Main orchestration file
├── docker-compose.prod.yml           # Production overrides
│
├── frontend/                         # Frontend (Nginx-served)
│   ├── Dockerfile                    # Nginx + static files
│   ├── nginx.conf                    # Nginx reverse proxy config
│   ├── index.html                    # Main dashboard page
│   ├── style.css                     # Styling
│   └── script.js                     # Frontend logic
│
├── backend/                          # Flask Backend Application
│   ├── Dockerfile                    # Python slim + dependencies
│   ├── requirements.txt              # Flask, pymongo, flask-cors, gunicorn
│   ├── app/
│   │   ├── __init__.py               # Flask app factory
│   │   ├── config.py                 # Configuration management
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── api.py                # REST API endpoints
│   │   │   └── health.py             # Health check endpoint
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── item.py               # Data models
│   │   └── utils/
│   │       ├── __init__.py
│   │       └── logger.py             # Structured logging helper
│   ├── tests/
│   │   ├── test_api.py               # API unit tests
│   │   └── test_health.py            # Health check tests
│   └── gunicorn.conf.py              # Gunicorn production config
│
├── database/                         # Database
│   ├── Dockerfile                    # MongoDB with init scripts
│   └── init/
│       └── init-db.js                # Seed data / collection setup
│
├── haproxy/                          # Load Balancer
│   └── haproxy.cfg                   # HAProxy configuration
│
├── elk/                              # ELK Stack Configs
│   ├── logstash/
│   │   └── logstash.conf             # Logstash pipeline configuration
│   ├── elasticsearch/
│   │   └── elasticsearch.yml         # ES cluster settings
│   └── kibana/
│       └── kibana.yml                # Kibana settings
│
├── healer/                           # Self-Healing Service
│   ├── Dockerfile                    # Python slim + docker/elasticsearch
│   ├── requirements.txt              # docker, elasticsearch, requests
│   └── healer.py                     # AI-driven self-healing logic
│
├── scripts/                          # Utility Scripts
│   ├── scale.sh                      # Scale backend containers
│   ├── benchmark.sh                  # Performance benchmarking
│   ├── health-check.sh               # Manual health check
│   └── setup-kibana-dashboards.sh    # Auto-import Kibana dashboards
│
├── docs/                             # Documentation
│   ├── architecture-diagram.png      # System architecture diagram
│   ├── api-documentation.md          # API endpoint docs
│   ├── setup-guide.md                # Installation & setup guide
│   ├── benchmarks/                   # Performance test results
│   │   ├── single-server-results.md
│   │   └── load-balanced-results.md
│   └── presentation/                 # PPT/PDF for viva
│       └── slides.md
│
└── tests/                            # Integration / E2E Tests
    ├── test_load_balancing.py         # Verify round-robin distribution
    ├── test_failover.py              # Verify failover on container death
    ├── test_elk_pipeline.py          # Verify logs reach Elasticsearch
    └── test_healer.py                # Verify self-healing triggers
```

---

## 5. Implementation Phases

### Phase 1 — Core Infrastructure (Week 1-2)

**Goal:** Build the foundational containerized backend + database + frontend.

#### Step 1.1 — Restructure Backend with Flask App Factory

Create a proper Flask application using the **App Factory** pattern for production readiness.

**File: `backend/app/__init__.py`**
```python
from flask import Flask
from flask_cors import CORS
from flask_pymongo import PyMongo

mongo = PyMongo()

def create_app(config_name='development'):
    app = Flask(__name__)
    
    # Load configuration
    if config_name == 'production':
        app.config.from_object('app.config.ProductionConfig')
    else:
        app.config.from_object('app.config.DevelopmentConfig')
    
    # Initialize extensions
    CORS(app)
    mongo.init_app(app)
    
    # Register blueprints
    from app.routes.api import api_bp
    from app.routes.health import health_bp
    app.register_blueprint(api_bp, url_prefix='/api')
    app.register_blueprint(health_bp, url_prefix='/health')
    
    return app
```

**File: `backend/app/config.py`**
```python
import os

class BaseConfig:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key')
    MONGO_URI = os.environ.get('MONGO_URI', 'mongodb://mongodb:27017/appdb')

class DevelopmentConfig(BaseConfig):
    DEBUG = True

class ProductionConfig(BaseConfig):
    DEBUG = False
```

**File: `backend/app/routes/api.py`**
```python
from flask import Blueprint, jsonify, request
from app import mongo
import socket
import datetime

api_bp = Blueprint('api', __name__)
HOSTNAME = socket.gethostname()

@api_bp.route('/', methods=['GET'])
def index():
    return jsonify({
        "server_id": HOSTNAME,
        "message": f"Hello from container {HOSTNAME}!",
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    })

@api_bp.route('/items', methods=['GET'])
def get_items():
    items = list(mongo.db.items.find({}, {'_id': 0}))
    return jsonify({"items": items, "server_id": HOSTNAME})

@api_bp.route('/items', methods=['POST'])
def create_item():
    data = request.get_json()
    mongo.db.items.insert_one({
        "name": data.get("name"),
        "description": data.get("description"),
        "created_at": datetime.datetime.now(),
        "server_id": HOSTNAME
    })
    return jsonify({"status": "created", "server_id": HOSTNAME}), 201
```

**File: `backend/app/routes/health.py`**
```python
from flask import Blueprint, jsonify
import socket
import psutil  # optional: for system metrics
import datetime

health_bp = Blueprint('health', __name__)
HOSTNAME = socket.gethostname()

@health_bp.route('/', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "server_id": HOSTNAME,
        "timestamp": datetime.datetime.now().isoformat(),
        "uptime": "running"
    })

@health_bp.route('/ready', methods=['GET'])
def readiness_check():
    """Check if the service is ready to accept traffic."""
    try:
        from app import mongo
        mongo.db.command('ping')
        db_status = "connected"
    except Exception:
        db_status = "disconnected"
        return jsonify({"status": "not_ready", "database": db_status}), 503

    return jsonify({
        "status": "ready",
        "database": db_status,
        "server_id": HOSTNAME
    })
```

**File: `backend/Dockerfile`**
```dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose Flask port
EXPOSE 5000

# Production: use Gunicorn
CMD ["gunicorn", "--config", "gunicorn.conf.py", "wsgi:app"]
```

**File: `backend/wsgi.py`**
```python
from app import create_app
app = create_app()
```

**File: `backend/gunicorn.conf.py`**
```python
import multiprocessing

bind = "0.0.0.0:5000"
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "sync"
timeout = 120
accesslog = "-"
errorlog = "-"
loglevel = "info"
```

**File: `backend/requirements.txt`**
```
Flask==3.0.0
Flask-Cors==4.0.0
flask-pymongo==2.3.0
gunicorn==21.2.0
requests==2.31.0
```

#### Step 1.2 — Database Setup

**File: `database/Dockerfile`**
```dockerfile
FROM mongo:7.0

# Copy initialization script
COPY init/init-db.js /docker-entrypoint-initdb.d/

EXPOSE 27017
```

**File: `database/init/init-db.js`**
```javascript
// Initialize the application database and seed some data
db = db.getSiblingDB('appdb');

// Create collections
db.createCollection('items');
db.createCollection('logs');

// Seed initial data
db.items.insertMany([
    { name: "Sample Item 1", description: "This is a demo item", created_at: new Date() },
    { name: "Sample Item 2", description: "Another demo item", created_at: new Date() },
    { name: "Sample Item 3", description: "Third demo item", created_at: new Date() }
]);

print("✅ Database initialized with seed data!");
```

#### Step 1.3 — Frontend with Nginx Reverse Proxy

**File: `frontend/Dockerfile`**
```dockerfile
FROM nginx:alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/

# Copy frontend static files
COPY index.html /usr/share/nginx/html/
COPY style.css  /usr/share/nginx/html/
COPY script.js  /usr/share/nginx/html/

EXPOSE 80
```

**File: `frontend/nginx.conf`**
```nginx
server {
    listen 80;
    server_name localhost;

    # Serve static frontend files
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Reverse proxy API calls to HAProxy
    location /api/ {
        proxy_pass http://haproxy:8080/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Proxy health endpoint
    location /health/ {
        proxy_pass http://haproxy:8080/health/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

### Phase 2 — Load Balancing & Scaling (Week 3-4)

**Goal:** Configure HAProxy with advanced load balancing, health checks, and dynamic scaling.

#### Step 2.1 — Enhanced HAProxy Configuration

**File: `haproxy/haproxy.cfg`**
```
#---------------------------------------------------------------------
# Global settings
#---------------------------------------------------------------------
global
    log stdout format raw local0
    maxconn 4096

    # Docker's internal DNS resolver for service discovery
    resolvers docker_resolver
        nameserver dns 127.0.0.11:53
        resolve_retries 3
        timeout resolve 1s
        timeout retry   1s
        hold valid      10s

#---------------------------------------------------------------------
# Default settings
#---------------------------------------------------------------------
defaults
    log     global
    mode    http
    option  httplog
    option  dontlognull
    option  forwardfor
    timeout connect  5000ms
    timeout client   50000ms
    timeout server   50000ms
    timeout check    3000ms
    
    # Enable detailed error pages
    errorfile 400 /usr/local/etc/haproxy/errors/400.http
    errorfile 503 /usr/local/etc/haproxy/errors/503.http

#---------------------------------------------------------------------
# Stats Dashboard — accessible at :8404/stats
#---------------------------------------------------------------------
frontend stats
    bind *:8404
    stats enable
    stats uri /stats
    stats refresh 5s
    stats show-legends
    stats show-node
    stats auth admin:haproxy123    # Basic auth for security

#---------------------------------------------------------------------
# Main HTTP Frontend
#---------------------------------------------------------------------
frontend http_front
    bind *:8080
    
    # Add request ID for tracing
    unique-id-format %{+X}o\ %ci:%cp_%fi:%fp_%Ts_%rt:%pid
    unique-id-header X-Request-ID
    
    # Logging
    log-format "%ID %ci:%cp [%tr] %ft %b/%s %TR/%Tw/%Tc/%Tr/%Ta %ST %B %CC %CS %tsc %ac/%fc/%bc/%sc/%rc %sq/%bq %hr %hs %{+Q}r"
    
    default_backend http_back

#---------------------------------------------------------------------
# Backend Server Pool
#---------------------------------------------------------------------
backend http_back
    # Load Balancing Algorithm: roundrobin | leastconn | source
    balance roundrobin
    
    # Sticky Sessions (optional — enable if your app needs it)
    # cookie SERVERID insert indirect nocache
    
    # Health Check Configuration
    option httpchk GET /health/
    http-check expect status 200
    
    # Default server settings
    default-server inter 5s fall 3 rise 2 maxconn 100
    
    # Dynamic server discovery using Docker DNS
    # The number (10) should match or exceed your replica count
    server-template backend 10 backend:5000 check resolvers docker_resolver init-addr none
```

#### Step 2.2 — Docker Compose with Scaling

**File: `docker-compose.yml`**
```yaml
version: "3.8"

services:
  # ──────────── FRONTEND (Nginx) ────────────
  frontend:
    build: ./frontend
    container_name: frontend
    ports:
      - "80:80"
    depends_on:
      - haproxy
    networks:
      - app-network
    logging:
      driver: gelf
      options:
        gelf-address: "udp://localhost:12201"
        tag: "frontend"
    restart: unless-stopped

  # ──────────── LOAD BALANCER (HAProxy) ────────────
  haproxy:
    image: haproxy:2.8-alpine
    container_name: haproxy
    ports:
      - "8080:8080"   # Load balanced traffic
      - "8404:8404"   # Stats dashboard
    volumes:
      - ./haproxy/haproxy.cfg:/usr/local/etc/haproxy/haproxy.cfg:ro
    depends_on:
      - backend
    networks:
      - app-network
    logging:
      driver: gelf
      options:
        gelf-address: "udp://localhost:12201"
        tag: "haproxy"
    restart: unless-stopped

  # ──────────── BACKEND (Flask + Gunicorn) ────────────
  backend:
    build: ./backend
    deploy:
      replicas: 5                       # Start with 5 instances
      resources:
        limits:
          cpus: "0.50"
          memory: 256M
        reservations:
          cpus: "0.25"
          memory: 128M
    environment:
      - FLASK_ENV=production
      - MONGO_URI=mongodb://mongodb:27017/appdb
      - PYTHONUNBUFFERED=1
    depends_on:
      - mongodb
    networks:
      - app-network
    logging:
      driver: gelf
      options:
        gelf-address: "udp://localhost:12201"
        tag: "backend"
    restart: unless-stopped

  # ──────────── DATABASE (MongoDB) ────────────
  mongodb:
    build: ./database
    container_name: mongodb
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    environment:
      - MONGO_INITDB_DATABASE=appdb
    networks:
      - app-network
    restart: unless-stopped

  # ──────────── ELASTICSEARCH ────────────
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:7.17.10
    container_name: elasticsearch
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
      - xpack.security.enabled=false
    volumes:
      - es_data:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"
    networks:
      - app-network
    restart: unless-stopped

  # ──────────── LOGSTASH ────────────
  logstash:
    image: docker.elastic.co/logstash/logstash:7.17.10
    container_name: logstash
    ports:
      - "12201:12201/udp"
    volumes:
      - ./elk/logstash/logstash.conf:/usr/share/logstash/pipeline/logstash.conf:ro
    depends_on:
      - elasticsearch
    networks:
      - app-network
    restart: unless-stopped

  # ──────────── KIBANA ────────────
  kibana:
    image: docker.elastic.co/kibana/kibana:7.17.10
    container_name: kibana
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    depends_on:
      - elasticsearch
    networks:
      - app-network
    restart: unless-stopped

  # ──────────── AI HEALER ────────────
  ai-healer:
    build: ./healer
    container_name: ai-healer
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    depends_on:
      - elasticsearch
      - backend
    environment:
      - ES_HOST=http://elasticsearch:9200
      - CHECK_INTERVAL=10
      - ERROR_THRESHOLD=3
      - LOOKBACK_SECONDS=30
      - PYTHONUNBUFFERED=1
    networks:
      - app-network
    restart: unless-stopped

# ──────────── NETWORKS ────────────
networks:
  app-network:
    driver: bridge

# ──────────── VOLUMES ────────────
volumes:
  mongo_data:
    driver: local
  es_data:
    driver: local
```

#### Step 2.3 — Scaling Commands

```bash
# Scale backend to 10 instances
docker compose up -d --scale backend=10

# Scale down to 3 instances
docker compose up -d --scale backend=3

# View running containers
docker compose ps

# View HAProxy stats
# Open browser: http://localhost:8404/stats
```

---

### Phase 3 — ELK Stack Logging & Monitoring (Week 5-6)

**Goal:** Set up centralized logging with structured log processing.

#### Step 3.1 — Enhanced Logstash Pipeline

**File: `elk/logstash/logstash.conf`**
```
input {
    gelf {
        port => 12201
        type => "docker"
    }
}

filter {
    # Add hostname and environment metadata
    mutate {
        add_field => {
            "environment" => "production"
            "project" => "ipd-loadbalancer"
        }
    }
    
    # Parse HTTP access logs from HAProxy
    if [tag] == "haproxy" {
        grok {
            match => {
                "message" => "%{IP:client_ip}:%{INT:client_port} \[%{HAPROXYDATE:accept_date}\] %{NOTSPACE:frontend} %{NOTSPACE:backend_server} %{INT:time_request}/%{INT:time_queue}/%{INT:time_connect}/%{INT:time_response}/%{INT:time_total} %{INT:http_status_code} %{INT:bytes_read}"
            }
            tag_on_failure => ["_haproxy_parse_failure"]
        }
        
        if [http_status_code] {
            mutate {
                convert => { "http_status_code" => "integer" }
                convert => { "time_total" => "integer" }
                convert => { "bytes_read" => "integer" }
            }
        }
    }
    
    # Parse Flask application logs
    if [tag] == "backend" {
        grok {
            match => {
                "message" => "%{IP:remote_addr} - - \[%{HTTPDATE:timestamp}\] \"%{WORD:method} %{URIPATHPARAM:request} HTTP/%{NUMBER:http_version}\" %{INT:status_code} %{INT:response_size}"
            }
            tag_on_failure => ["_flask_parse_failure"]
        }
        
        if [status_code] {
            mutate {
                convert => { "status_code" => "integer" }
            }
            
            # Tag error responses
            if [status_code] >= 500 {
                mutate {
                    add_tag => ["server_error"]
                }
            } else if [status_code] >= 400 {
                mutate {
                    add_tag => ["client_error"]
                }
            }
        }
    }
}

output {
    elasticsearch {
        hosts => ["elasticsearch:9200"]
        index => "logstash-%{+YYYY.MM.dd}"
    }
    
    # Optional: output to stdout for debugging
    # stdout { codec => rubydebug }
}
```

#### Step 3.2 — Kibana Dashboard Setup

After deploying, create these dashboards in Kibana (`http://localhost:5601`):

| Dashboard               | Visualizations                                              |
|--------------------------|-------------------------------------------------------------|
| **System Overview**      | Total requests, error rate, active containers               |
| **Load Balancer Stats**  | Requests per backend, response time distribution            |
| **Error Analysis**       | 4xx/5xx errors over time, top error endpoints               |
| **Container Health**     | Per-container request count, restart events                 |
| **Self-Healing Log**     | Healing events timeline, containers healed count            |

---

### Phase 4 — Self-Healing & Automation (Week 7-8)

**Goal:** Build the AI-driven self-healing service.

#### Step 4.1 — Enhanced Healer

**File: `healer/healer.py`**
```python
"""
AI-Driven Self-Healing Service
Monitors Elasticsearch for error patterns and automatically
restarts unhealthy containers.
"""

import time
import os
import logging
import docker
from elasticsearch import Elasticsearch
from datetime import datetime, timedelta

# ──────────── Configuration ────────────
ES_HOST = os.environ.get("ES_HOST", "http://elasticsearch:9200")
CHECK_INTERVAL = int(os.environ.get("CHECK_INTERVAL", 10))
ERROR_THRESHOLD = int(os.environ.get("ERROR_THRESHOLD", 3))
LOOKBACK_SECONDS = int(os.environ.get("LOOKBACK_SECONDS", 30))

# ──────────── Logging ────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [HEALER] %(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)

# ──────────── Clients ────────────
docker_client = docker.from_env()
es = Elasticsearch([ES_HOST])

# ──────────── Healing Stats ────────────
healing_stats = {
    "total_checks": 0,
    "total_heals": 0,
    "failed_heals": 0,
    "last_heal_time": None,
    "healed_containers": {}
}


def wait_for_elasticsearch(max_retries=30, delay=10):
    """Wait for Elasticsearch to become available."""
    for attempt in range(max_retries):
        try:
            if es.ping():
                logger.info("✅ Connected to Elasticsearch")
                return True
        except Exception:
            pass
        logger.info(f"⏳ Waiting for Elasticsearch... (attempt {attempt + 1}/{max_retries})")
        time.sleep(delay)
    
    logger.error("❌ Could not connect to Elasticsearch")
    return False


def get_error_counts():
    """Query Elasticsearch for containers with high error rates."""
    now = datetime.utcnow()
    past = now - timedelta(seconds=LOOKBACK_SECONDS)
    
    query = {
        "size": 0,
        "query": {
            "bool": {
                "must": [
                    {
                        "bool": {
                            "should": [
                                {"match": {"message": "500"}},
                                {"match": {"message": "502"}},
                                {"match": {"message": "503"}},
                                {"match_phrase": {"message": "Internal Server Error"}},
                                {"match_phrase": {"message": "Traceback"}}
                            ]
                        }
                    },
                    {
                        "range": {
                            "@timestamp": {
                                "gte": past.isoformat(),
                                "lte": now.isoformat()
                            }
                        }
                    }
                ]
            }
        },
        "aggs": {
            "bad_containers": {
                "terms": {
                    "field": "host.keyword",
                    "size": 20
                }
            }
        }
    }
    
    try:
        response = es.search(index="logstash-*", body=query)
        return response['aggregations']['bad_containers']['buckets']
    except Exception as e:
        logger.error(f"Error querying Elasticsearch: {e}")
        return []


def restart_container(container_id):
    """Restart a Docker container by its ID."""
    try:
        container = docker_client.containers.get(container_id)
        container_name = container.name
        
        logger.warning(f"🔄 Restarting container: {container_name} ({container_id[:12]})")
        container.restart(timeout=10)
        
        logger.info(f"✅ Successfully restarted: {container_name}")
        
        # Update stats
        healing_stats["total_heals"] += 1
        healing_stats["last_heal_time"] = datetime.now().isoformat()
        healing_stats["healed_containers"][container_id] = {
            "name": container_name,
            "healed_at": datetime.now().isoformat(),
            "count": healing_stats["healed_containers"].get(container_id, {}).get("count", 0) + 1
        }
        
        return True
    except docker.errors.NotFound:
        logger.error(f"❌ Container {container_id[:12]} not found")
        healing_stats["failed_heals"] += 1
        return False
    except Exception as e:
        logger.error(f"❌ Failed to restart container {container_id[:12]}: {e}")
        healing_stats["failed_heals"] += 1
        return False


def heal_system():
    """Main healing cycle: check for errors and restart unhealthy containers."""
    healing_stats["total_checks"] += 1
    
    logger.info(f"🔍 Scan #{healing_stats['total_checks']} — Checking system health...")
    
    bad_containers = get_error_counts()
    
    if not bad_containers:
        logger.info("💚 All containers healthy")
        return
    
    for bucket in bad_containers:
        container_id = bucket['key']
        error_count = bucket['doc_count']
        
        if error_count >= ERROR_THRESHOLD:
            logger.warning(
                f"⚠️  Container {container_id[:12]} has {error_count} errors "
                f"(threshold: {ERROR_THRESHOLD}). Initiating self-healing..."
            )
            restart_container(container_id)
        else:
            logger.info(
                f"🟡 Container {container_id[:12]} has {error_count} errors "
                f"(below threshold of {ERROR_THRESHOLD})"
            )


def print_stats():
    """Print healing statistics."""
    logger.info("📊 Healing Statistics:")
    logger.info(f"   Total checks:  {healing_stats['total_checks']}")
    logger.info(f"   Total heals:   {healing_stats['total_heals']}")
    logger.info(f"   Failed heals:  {healing_stats['failed_heals']}")
    logger.info(f"   Last heal:     {healing_stats['last_heal_time'] or 'Never'}")


if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("🚀 AI Self-Healing Service Starting...")
    logger.info(f"   ES Host:        {ES_HOST}")
    logger.info(f"   Check Interval: {CHECK_INTERVAL}s")
    logger.info(f"   Error Threshold: {ERROR_THRESHOLD}")
    logger.info(f"   Lookback Window: {LOOKBACK_SECONDS}s")
    logger.info("=" * 60)
    
    if not wait_for_elasticsearch():
        exit(1)
    
    cycle_count = 0
    while True:
        heal_system()
        cycle_count += 1
        
        # Print stats every 10 cycles
        if cycle_count % 10 == 0:
            print_stats()
        
        time.sleep(CHECK_INTERVAL)
```

**File: `healer/Dockerfile`**
```dockerfile
FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY healer.py .

CMD ["python", "healer.py"]
```

**File: `healer/requirements.txt`**
```
elasticsearch<8.0.0
docker>=6.0.0
requests>=2.31.0
```

---

### Phase 5 — Security & Hardening (Week 9)

**Goal:** Secure the system for production readiness.

#### 5.1 Security Measures

| Area                    | Implementation                                           |
|-------------------------|----------------------------------------------------------|
| **Container Isolation** | Separate Docker network, no `--privileged` mode          |
| **HAProxy Auth**        | Basic auth on stats dashboard (`admin:haproxy123`)       |
| **Kibana Auth**         | Nginx reverse proxy with basic auth in front of Kibana   |
| **MongoDB Auth**        | `MONGO_INITDB_ROOT_USERNAME` + `PASSWORD` env vars       |
| **Secrets Management**  | Use `.env` file (excluded from git)                      |
| **Network Policies**    | Only expose necessary ports (80, 8404, 5601)             |
| **Read-only Volumes**   | Config files mounted as `:ro` (read-only)                |
| **Resource Limits**     | CPU & memory limits on backend containers                |

#### 5.2 Environment Variables File

**File: `.env`**
```env
# MongoDB
MONGO_ROOT_USER=admin
MONGO_ROOT_PASS=secure_mongo_password_123
MONGO_DB=appdb

# HAProxy
HAPROXY_STATS_USER=admin
HAPROXY_STATS_PASS=haproxy123

# Elasticsearch
ES_JAVA_OPTS=-Xms512m -Xmx512m

# Flask
FLASK_SECRET_KEY=your-very-secret-key-here
FLASK_ENV=production

# Healer
ERROR_THRESHOLD=3
CHECK_INTERVAL=10
LOOKBACK_SECONDS=30
```

---

### Phase 6 — Testing & Benchmarking (Week 10-11)

**Goal:** Validate the system and generate performance benchmarks.

#### 6.1 Test Script: Load Balancing Verification

**File: `tests/test_load_balancing.py`**
```python
"""
Test: Verify that HAProxy distributes requests across all backend containers.
"""
import requests
from collections import Counter

def test_round_robin_distribution():
    """Send 100 requests and verify distribution across backends."""
    url = "http://localhost:8080/api/"
    server_hits = Counter()
    
    total_requests = 100
    
    for i in range(total_requests):
        try:
            response = requests.get(url, timeout=5)
            data = response.json()
            server_hits[data["server_id"]] += 1
        except Exception as e:
            print(f"Request {i} failed: {e}")
    
    print("\n" + "=" * 60)
    print("LOAD BALANCING TEST RESULTS")
    print("=" * 60)
    print(f"Total Requests: {total_requests}")
    print(f"Unique Servers Hit: {len(server_hits)}")
    print("-" * 40)
    
    for server, count in sorted(server_hits.items()):
        pct = (count / total_requests) * 100
        bar = "█" * int(pct / 2)
        print(f"  {server:20s} → {count:3d} hits ({pct:.1f}%) {bar}")
    
    print("-" * 40)
    
    # Verify: all backends received at least some traffic
    assert len(server_hits) > 1, "FAIL: Traffic went to only one server!"
    print("✅ PASSED: Traffic distributed across multiple backends")


if __name__ == "__main__":
    test_round_robin_distribution()
```

#### 6.2 Test Script: Failover

**File: `tests/test_failover.py`**
```python
"""
Test: Verify that the system handles container failures gracefully.
"""
import requests
import subprocess
import time

def test_failover():
    """Stop a backend container and verify traffic redirects."""
    url = "http://localhost:8080/api/"
    
    # 1. Get initial server list
    initial_servers = set()
    for _ in range(20):
        r = requests.get(url, timeout=5)
        initial_servers.add(r.json()["server_id"])
    
    print(f"Active servers before failure: {len(initial_servers)}")
    
    # 2. Kill one container
    target = list(initial_servers)[0]
    print(f"Simulating failure of: {target}")
    subprocess.run(["docker", "stop", target], capture_output=True)
    
    time.sleep(10)  # Wait for HAProxy to detect failure
    
    # 3. Verify traffic still works
    post_failure_servers = set()
    failures = 0
    for _ in range(20):
        try:
            r = requests.get(url, timeout=5)
            post_failure_servers.add(r.json()["server_id"])
        except Exception:
            failures += 1
    
    print(f"Active servers after failure: {len(post_failure_servers)}")
    print(f"Failed requests: {failures}")
    
    assert target not in post_failure_servers, "FAIL: Dead server still receiving traffic!"
    assert failures < 5, f"FAIL: Too many failed requests ({failures})"
    print("✅ PASSED: Failover working correctly")
    
    # 4. Restore the container
    subprocess.run(["docker", "start", target], capture_output=True)
    print(f"Restored container: {target}")


if __name__ == "__main__":
    test_failover()
```

#### 6.3 Benchmark Script

**File: `scripts/benchmark.sh`**
```bash
#!/bin/bash
# Performance Benchmark: Single Server vs Load Balanced
# Requires: Apache Benchmark (ab) — install with: apt install apache2-utils

echo "=============================================="
echo "  PERFORMANCE BENCHMARK"
echo "=============================================="

TOTAL_REQUESTS=1000
CONCURRENT=50
URL="http://localhost:8080/api/"

echo ""
echo "▶ Test Parameters:"
echo "  Total Requests:  $TOTAL_REQUESTS"
echo "  Concurrency:     $CONCURRENT"
echo "  Target URL:      $URL"
echo ""

echo "──────────────────────────────────────────────"
echo "  TEST 1: Load Balanced (5 replicas)"
echo "──────────────────────────────────────────────"
docker compose up -d --scale backend=5
sleep 10
ab -n $TOTAL_REQUESTS -c $CONCURRENT -g lb_results.tsv $URL
echo ""

echo "──────────────────────────────────────────────"
echo "  TEST 2: Single Server (1 replica)"
echo "──────────────────────────────────────────────"
docker compose up -d --scale backend=1
sleep 10
ab -n $TOTAL_REQUESTS -c $CONCURRENT -g single_results.tsv $URL
echo ""

echo "──────────────────────────────────────────────"
echo "  Restoring 5 replicas..."
echo "──────────────────────────────────────────────"
docker compose up -d --scale backend=5

echo ""
echo "✅ Benchmark complete! Compare:"
echo "   - lb_results.tsv (load balanced)"
echo "   - single_results.tsv (single server)"
```

---

### Phase 7 — Documentation & Presentation (Week 12)

**Goal:** Prepare all academic deliverables.

| Deliverable                    | Location                        |
|--------------------------------|---------------------------------|
| System Architecture Diagram    | `docs/architecture-diagram.png` |
| API Documentation              | `docs/api-documentation.md`     |
| Setup & Installation Guide     | `docs/setup-guide.md`           |
| Benchmark Results              | `docs/benchmarks/`              |
| Presentation Slides            | `docs/presentation/`            |
| Source Code (complete)         | GitHub repository                |

---

## 6. Testing Strategy

| Test Type          | What to Test                                | Tool                    |
|--------------------|---------------------------------------------|-------------------------|
| **Unit Tests**     | Flask routes, database CRUD                 | `pytest`                |
| **Integration**    | API → HAProxy → Backend → MongoDB pipeline  | `requests` + Python     |
| **Load Testing**   | Throughput, latency, concurrency            | Apache Benchmark (`ab`) |
| **Failover**       | Container kill → traffic rerouting          | `docker stop` + scripts |
| **Log Pipeline**   | Logs flow: Container → Logstash → ES       | Kibana verification     |
| **Security**       | Auth on dashboards, container isolation     | Manual verification     |

---

## 7. Performance Comparison

### Expected Results Table

| Metric                    | Single Server | Load Balanced (5x) | Improvement    |
|---------------------------|---------------|---------------------|----------------|
| Requests/sec              | ~200          | ~800-1000           | **4-5x**       |
| Avg Response Time         | ~250ms        | ~50-80ms            | **3-5x**       |
| 99th Percentile Latency   | ~800ms        | ~150ms              | **5x**         |
| Concurrent Users Handled  | ~50           | ~200+               | **4x**         |
| Failure Recovery Time     | Manual        | ~5-10s (automatic)  | **Automated**  |
| Uptime During Failure     | 0%            | ~80-100%            | **∞**          |

> *These are representative estimates. Actual results depend on your hardware.*

---

## 8. Future Scope

| Enhancement                        | Description                                                |
|------------------------------------|------------------------------------------------------------|
| **Kubernetes Migration**           | Move from Docker Compose to Kubernetes for enterprise orchestration |
| **Auto-Scaling**                   | Implement CPU/memory-based automatic horizontal scaling    |
| **CI/CD Pipeline**                 | GitHub Actions / Jenkins for automated build, test, deploy |
| **SSL/TLS Termination**           | HAProxy SSL termination with Let's Encrypt certificates    |
| **Rate Limiting**                  | HAProxy stick-tables for DDoS protection                   |
| **Distributed Tracing**           | Jaeger / Zipkin integration for microservice tracing       |
| **ML-Based Anomaly Detection**    | Replace threshold-based healer with ML anomaly detection   |
| **Multi-Region Deployment**       | Geographic load balancing with DNS-based routing           |
| **Service Mesh**                   | Istio/Linkerd for advanced traffic management              |
| **GitOps**                         | ArgoCD for declarative infrastructure management           |

---

## Quick Start Commands

```bash
# 1. Clone and navigate
cd d:\ipd-project

# 2. Start the entire stack
docker compose up -d --build

# 3. Scale backends
docker compose up -d --scale backend=10

# 4. View services
docker compose ps

# 5. Access points
#    Frontend:        http://localhost:80
#    HAProxy LB:      http://localhost:8080
#    HAProxy Stats:   http://localhost:8404/stats (admin/haproxy123)
#    Kibana:          http://localhost:5601
#    Elasticsearch:   http://localhost:9200
#    MongoDB:         localhost:27017

# 6. View logs
docker compose logs -f backend
docker compose logs -f haproxy
docker compose logs -f ai-healer

# 7. Stop everything
docker compose down

# 8. Stop and remove volumes (full reset)
docker compose down -v
```
