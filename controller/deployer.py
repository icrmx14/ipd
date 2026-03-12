"""
Deployment Engine — Auto-detects tech stack, generates Dockerfiles,
builds images, and deploys user-uploaded projects with HAProxy load balancing.
"""

import os
import re
import json
import shutil
import zipfile
import subprocess
import logging
from pathlib import Path
from datetime import datetime
from typing import Optional

logger = logging.getLogger("deployer")

# Where uploaded projects are stored and built
WORKSPACE_DIR = "/workspace/projects"
HAPROXY_CFG_PATH = os.environ.get("HAPROXY_CFG_PATH", "/config/haproxy.cfg")
HAPROXY_TEMPLATE_PATH = os.environ.get("HAPROXY_TEMPLATE_PATH", "/app/templates/haproxy.cfg.template")


# ═══════════════════════════════════════════════════════════
#  TECH STACK DETECTION
# ═══════════════════════════════════════════════════════════

STACK_SIGNATURES = {
    # Python stacks
    "flask": {
        "files": ["requirements.txt"],
        "content_hints": {"requirements.txt": ["flask", "Flask"]},
        "type": "python",
        "framework": "flask",
        "default_port": 5000,
    },
    "django": {
        "files": ["requirements.txt", "manage.py"],
        "content_hints": {"requirements.txt": ["django", "Django"]},
        "type": "python",
        "framework": "django",
        "default_port": 8000,
    },
    "fastapi": {
        "files": ["requirements.txt"],
        "content_hints": {"requirements.txt": ["fastapi", "FastAPI"]},
        "type": "python",
        "framework": "fastapi",
        "default_port": 8000,
    },
    "python_generic": {
        "files": ["requirements.txt"],
        "content_hints": {},
        "type": "python",
        "framework": "generic",
        "default_port": 5000,
    },
    # Node.js stacks
    "express": {
        "files": ["package.json"],
        "content_hints": {"package.json": ["express"]},
        "type": "nodejs",
        "framework": "express",
        "default_port": 3000,
    },
    "react": {
        "files": ["package.json"],
        "content_hints": {"package.json": ["react", "react-dom"]},
        "type": "nodejs",
        "framework": "react",
        "default_port": 3000,
    },
    "nextjs": {
        "files": ["package.json"],
        "content_hints": {"package.json": ["next"]},
        "type": "nodejs",
        "framework": "nextjs",
        "default_port": 3000,
    },
    "nodejs_generic": {
        "files": ["package.json"],
        "content_hints": {},
        "type": "nodejs",
        "framework": "generic",
        "default_port": 3000,
    },
    # Java
    "spring": {
        "files": ["pom.xml"],
        "content_hints": {"pom.xml": ["spring-boot"]},
        "type": "java",
        "framework": "spring",
        "default_port": 8080,
    },
    "java_gradle": {
        "files": ["build.gradle"],
        "content_hints": {},
        "type": "java",
        "framework": "gradle",
        "default_port": 8080,
    },
    # PHP
    "laravel": {
        "files": ["composer.json", "artisan"],
        "content_hints": {"composer.json": ["laravel"]},
        "type": "php",
        "framework": "laravel",
        "default_port": 8000,
    },
    "php_generic": {
        "files": ["index.php"],
        "content_hints": {},
        "type": "php",
        "framework": "generic",
        "default_port": 80,
    },
    # Go
    "golang": {
        "files": ["go.mod"],
        "content_hints": {},
        "type": "golang",
        "framework": "generic",
        "default_port": 8080,
    },
    # Static site
    "static": {
        "files": ["index.html"],
        "content_hints": {},
        "type": "static",
        "framework": "nginx",
        "default_port": 80,
    },
    # Database
    "mongodb": {
        "files": [],
        "content_hints": {},
        "type": "database",
        "framework": "mongodb",
        "default_port": 27017,
    },
    "mysql": {
        "files": [],
        "content_hints": {},
        "type": "database",
        "framework": "mysql",
        "default_port": 3306,
    },
    "postgres": {
        "files": [],
        "content_hints": {},
        "type": "database",
        "framework": "postgres",
        "default_port": 5432,
    },
}


