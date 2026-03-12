/**
 * IPD Platform Dashboard — Full Interactive Logic
 * Handles: Upload → Deploy → Scale → Monitor
 */

const API = "";

// ══════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════

document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", (e) => {
        e.preventDefault();
        switchSection(item.dataset.section);
    });
});

function switchSection(section) {
    document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
    const navEl = document.querySelector(`[data-section="${section}"]`);
    if (navEl) navEl.classList.add("active");

    document.querySelectorAll(".content-section").forEach((s) => s.classList.remove("active"));
    const secEl = document.getElementById(`section-${section}`);
    if (secEl) secEl.classList.add("active");

    const titles = {
        upload: "Upload & Deploy",
        overview: "System Overview",
        containers: "Container Management",
        scaling: "Backend Scaling",
        loadbalancer: "Load Balancer",
        logs: "System Logs",
        monitoring: "Monitoring",
    };
    document.getElementById("pageTitle").textContent = titles[section] || section;

    if (section === "overview") loadStatus();
    if (section === "containers") loadBackends();
    if (section === "logs") { loadLogs(); loadErrorLogs(); }
    if (section === "loadbalancer") loadHAProxyConfig();
    if (section === "monitoring") loadHealth();
}

// ══════════════════════════════════════════════
//  AUTO-REFRESH
// ══════════════════════════════════════════════

document.getElementById("refreshBtn").addEventListener("click", refreshAll);
setInterval(refreshAll, 20000);

async function refreshAll() {
    updateTimestamp();
    loadDeploymentStatus();
}

function updateTimestamp() {
    document.getElementById("lastUpdated").textContent = new Date().toLocaleTimeString();
}

// ══════════════════════════════════════════════
//  FILE UPLOAD
// ══════════════════════════════════════════════

const uploadState = { backend: false, frontend: false, database: false };

["backend", "frontend", "database"].forEach((svc) => {
    const zone = document.getElementById(`${svc}Zone`);
    const input = document.getElementById(`${svc}File`);

    // Click to browse
    zone.addEventListener("click", () => input.click());

    // File selected
    input.addEventListener("change", () => {
        if (input.files.length > 0) uploadFile(svc, input.files[0]);
    });

    // Drag and drop
    zone.addEventListener("dragover", (e) => {
        e.preventDefault();
        zone.classList.add("dragover");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
    zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("dragover");
        if (e.dataTransfer.files.length > 0) {
            uploadFile(svc, e.dataTransfer.files[0]);
        }
    });
});

async function uploadFile(serviceType, file) {
    if (!file.name.endsWith(".zip")) {
        alert("Please upload a ZIP file.");
        return;
    }

    const projectName = document.getElementById("projectName").value || "myproject";
    const zone = document.getElementById(`${serviceType}Zone`);
    const placeholder = document.getElementById(`${serviceType}Placeholder`);
    const success = document.getElementById(`${serviceType}Success`);
    const info = document.getElementById(`${serviceType}Info`);
    const status = document.getElementById(`${serviceType}Status`);
    const card = document.getElementById(`upload${capitalize(serviceType)}`);

    // Show uploading state
    placeholder.innerHTML = '<span>⏳ Uploading...</span>';

    const formData = new FormData();
    formData.append("file", file);
    formData.append("project_name", projectName);

    try {
        const res = await fetch(`${API}/api/upload/${serviceType}`, {
            method: "POST",
            body: formData,
        });
        const data = await res.json();

        if (res.ok) {
            // Success — update UI
            uploadState[serviceType] = true;
            zone.classList.add("uploaded");
            card.classList.add("uploaded");
            placeholder.classList.add("hidden");
            success.classList.remove("hidden");

            const stackName = data.stack ? `${data.stack.framework} (${data.stack.type})` : "detected";
            const dfMsg = data.dockerfile_generated ? " | Dockerfile auto-generated" : " | Using existing Dockerfile";
            info.textContent = `${file.name} — ${data.file_count} files — ${stackName}${dfMsg}`;
            status.textContent = "✅ Uploaded";
            status.style.color = "var(--accent-green)";

            updateSteps();
        } else {
            placeholder.innerHTML = `<span style="color:var(--accent-red)">❌ ${data.detail || "Upload failed"}</span>`;
        }
    } catch (e) {
        placeholder.innerHTML = `<span style="color:var(--accent-red)">❌ ${e.message}</span>`;
    }
}

