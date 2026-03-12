"""
Controller Application — Central Management Platform
Accepts user project uploads, auto-containerizes, deploys with
HAProxy load balancing, and provides monitoring dashboard.
"""

import os
import re
import shutil
import logging
from datetime import datetime
from typing import Optional

import docker
import httpx
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from deployer import DeploymentEngine

# ──────────── Logging ────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [CONTROLLER] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ──────────── FastAPI App ────────────
app = FastAPI(
    title="IPD Load Balancer Platform",
    description="Upload your project → Auto-containerize → Load balance → Monitor",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve the dashboard UI
app.mount("/static", StaticFiles(directory="static"), name="static")

# ──────────── Docker Client ────────────
try:
    docker_client = docker.from_env()
    logger.info("✅ Connected to Docker daemon")
except Exception as e:
    logger.error(f"❌ Docker connection failed: {e}")
    docker_client = None

# ──────────── Deployment Engine ────────────
engine = DeploymentEngine()

# ──────────── Configuration ────────────
ES_HOST = os.environ.get("ES_HOST", "http://elasticsearch:9200")
UPLOAD_DIR = "/workspace/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ──────────── Pydantic Models ────────────
class ScaleRequest(BaseModel):
    replicas: int


class AlgorithmRequest(BaseModel):
    algorithm: str  # roundrobin, leastconn, source


class DeployRequest(BaseModel):
    project_name: str = "myproject"
    backend_port: Optional[int] = None
    replicas: int = 3
    algorithm: str = "roundrobin"
    db_type: str = "mongodb"
    enable_db: bool = True


# ══════════════════════════════════════════════════════════
#  DASHBOARD PAGE
# ══════════════════════════════════════════════════════════

@app.get("/", response_class=HTMLResponse)
async def dashboard():
    """Serve the main dashboard page."""
    with open("static/index.html", "r") as f:
        return HTMLResponse(content=f.read())


# ══════════════════════════════════════════════════════════
#  UPLOAD ENDPOINTS
# ══════════════════════════════════════════════════════════

@app.post("/api/upload/{service_type}")
async def upload_service(
    service_type: str,
    file: UploadFile = File(...),
    project_name: str = Form("myproject"),
):
    """
    Upload a service folder as a ZIP file.
    service_type: 'backend', 'frontend', or 'database'
    """
    if service_type not in ("backend", "frontend", "database"):
        raise HTTPException(status_code=400, detail="service_type must be: backend, frontend, or database")

    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only ZIP files are supported")

    # Save uploaded ZIP
    zip_path = os.path.join(UPLOAD_DIR, f"{project_name}_{service_type}.zip")
    with open(zip_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # Extract and detect
    try:
        result = engine.extract_upload(zip_path, service_type, project_name)
        return {
            "status": "success",
            "message": f"{service_type} uploaded and extracted successfully",
            **result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up ZIP
        if os.path.exists(zip_path):
            os.remove(zip_path)


@app.get("/api/upload/status/{project_name}")
async def upload_status(project_name: str):
    """Check which services have been uploaded for a project."""
    project_dir = engine.get_project_dir(project_name)

    services = {}
    for svc in ["backend", "frontend", "database"]:
        svc_dir = os.path.join(project_dir, svc)
        if os.path.isdir(svc_dir):
            files = os.listdir(svc_dir)
            stack = None
            if svc != "database":
                from deployer import detect_stack
                stack = detect_stack(svc_dir)

            services[svc] = {
                "uploaded": True,
                "files": len(files),
                "has_dockerfile": "Dockerfile" in files,
                "stack": stack,
            }
        else:
            services[svc] = {"uploaded": False}

    return {"project": project_name, "services": services}


# ══════════════════════════════════════════════════════════
#  DEPLOY ENDPOINTS
# ══════════════════════════════════════════════════════════

@app.post("/api/deploy")
async def deploy_project(req: DeployRequest):
    """Build and deploy the uploaded project with load balancing."""
    result = engine.deploy_project(
        project_name=req.project_name,
        backend_port=req.backend_port,
        replicas=req.replicas,
        algorithm=req.algorithm,
        db_type=req.db_type,
        enable_db=req.enable_db,
    )
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result)
    return result


@app.post("/api/stop")
async def stop_deployment():
    """Stop the current deployment."""
    result = engine.stop_deployment()
    return result


@app.get("/api/deploy/status")
async def deployment_status():
    """Get current deployment status and logs."""
    return engine.get_status()


@app.get("/api/deploy/log")
async def deployment_log():
    """Get deployment log."""
    return {"log": engine.deploy_log}


# ══════════════════════════════════════════════════════════
#  SCALING
# ══════════════════════════════════════════════════════════

@app.post("/api/scale")
async def scale_backends(req: ScaleRequest):
    """Scale the backend service to N replicas."""
    if req.replicas < 1 or req.replicas > 20:
        raise HTTPException(status_code=400, detail="Replicas must be between 1 and 20")

    result = engine.scale(req.replicas)
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result["message"])
    return result


# ══════════════════════════════════════════════════════════
#  HAPROXY MANAGEMENT
# ══════════════════════════════════════════════════════════

@app.post("/api/haproxy/algorithm")
async def change_algorithm(req: AlgorithmRequest):
    """Change the load balancing algorithm."""
    valid = ["roundrobin", "leastconn", "source"]
    if req.algorithm not in valid:
        raise HTTPException(status_code=400, detail=f"Choose from: {valid}")

    result = engine.change_algorithm(req.algorithm)

    # Reload HAProxy
    if result["status"] == "success":
        await _reload_haproxy()

    return result


@app.get("/api/haproxy/config")
async def get_haproxy_config():
    """Return the current HAProxy configuration."""
    # Try project-specific config first
    if engine.current_project:
        cfg_path = os.path.join(engine.current_project["dir"], "haproxy", "haproxy.cfg")
        if os.path.exists(cfg_path):
            with open(cfg_path, "r") as f:
                return {"config": f.read()}

    # Fall back to mounted config
    cfg_path = os.environ.get("HAPROXY_CFG_PATH", "/config/haproxy.cfg")
    try:
        with open(cfg_path, "r") as f:
            return {"config": f.read()}
    except FileNotFoundError:
        return {"config": "No configuration file found."}


@app.get("/api/haproxy/stats")
async def haproxy_stats():
    """Fetch HAProxy stats."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "http://haproxy:8404/stats;json",
                auth=("admin", os.environ.get("HAPROXY_STATS_PASS", "haproxy123")),
                timeout=10,
            )
            if resp.status_code == 200:
                return resp.json()
            return {"error": f"HAProxy returned {resp.status_code}"}
    except Exception as e:
        return {"error": str(e), "message": "HAProxy stats unavailable"}


# ══════════════════════════════════════════════════════════
#  SYSTEM STATUS
# ══════════════════════════════════════════════════════════

@app.get("/api/status")
async def system_status():
    """Get comprehensive system status."""
    if not docker_client:
        raise HTTPException(status_code=503, detail="Docker daemon not available")

    containers = docker_client.containers.list(all=True)

    service_status = []
    for c in containers:
        service_status.append({
            "id": c.short_id,
            "name": c.name,
            "status": c.status,
            "image": c.image.tags[0] if c.image.tags else "unknown",
            "ports": _format_ports(c.ports),
        })

    backend_count = sum(
        1 for c in containers
        if "backend" in c.name and c.status == "running"
    )

    return {
        "timestamp": datetime.now().isoformat(),
        "total_containers": len(containers),
        "running": sum(1 for c in containers if c.status == "running"),
        "stopped": sum(1 for c in containers if c.status != "running"),
        "backend_replicas": backend_count,
        "services": service_status,
        "deployment": engine.get_status(),
    }


@app.get("/api/backends")
async def list_backends():
    """List all backend container instances."""
    if not docker_client:
        raise HTTPException(status_code=503, detail="Docker not available")

    containers = docker_client.containers.list(all=True)
    backends = []
    for c in containers:
        if "backend" in c.name:
            backends.append({
                "id": c.short_id,
                "name": c.name,
                "status": c.status,
                "health": _check_container_health(c),
            })

    return {"backends": backends, "total": len(backends)}


# ══════════════════════════════════════════════════════════
#  CONTAINER ACTIONS
# ══════════════════════════════════════════════════════════

@app.post("/api/container/{container_id}/restart")
async def restart_container(container_id: str):
    if not docker_client:
        raise HTTPException(status_code=503, detail="Docker not available")
    try:
        container = docker_client.containers.get(container_id)
        container.restart(timeout=10)
        return {"status": "restarted", "container": container.name}
    except docker.errors.NotFound:
        raise HTTPException(status_code=404, detail="Container not found")


@app.post("/api/container/{container_id}/stop")
async def stop_container(container_id: str):
    if not docker_client:
        raise HTTPException(status_code=503, detail="Docker not available")
    try:
        container = docker_client.containers.get(container_id)
        container.stop(timeout=10)
        return {"status": "stopped", "container": container.name}
    except docker.errors.NotFound:
        raise HTTPException(status_code=404, detail="Container not found")


@app.post("/api/container/{container_id}/start")
async def start_container(container_id: str):
    if not docker_client:
        raise HTTPException(status_code=503, detail="Docker not available")
    try:
        container = docker_client.containers.get(container_id)
        container.start()
        return {"status": "started", "container": container.name}
    except docker.errors.NotFound:
        raise HTTPException(status_code=404, detail="Container not found")


@app.get("/api/container/{container_id}/logs")
async def container_logs(container_id: str, tail: int = 100):
    if not docker_client:
        raise HTTPException(status_code=503, detail="Docker not available")
    try:
        container = docker_client.containers.get(container_id)
        logs = container.logs(tail=tail, timestamps=True).decode("utf-8", errors="replace")
        return {"logs": logs.split("\n"), "container": container.name}
    except docker.errors.NotFound:
        raise HTTPException(status_code=404, detail="Container not found")


# ══════════════════════════════════════════════════════════
#  LOGS (Elasticsearch)
# ══════════════════════════════════════════════════════════

@app.get("/api/logs/recent")
async def recent_logs():
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{ES_HOST}/logstash-*/_search",
                json={"size": 50, "sort": [{"@timestamp": {"order": "desc"}}], "query": {"match_all": {}}},
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                logs = [
                    {
                        "timestamp": h["_source"].get("@timestamp", ""),
                        "host": h["_source"].get("host", ""),
                        "message": h["_source"].get("message", ""),
                        "tag": h["_source"].get("tag", ""),
                    }
                    for h in data.get("hits", {}).get("hits", [])
                ]
                return {"logs": logs, "total": data["hits"]["total"]["value"]}
            return {"logs": [], "error": f"ES returned {resp.status_code}"}
    except Exception as e:
        return {"logs": [], "error": str(e)}


@app.get("/api/logs/errors")
async def error_logs():
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{ES_HOST}/logstash-*/_search",
                json={
                    "size": 30,
                    "sort": [{"@timestamp": {"order": "desc"}}],
                    "query": {"bool": {"should": [
                        {"match": {"message": "error"}},
                        {"match": {"message": "500"}},
                        {"match": {"message": "Traceback"}},
                    ]}},
                },
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "errors": [h["_source"] for h in data["hits"]["hits"]],
                    "total": data["hits"]["total"]["value"],
                }
            return {"errors": [], "error": f"ES returned {resp.status_code}"}
    except Exception as e:
        return {"errors": [], "error": str(e)}


# ══════════════════════════════════════════════════════════
#  HEALTH
# ══════════════════════════════════════════════════════════

@app.get("/api/health")
async def health():
    checks = {
        "controller": "healthy",
        "docker": "connected" if docker_client else "disconnected",
        "deployment": engine.status,
        "timestamp": datetime.now().isoformat(),
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{ES_HOST}/_cluster/health", timeout=5)
            checks["elasticsearch"] = resp.json().get("status", "unknown")
    except Exception:
        checks["elasticsearch"] = "unavailable"
    return checks


# ══════════════════════════════════════════════════════════
#  HELPERS
# ══════════════════════════════════════════════════════════

def _format_ports(ports: dict) -> str:
    if not ports:
        return ""
    parts = []
    for cp, bindings in ports.items():
        if bindings:
            for b in bindings:
                parts.append(f"{b['HostPort']}→{cp}")
        else:
            parts.append(cp)
    return ", ".join(parts)


def _check_container_health(container) -> str:
    state = container.attrs.get("State", {})
    health = state.get("Health", {})
    if health:
        return health.get("Status", "unknown")
    return "running" if state.get("Running", False) else "stopped"


async def _reload_haproxy():
    try:
        if docker_client:
            for c in docker_client.containers.list(filters={"name": "haproxy"}):
                c.kill(signal="SIGHUP")
                logger.info("🔄 HAProxy reloaded")
    except Exception as e:
        logger.warning(f"HAProxy reload: {e}")


# ══════════════════════════════════════════════════════════
#  STARTUP
# ══════════════════════════════════════════════════════════

@app.on_event("startup")
async def startup_event():
    logger.info("=" * 60)
    logger.info("🚀 IPD Controller Platform Starting...")
    logger.info("   Mode: Upload → Auto-containerize → Deploy → Load Balance")
    logger.info("=" * 60)