def detect_stack(project_dir: str) -> dict:
    """Auto-detect the technology stack of an uploaded project folder."""
    files_in_dir = set()
    for item in os.listdir(project_dir):
        files_in_dir.add(item)

    # Check each stack signature (order matters — more specific first)
    ordered_checks = [
        "django", "fastapi", "flask", "python_generic",
        "nextjs", "react", "express", "nodejs_generic",
        "spring", "java_gradle",
        "laravel", "php_generic",
        "golang",
        "static",
    ]

    for stack_name in ordered_checks:
        sig = STACK_SIGNATURES[stack_name]

        # Check required files exist
        if not all(f in files_in_dir for f in sig["files"]):
            continue

        # Check content hints
        hints_match = True
        for filename, keywords in sig.get("content_hints", {}).items():
            filepath = os.path.join(project_dir, filename)
            if os.path.exists(filepath):
                try:
                    content = open(filepath, "r", errors="ignore").read().lower()
                    if not any(kw.lower() in content for kw in keywords):
                        hints_match = False
                        break
                except Exception:
                    hints_match = False
                    break
            else:
                hints_match = False
                break

        if hints_match:
            logger.info(f"Detected stack: {stack_name} ({sig['type']}:{sig['framework']})")
            return {
                "name": stack_name,
                "type": sig["type"],
                "framework": sig["framework"],
                "default_port": sig["default_port"],
            }

    return {"name": "unknown", "type": "unknown", "framework": "unknown", "default_port": 5000}


# ═══════════════════════════════════════════════════════════
#  DOCKERFILE GENERATION
# ═══════════════════════════════════════════════════════════

DOCKERFILE_TEMPLATES = {
    # ── Python ──
    "flask": """FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE {port}
CMD ["python", "-m", "flask", "run", "--host=0.0.0.0", "--port={port}"]
""",
    "django": """FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE {port}
CMD ["python", "manage.py", "runserver", "0.0.0.0:{port}"]
""",
    "fastapi": """FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE {port}
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "{port}"]
""",
    "python_generic": """FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE {port}
CMD ["python", "app.py"]
""",

    # ── Node.js ──
    "express": """FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE {port}
CMD ["node", "index.js"]
""",
    "react": """FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
""",
    "nextjs": """FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE {port}
CMD ["npm", "start"]
""",
    "nodejs_generic": """FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE {port}
CMD ["node", "index.js"]
""",

    # ── Java ──
    "spring": """FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:resolve
COPY src ./src
RUN mvn package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE {port}
CMD ["java", "-jar", "app.jar"]
""",
    "java_gradle": """FROM gradle:8-jdk17 AS build
WORKDIR /app
COPY . .
RUN gradle build -x test

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
EXPOSE {port}
CMD ["java", "-jar", "app.jar"]
""",

    # ── PHP ──
    "laravel": """FROM php:8.2-fpm
WORKDIR /var/www/html
RUN apt-get update && apt-get install -y git zip unzip
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer
COPY . .
RUN composer install --no-dev --optimize-autoloader
EXPOSE {port}
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port={port}"]
""",
    "php_generic": """FROM php:8.2-apache
COPY . /var/www/html/
EXPOSE 80
""",

    # ── Go ──
    "golang": """FROM golang:1.21-alpine AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o main .

FROM alpine:latest
WORKDIR /app
COPY --from=build /app/main .
EXPOSE {port}
CMD ["./main"]
""",

    # ── Static Site ──
    "static": """FROM nginx:alpine
COPY . /usr/share/nginx/html/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
""",
}


def generate_dockerfile(stack: dict, port: int = None) -> str:
    """Generate a Dockerfile based on detected technology stack."""
    framework = stack["framework"]
    effective_port = port or stack["default_port"]

    template = DOCKERFILE_TEMPLATES.get(framework)
    if not template:
        template = DOCKERFILE_TEMPLATES.get(stack["type"], DOCKERFILE_TEMPLATES["python_generic"])

    return template.format(port=effective_port)