function updateSteps() {
    const step1 = document.getElementById("step1");
    const step2 = document.getElementById("step2");

    if (uploadState.backend) {
        step1.classList.add("done");
        step1.classList.remove("active");
        step2.classList.add("active");
    }
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ══════════════════════════════════════════════
//  DEPLOY
// ══════════════════════════════════════════════

async function deployProject() {
    if (!uploadState.backend) {
        alert("Please upload a backend service first (ZIP file).");
        return;
    }

    const btn = document.getElementById("deployBtn");
    const stopBtn = document.getElementById("stopBtn");
    const logCard = document.getElementById("deployLogCard");
    const logViewer = document.getElementById("deployLog");
    const badge = document.getElementById("deployStatusBadge");

    btn.disabled = true;
    btn.textContent = "⏳ Deploying...";
    logCard.classList.remove("hidden");
    logViewer.innerHTML = "<div class='log-entry'>Starting deployment...</div>";
    badge.textContent = "deploying";

    const payload = {
        project_name: document.getElementById("projectName").value || "myproject",
        backend_port: parseInt(document.getElementById("backendPort").value) || null,
        replicas: parseInt(document.getElementById("replicaCount").value) || 3,
        algorithm: document.getElementById("lbAlgorithm").value,
        db_type: document.getElementById("dbType").value,
        enable_db: document.getElementById("enableDb").checked,
    };

    try {
        const res = await fetch(`${API}/api/deploy`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (res.ok && data.status === "success") {
            badge.textContent = "✅ running";
            badge.style.background = "var(--accent-green-glow)";
            badge.style.color = "var(--accent-green)";
            stopBtn.classList.remove("hidden");

            // Update steps
            document.getElementById("step2").classList.add("done");
            document.getElementById("step2").classList.remove("active");
            document.getElementById("step3").classList.add("done");

            // Display log
            if (data.log) {
                logViewer.innerHTML = data.log.map(l =>
                    `<div class="log-entry"><span class="log-msg">${escapeHtml(l)}</span></div>`
                ).join("");
                logViewer.scrollTop = logViewer.scrollHeight;
            }
        } else {
            badge.textContent = "❌ error";
            badge.style.background = "var(--accent-red-glow)";
            badge.style.color = "var(--accent-red)";

            const errorDetail = data.detail || data;
            if (errorDetail.log) {
                logViewer.innerHTML = errorDetail.log.map(l =>
                    `<div class="log-entry"><span class="log-msg">${escapeHtml(l)}</span></div>`
                ).join("");
            } else {
                logViewer.innerHTML = `<div class="log-entry"><span class="log-msg error">${escapeHtml(JSON.stringify(errorDetail))}</span></div>`;
            }
        }
    } catch (e) {
        badge.textContent = "error";
        logViewer.innerHTML = `<div class="log-entry"><span class="log-msg error">❌ ${escapeHtml(e.message)}</span></div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = "🚀 Build & Deploy Project";
    }
}

async function stopDeployment() {
    if (!confirm("Stop the current deployment? This will shut down all containers.")) return;

    try {
        await fetch(`${API}/api/stop`, { method: "POST" });
        document.getElementById("stopBtn").classList.add("hidden");
        document.getElementById("deployStatusBadge").textContent = "stopped";
        alert("Deployment stopped.");
    } catch (e) {
        alert(`Error: ${e.message}`);
    }
}

async function loadDeploymentStatus() {
    try {
        const res = await fetch(`${API}/api/deploy/status`);
        const data = await res.json();

        const dot = document.querySelector("#healthDot .dot");
        const label = document.getElementById("healthLabel");

        if (data.status === "running") {
            dot.className = "dot healthy";
            label.textContent = "Deployed & Running";
        } else if (data.status === "error") {
            dot.className = "dot unhealthy";
            label.textContent = "Deployment Error";
        } else {
            dot.className = "dot";
            dot.style.background = "var(--text-muted)";
            label.textContent = "No Deployment";
        }
    } catch (e) { /* ignore */ }
}

// ══════════════════════════════════════════════
//  STATUS (Overview)
// ══════════════════════════════════════════════

async function loadStatus() {
    try {
        const res = await fetch(`${API}/api/status`);
        const data = await res.json();

        document.getElementById("totalContainers").textContent = data.total_containers;
        document.getElementById("runningCount").textContent = data.running;
        document.getElementById("backendReplicas").textContent = data.backend_replicas;
        document.getElementById("stoppedCount").textContent = data.stopped;

        const tbody = document.getElementById("servicesTable");
        if (data.services && data.services.length > 0) {
            tbody.innerHTML = data.services.map((s) => `
                <tr>
                    <td><strong>${s.name}</strong><br><span class="muted" style="font-size:0.75rem">${s.id}</span></td>
                    <td style="font-size:0.82rem">${s.image}</td>
                    <td><span class="status status-${s.status}">${s.status}</span></td>
                    <td style="font-size:0.82rem">${s.ports || "—"}</td>
                    <td>
                        <button class="btn btn-sm btn-ghost btn-icon" onclick="restartContainer('${s.id}')" title="Restart">🔄</button>
                        ${s.status === "running"
                    ? `<button class="btn btn-sm btn-danger btn-icon" onclick="stopContainer('${s.id}')" title="Stop">⏹</button>`
                    : `<button class="btn btn-sm btn-ghost btn-icon" onclick="startContainer('${s.id}')" title="Start">▶️</button>`
                }
                    </td>
                </tr>
            `).join("");
        }
    } catch (e) {
        console.error("Status load failed:", e);
    }
}

// ══════════════════════════════════════════════
//  BACKENDS
// ══════════════════════════════════════════════

async function loadBackends() {
    try {
        const res = await fetch(`${API}/api/backends`);
        const data = await res.json();

        document.getElementById("backendCountBadge").textContent = data.total;

        const grid = document.getElementById("backendGrid");
        if (data.backends && data.backends.length > 0) {
            grid.innerHTML = data.backends.map((b) => `
                <div class="container-card">
                    <div class="cc-header">
                        <span class="cc-name">${b.name}</span>
                        <span class="status status-${b.status}">${b.status}</span>
                    </div>
                    <div class="cc-meta">
                        <span>ID: ${b.id}</span>
                        <span>Health: ${b.health}</span>
                    </div>
                    <div class="cc-actions" style="margin-top:10px">
                        <button class="btn btn-sm btn-ghost" onclick="restartContainer('${b.id}')">🔄 Restart</button>
                        <button class="btn btn-sm btn-ghost" onclick="viewContainerLogs('${b.id}')">📋 Logs</button>
                    </div>
                </div>
            `).join("");
        } else {
            grid.innerHTML = `<p class="muted">No backend containers found. Deploy a project first.</p>`;
        }
    } catch (e) {
        console.error("Backends load failed:", e);
    }
}

// ══════════════════════════════════════════════
//  SCALING
// ══════════════════════════════════════════════

const slider = document.getElementById("replicaSlider");
const sliderVal = document.getElementById("sliderValue");
slider.addEventListener("input", () => { sliderVal.textContent = slider.value; });

function setScale(n) { slider.value = n; sliderVal.textContent = n; }

async function performScale() {
    const replicas = parseInt(slider.value);
    const btn = document.getElementById("scaleBtn");
    const result = document.getElementById("scaleResult");

    btn.disabled = true;
    btn.textContent = "⏳ Scaling...";
    result.classList.remove("hidden");
    result.className = "result-box loading";
    result.textContent = `Scaling to ${replicas} replicas...`;

    try {
        const res = await fetch(`${API}/api/scale`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ replicas }),
        });
        const data = await res.json();

        if (res.ok) {
            result.className = "result-box success";
            result.textContent = `✅ Scaled to ${replicas} replicas successfully!`;
            setTimeout(loadBackends, 3000);
        } else {
            result.className = "result-box error";
            result.textContent = `❌ ${data.detail || "Scaling failed"}`;
        }
    } catch (e) {
        result.className = "result-box error";
        result.textContent = `❌ ${e.message}`;
    } finally {
        btn.disabled = false;
        btn.textContent = "🚀 Apply Scaling";
    }
}

// ══════════════════════════════════════════════
//  ALGORITHM
// ══════════════════════════════════════════════

async function setAlgorithm(algo) {
    document.querySelectorAll(".algo-card").forEach((c) => c.classList.remove("active"));
    const selected = document.querySelector(`[data-algo="${algo}"]`);
    if (selected) selected.classList.add("active");

    const result = document.getElementById("algoResult");
    result.classList.remove("hidden");
    result.className = "result-box loading";
    result.textContent = `Switching to ${algo}...`;

    try {
        const res = await fetch(`${API}/api/haproxy/algorithm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ algorithm: algo }),
        });
        const data = await res.json();

        if (res.ok) {
            result.className = "result-box success";
            result.textContent = `✅ Algorithm changed to ${algo} — HAProxy reloaded`;
        } else {
            result.className = "result-box error";
            result.textContent = `❌ ${data.detail || "Failed"}`;
        }
    } catch (e) {
        result.className = "result-box error";
        result.textContent = `❌ ${e.message}`;
    }
}

// ══════════════════════════════════════════════
//  HAPROXY CONFIG
// ══════════════════════════════════════════════

async function loadHAProxyConfig() {
    try {
        const res = await fetch(`${API}/api/haproxy/config`);
        const data = await res.json();
        document.getElementById("haproxyConfigView").textContent = data.config;
    } catch (e) {
        document.getElementById("haproxyConfigView").textContent = `Error: ${e.message}`;
    }
}

// ══════════════════════════════════════════════
//  LOGS
// ══════════════════════════════════════════════

async function loadLogs() {
    try {
        const res = await fetch(`${API}/api/logs/recent`);
        const data = await res.json();
        const viewer = document.getElementById("logViewer");
        if (data.logs && data.logs.length > 0) {
            viewer.innerHTML = data.logs.map((l) => `
                <div class="log-entry">
                    <span class="log-time">${formatTime(l.timestamp)}</span>
                    <span class="log-tag">${l.tag || "—"}</span>
                    <span class="log-msg">${escapeHtml(l.message || "")}</span>
                </div>
            `).join("");
        } else {
            viewer.innerHTML = `<p class="muted">No logs found. Deploy a project and generate traffic first.</p>`;
        }
    } catch (e) {
        document.getElementById("logViewer").innerHTML = `<p class="muted">Logs unavailable: ${e.message}</p>`;
    }
}