def find_entry_point(project_dir: str, stack: dict) -> Optional[str]:
    """Try to find the main entry point file for the project."""
    type_ = stack["type"]

    if type_ == "python":
        candidates = ["app.py", "main.py", "server.py", "run.py", "wsgi.py", "manage.py"]
        for c in candidates:
            if os.path.exists(os.path.join(project_dir, c)):
                return c

    elif type_ == "nodejs":
        # Check package.json for "main" or "scripts.start"
        pkg_path = os.path.join(project_dir, "package.json")
        if os.path.exists(pkg_path):
            try:
                pkg = json.load(open(pkg_path))
                if "main" in pkg:
                    return pkg["main"]
                if "scripts" in pkg and "start" in pkg["scripts"]:
                    return None  # npm start handles it
            except Exception:
                pass
        candidates = ["index.js", "app.js", "server.js", "main.js"]
        for c in candidates:
            if os.path.exists(os.path.join(project_dir, c)):
                return c

    return None


# ═══════════════════════════════════════════════════════════
#  HAPROXY CONFIG GENERATION
# ═══════════════════════════════════════════════════════════

def generate_haproxy_config(
    backend_service: str,
    backend_port: int,
    replicas: int,
    algorithm: str = "roundrobin",
    stats_user: str = "admin",
    stats_pass: str = "haproxy123",
) -> str:
    """Generate a complete HAProxy configuration file."""
    return f"""# ─────────────────────────────────────────────────────────
#  HAProxy 2.8 — Auto-Generated Configuration
#  Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
#  Backend: {backend_service}:{backend_port} x{replicas}
# ─────────────────────────────────────────────────────────

global
    log stdout format raw local0
    maxconn 4096

    resolvers docker_resolver
        nameserver dns 127.0.0.11:53
        resolve_retries 3
        timeout resolve 1s
        timeout retry   1s
        hold valid      10s

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

frontend stats
    bind *:8404
    stats enable
    stats uri /stats
    stats refresh 5s
    stats show-legends
    stats show-node
    stats auth {stats_user}:{stats_pass}

frontend http_front
    bind *:8080
    unique-id-format %{{+X}}o\\ %ci:%cp_%fi:%fp_%Ts_%rt:%pid
    unique-id-header X-Request-ID
    default_backend http_back

backend http_back
    balance {algorithm}
    option httpchk GET /
    default-server inter 5s fall 3 rise 2 maxconn 100

    server-template {backend_service} {replicas} {backend_service}:{backend_port} check resolvers docker_resolver init-addr none
"""


# ═══════════════════════════════════════════════════════════
#  DOCKER COMPOSE GENERATION
# ═══════════════════════════════════════════════════════════

def generate_compose(project: dict) -> str:
    """Generate a docker-compose.yml for the user's project."""
    services = {}
    volumes = {}
    backend_info = project.get("backend", {})
    frontend_info = project.get("frontend", {})
    database_info = project.get("database", {})

    # ── Database Service ──
    db_name = None
    if database_info.get("enabled"):
        db_type = database_info.get("type", "mongodb")
        db_name = f"user-db"

        if db_type == "mongodb":
            services[db_name] = {
                "image": "mongo:7.0",
                "container_name": db_name,
                "volumes": ["db_data:/data/db"],
                "networks": ["user-network"],
                "restart": "unless-stopped",
            }
            volumes["db_data"] = {"driver": "local"}

            # If user uploaded init scripts
            db_dir = database_info.get("dir")
            if db_dir:
                init_files = [f for f in os.listdir(db_dir) if f.endswith(('.js', '.sh'))]
                if init_files:
                    services[db_name]["build"] = {
                        "context": db_dir,
                        "dockerfile": os.path.join(db_dir, "Dockerfile"),
                    }

        elif db_type == "mysql":
            services[db_name] = {
                "image": "mysql:8.0",
                "container_name": db_name,
                "environment": {
                    "MYSQL_ROOT_PASSWORD": "rootpassword",
                    "MYSQL_DATABASE": "appdb",
                },
                "volumes": ["db_data:/var/lib/mysql"],
                "networks": ["user-network"],
                "restart": "unless-stopped",
            }
            volumes["db_data"] = {"driver": "local"}

        elif db_type == "postgres":
            services[db_name] = {
                "image": "postgres:16-alpine",
                "container_name": db_name,
                "environment": {
                    "POSTGRES_PASSWORD": "rootpassword",
                    "POSTGRES_DB": "appdb",
                },
                "volumes": ["db_data:/var/lib/postgresql/data"],
                "networks": ["user-network"],
                "restart": "unless-stopped",
            }
            volumes["db_data"] = {"driver": "local"}

    # ── Backend Service ──
    backend_svc = "user-backend"
    backend_port = backend_info.get("port", 5000)
    replicas = backend_info.get("replicas", 3)
    backend_dir = backend_info.get("dir", "")

    services[backend_svc] = {
        "build": backend_dir,
        "deploy": {"replicas": replicas},
        "environment": {"PYTHONUNBUFFERED": "1"},
        "networks": ["user-network"],
        "restart": "unless-stopped",
    }
    if db_name:
        services[backend_svc]["depends_on"] = [db_name]

    # ── Frontend Service ──
    if frontend_info.get("enabled"):
        frontend_dir = frontend_info.get("dir", "")
        frontend_port = frontend_info.get("port", 80)

        services["user-frontend"] = {
            "build": frontend_dir,
            "container_name": "user-frontend",
            "ports": [f"{frontend_port}:80"],
            "depends_on": ["haproxy"],
            "networks": ["user-network"],
            "restart": "unless-stopped",
        }

    # ── HAProxy ──
    services["haproxy"] = {
        "image": "haproxy:2.8-alpine",
        "container_name": "haproxy",
        "ports": ["8080:8080", "8404:8404"],
        "volumes": ["./haproxy/haproxy.cfg:/usr/local/etc/haproxy/haproxy.cfg:ro"],
        "depends_on": [backend_svc],
        "networks": ["user-network"],
        "restart": "unless-stopped",
    }

    # Build YAML manually (to keep clean formatting)
    lines = ["services:"]

    for svc_name, svc in services.items():
        lines.append(f"  {svc_name}:")
        for key, val in svc.items():
            if key == "deploy":
                lines.append(f"    deploy:")
                lines.append(f"      replicas: {val['replicas']}")
            elif key == "environment":
                lines.append(f"    environment:")
                if isinstance(val, dict):
                    for ek, ev in val.items():
                        lines.append(f"      - {ek}={ev}")
                elif isinstance(val, list):
                    for item in val:
                        lines.append(f"      - {item}")
            elif key == "ports":
                lines.append(f"    ports:")
                for p in val:
                    lines.append(f'      - "{p}"')
            elif key == "volumes":
                lines.append(f"    volumes:")
                for v in val:
                    lines.append(f"      - {v}")
            elif key == "depends_on":
                lines.append(f"    depends_on:")
                for d in val:
                    lines.append(f"      - {d}")
            elif key == "networks":
                lines.append(f"    networks:")
                for n in val:
                    lines.append(f"      - {n}")
            elif key == "build":
                if isinstance(val, str):
                    lines.append(f"    build: {val}")
                else:
                    lines.append(f"    build:")
                    for bk, bv in val.items():
                        lines.append(f"      {bk}: {bv}")
            else:
                if isinstance(val, str):
                    lines.append(f"    {key}: {val}")
                elif isinstance(val, bool):
                    lines.append(f"    {key}: {'true' if val else 'false'}")
                else:
                    lines.append(f"    {key}: {val}")
        lines.append("")

    lines.append("networks:")
    lines.append("  user-network:")
    lines.append("    driver: bridge")
    lines.append("")

    if volumes:
        lines.append("volumes:")
        for vname, vconf in volumes.items():
            lines.append(f"  {vname}:")
            for vk, vv in vconf.items():
                lines.append(f"    {vk}: {vv}")

    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════