async function loadErrorLogs() {
    try {
        const res = await fetch(`${API}/api/logs/errors`);
        const data = await res.json();
        document.getElementById("errorCountBadge").textContent = data.total || 0;
        const viewer = document.getElementById("errorLogViewer");
        if (data.errors && data.errors.length > 0) {
            viewer.innerHTML = data.errors.map((l) => `
                <div class="log-entry">
                    <span class="log-time">${formatTime(l["@timestamp"])}</span>
                    <span class="log-tag">${l.tag || "—"}</span>
                    <span class="log-msg error">${escapeHtml(l.message || "")}</span>
                </div>
            `).join("");
        } else {
            viewer.innerHTML = `<p class="muted">No errors found. 🎉</p>`;
        }
    } catch (e) {
        document.getElementById("errorLogViewer").innerHTML = `<p class="muted">Error logs unavailable: ${e.message}</p>`;
    }
}

// ══════════════════════════════════════════════
//  HEALTH
// ══════════════════════════════════════════════

async function loadHealth() {
    try {
        const res = await fetch(`${API}/api/health`);
        const data = await res.json();
        const grid = document.getElementById("healthGrid");
        const items = [
            { name: "Controller", value: data.controller, status: data.controller === "healthy" ? "ok" : "error" },
            { name: "Docker Daemon", value: data.docker, status: data.docker === "connected" ? "ok" : "error" },
            { name: "Elasticsearch", value: data.elasticsearch, status: data.elasticsearch === "green" ? "ok" : data.elasticsearch === "yellow" ? "warning" : "error" },
            { name: "Deployment", value: data.deployment, status: data.deployment === "running" ? "ok" : data.deployment === "idle" ? "warning" : "error" },
        ];
        grid.innerHTML = items.map((i) => `
            <div class="health-item">
                <div class="hi-status ${i.status}"></div>
                <div class="hi-info">
                    <span class="hi-name">${i.name}</span>
                    <span class="hi-value">${i.value}</span>
                </div>
            </div>
        `).join("");
    } catch (e) {
        document.getElementById("healthGrid").innerHTML = `<p class="muted">Health check failed: ${e.message}</p>`;
    }
}

// ══════════════════════════════════════════════
//  CONTAINER ACTIONS
// ══════════════════════════════════════════════

async function restartContainer(id) {
    if (!confirm(`Restart container ${id}?`)) return;
    try {
        const res = await fetch(`${API}/api/container/${id}/restart`, { method: "POST" });
        const data = await res.json();
        alert(`Container ${data.container}: ${data.status}`);
        refreshAll();
    } catch (e) { alert(`Error: ${e.message}`); }
}

async function stopContainer(id) {
    if (!confirm(`Stop container ${id}?`)) return;
    try {
        const res = await fetch(`${API}/api/container/${id}/stop`, { method: "POST" });
        const data = await res.json();
        alert(`Container ${data.container}: ${data.status}`);
        refreshAll();
    } catch (e) { alert(`Error: ${e.message}`); }
}

async function startContainer(id) {
    try {
        const res = await fetch(`${API}/api/container/${id}/start`, { method: "POST" });
        const data = await res.json();
        alert(`Container ${data.container}: ${data.status}`);
        refreshAll();
    } catch (e) { alert(`Error: ${e.message}`); }
}

async function viewContainerLogs(id) {
    try {
        const res = await fetch(`${API}/api/container/${id}/logs?tail=50`);
        const data = await res.json();
        switchSection("logs");
        const viewer = document.getElementById("logViewer");
        viewer.innerHTML = `<div style="margin-bottom:12px"><strong>Logs for: ${data.container}</strong></div>` +
            data.logs.map((line) => `<div class="log-entry"><span class="log-msg">${escapeHtml(line)}</span></div>`).join("");
    } catch (e) { alert(`Error: ${e.message}`); }
}

// ══════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════

function formatTime(isoStr) {
    if (!isoStr) return "--:--:--";
    try { return new Date(isoStr).toLocaleTimeString(); }
    catch { return isoStr.substring(11, 19); }
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

// ══════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════

updateTimestamp();
loadDeploymentStatus();