#  DEPLOYMENT ENGINE
# ═══════════════════════════════════════════════════════════

class DeploymentEngine:
    """Manages the full lifecycle: upload → detect → build → deploy → scale."""

    def __init__(self):
        self.workspace = WORKSPACE_DIR
        os.makedirs(self.workspace, exist_ok=True)
        self.current_project = None
        self.status = "idle"  # idle, uploading, building, deploying, running, error
        self.deploy_log = []

    def _log(self, msg: str):
        entry = f"[{datetime.now().strftime('%H:%M:%S')}] {msg}"
        logger.info(entry)
        self.deploy_log.append(entry)

    def get_project_dir(self, project_name: str) -> str:
        return os.path.join(self.workspace, project_name)

    def extract_upload(self, zip_path: str, service_type: str, project_name: str) -> dict:
        """Extract an uploaded ZIP file to the project workspace."""
        project_dir = self.get_project_dir(project_name)
        service_dir = os.path.join(project_dir, service_type)

        # Clean existing
        if os.path.exists(service_dir):
            shutil.rmtree(service_dir)
        os.makedirs(service_dir, exist_ok=True)

        # Extract ZIP
        self._log(f"📦 Extracting {service_type} upload...")
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(service_dir)

        # Flatten if single root directory
        items = os.listdir(service_dir)
        if len(items) == 1 and os.path.isdir(os.path.join(service_dir, items[0])):
            nested = os.path.join(service_dir, items[0])
            for item in os.listdir(nested):
                shutil.move(os.path.join(nested, item), service_dir)
            os.rmdir(nested)
            self._log(f"   Flattened nested directory: {items[0]}")

        # Detect stack
        stack = detect_stack(service_dir)
        self._log(f"   Detected: {stack['type']} / {stack['framework']}")

        # Generate Dockerfile if missing
        dockerfile_path = os.path.join(service_dir, "Dockerfile")
        generated = False
        if not os.path.exists(dockerfile_path):
            dockerfile_content = generate_dockerfile(stack)
            with open(dockerfile_path, "w") as f:
                f.write(dockerfile_content)
            generated = True
            self._log(f"   ✅ Auto-generated Dockerfile for {stack['framework']}")
        else:
            self._log(f"   📄 Using existing Dockerfile")

        # Count files
        file_count = sum(1 for _, _, files in os.walk(service_dir) for _ in files)
        self._log(f"   📁 {file_count} files extracted to {service_dir}")

        return {
            "service_type": service_type,
            "directory": service_dir,
            "stack": stack,
            "dockerfile_generated": generated,
            "file_count": file_count,
        }

    def deploy_project(
        self,
        project_name: str,
        backend_port: int = None,
        replicas: int = 3,
        algorithm: str = "roundrobin",
        db_type: str = "mongodb",
        enable_db: bool = True,
    ) -> dict:
        """Build and deploy the uploaded project."""
        self.status = "building"
        self.deploy_log = []
        project_dir = self.get_project_dir(project_name)

        backend_dir = os.path.join(project_dir, "backend")
        frontend_dir = os.path.join(project_dir, "frontend")
        database_dir = os.path.join(project_dir, "database")

        has_backend = os.path.isdir(backend_dir)
        has_frontend = os.path.isdir(frontend_dir)
        has_database = os.path.isdir(database_dir)

        if not has_backend:
            self.status = "error"
            self._log("❌ No backend found. Upload a backend first.")
            return {"status": "error", "message": "Backend is required"}

        # Detect backend stack
        backend_stack = detect_stack(backend_dir)
        effective_port = backend_port or backend_stack["default_port"]
        self._log(f"🔧 Backend: {backend_stack['framework']} on port {effective_port}")

        # Generate Dockerfile for backend if missing
        if not os.path.exists(os.path.join(backend_dir, "Dockerfile")):
            with open(os.path.join(backend_dir, "Dockerfile"), "w") as f:
                f.write(generate_dockerfile(backend_stack, effective_port))
            self._log(f"   Auto-generated backend Dockerfile")

        # Generate Dockerfile for frontend if uploaded and missing
        if has_frontend:
            frontend_stack = detect_stack(frontend_dir)
            if not os.path.exists(os.path.join(frontend_dir, "Dockerfile")):
                # For frontend that needs to reverse-proxy to HAProxy
                nginx_conf = """server {
    listen 80;
    server_name localhost;

    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://haproxy:8080/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
"""
                if frontend_stack["type"] == "static":
                    # Write nginx conf
                    with open(os.path.join(frontend_dir, "nginx.conf"), "w") as f:
                        f.write(nginx_conf)
                    dockerfile = """FROM nginx:alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/
COPY . /usr/share/nginx/html/
RUN rm -f /usr/share/nginx/html/nginx.conf /usr/share/nginx/html/Dockerfile
EXPOSE 80
"""
                    with open(os.path.join(frontend_dir, "Dockerfile"), "w") as f:
                        f.write(dockerfile)
                else:
                    with open(os.path.join(frontend_dir, "Dockerfile"), "w") as f:
                        f.write(generate_dockerfile(frontend_stack))

                self._log(f"   Auto-generated frontend Dockerfile ({frontend_stack['framework']})")

        # ── Generate HAProxy Config ──
        self._log(f"⚖️ Generating HAProxy config: {algorithm}, {replicas} replicas")
        haproxy_dir = os.path.join(project_dir, "haproxy")
        os.makedirs(haproxy_dir, exist_ok=True)
        haproxy_cfg = generate_haproxy_config(
            backend_service="user-backend",
            backend_port=effective_port,
            replicas=max(replicas, 20),  # server-template needs >= actual replicas
            algorithm=algorithm,
        )
        haproxy_cfg_path = os.path.join(haproxy_dir, "haproxy.cfg")
        with open(haproxy_cfg_path, "w") as f:
            f.write(haproxy_cfg)

        # Also write to the mounted config path so controller can read it
        try:
            with open(HAPROXY_CFG_PATH, "w") as f:
                f.write(haproxy_cfg)
        except Exception as e:
            self._log(f"   ⚠️ Could not write to mounted config: {e}")

        # ── Generate docker-compose.yml ──
        self._log(f"📝 Generating docker-compose.yml...")
        project_config = {
            "backend": {
                "dir": "./backend",
                "port": effective_port,
                "replicas": replicas,
                "stack": backend_stack,
            },
            "frontend": {
                "enabled": has_frontend,
                "dir": "./frontend",
                "port": 80,
            },
            "database": {
                "enabled": enable_db,
                "type": db_type,
                "dir": "./database" if has_database else None,
            },
        }
        compose_content = generate_compose(project_config)
        compose_path = os.path.join(project_dir, "docker-compose.yml")
        with open(compose_path, "w") as f:
            f.write(compose_content)

        # ── Build and Deploy ──
        self.status = "deploying"
        self._log(f"🚀 Building and deploying...")

        try:
            # Stop existing deployment
            subprocess.run(
                ["docker", "compose", "down", "--remove-orphans"],
                cwd=project_dir, capture_output=True, text=True, timeout=60,
            )

            # Build
            self._log(f"   Building Docker images...")
            result = subprocess.run(
                ["docker", "compose", "build", "--no-cache"],
                cwd=project_dir, capture_output=True, text=True, timeout=300,
            )
            if result.returncode != 0:
                self._log(f"   ❌ Build failed: {result.stderr[-500:]}")
                self.status = "error"
                return {"status": "error", "message": result.stderr[-500:], "log": self.deploy_log}

            self._log(f"   ✅ Images built successfully")

            # Deploy
            self._log(f"   Starting containers...")
            result = subprocess.run(
                ["docker", "compose", "up", "-d"],
                cwd=project_dir, capture_output=True, text=True, timeout=120,
            )
            if result.returncode != 0:
                self._log(f"   ❌ Deploy failed: {result.stderr[-500:]}")
                self.status = "error"
                return {"status": "error", "message": result.stderr[-500:], "log": self.deploy_log}

            self._log(f"   ✅ All containers started!")
            self.status = "running"

            self.current_project = {
                "name": project_name,
                "dir": project_dir,
                "backend_stack": backend_stack,
                "backend_port": effective_port,
                "replicas": replicas,
                "algorithm": algorithm,
                "db_type": db_type if enable_db else None,
                "has_frontend": has_frontend,
                "deployed_at": datetime.now().isoformat(),
            }

            self._log(f"")
            self._log(f"🎉 Deployment complete!")
            self._log(f"   Backend ({backend_stack['framework']}): HAProxy :8080")
            if has_frontend:
                self._log(f"   Frontend: http://localhost:80")
            self._log(f"   HAProxy Stats: http://localhost:8404/stats")
            self._log(f"   Replicas: {replicas}")

            return {
                "status": "success",
                "project": self.current_project,
                "log": self.deploy_log,
            }

        except subprocess.TimeoutExpired:
            self.status = "error"
            self._log(f"   ❌ Operation timed out")
            return {"status": "error", "message": "Timeout", "log": self.deploy_log}
        except Exception as e:
            self.status = "error"
            self._log(f"   ❌ Error: {str(e)}")
            return {"status": "error", "message": str(e), "log": self.deploy_log}

    def scale(self, replicas: int) -> dict:
        """Scale the deployed backend to N replicas."""
        if not self.current_project:
            return {"status": "error", "message": "No project deployed"}

        project_dir = self.current_project["dir"]
        self._log(f"📐 Scaling to {replicas} replicas...")

        try:
            result = subprocess.run(
                ["docker", "compose", "up", "-d", "--scale", f"user-backend={replicas}", "--no-recreate"],
                cwd=project_dir, capture_output=True, text=True, timeout=120,
            )
            if result.returncode != 0:
                return {"status": "error", "message": result.stderr}

            self.current_project["replicas"] = replicas
            self._log(f"✅ Scaled to {replicas} replicas")
            return {"status": "success", "replicas": replicas}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def change_algorithm(self, algorithm: str) -> dict:
        """Change the load balancing algorithm."""
        if not self.current_project:
            return {"status": "error", "message": "No project deployed"}

        project_dir = self.current_project["dir"]
        haproxy_cfg_path = os.path.join(project_dir, "haproxy", "haproxy.cfg")

        try:
            with open(haproxy_cfg_path, "r") as f:
                config = f.read()

            config = re.sub(
                r"balance\s+(roundrobin|leastconn|source)",
                f"balance {algorithm}",
                config,
            )

            with open(haproxy_cfg_path, "w") as f:
                f.write(config)

            # Also update mounted path
            try:
                with open(HAPROXY_CFG_PATH, "w") as f:
                    f.write(config)
            except Exception:
                pass

            self.current_project["algorithm"] = algorithm
            self._log(f"⚖️ Algorithm changed to: {algorithm}")
            return {"status": "success", "algorithm": algorithm}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def stop_deployment(self) -> dict:
        """Stop the current deployment."""
        if not self.current_project:
            return {"status": "error", "message": "No project deployed"}

        project_dir = self.current_project["dir"]
        self._log(f"🛑 Stopping deployment...")

        try:
            subprocess.run(
                ["docker", "compose", "down", "--remove-orphans"],
                cwd=project_dir, capture_output=True, text=True, timeout=60,
            )
            self.status = "idle"
            self._log(f"✅ Deployment stopped")
            return {"status": "success"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def get_status(self) -> dict:
        """Get current deployment status."""
        return {
            "status": self.status,
            "project": self.current_project,
            "log": self.deploy_log[-50:],
        }
