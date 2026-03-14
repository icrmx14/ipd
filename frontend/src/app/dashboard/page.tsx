'use client';

import { useState, useCallback, useEffect } from 'react';
import BackgroundCanvas from '@/components/BackgroundCanvas/BackgroundCanvas';
import Sidebar from '@/components/Sidebar/Sidebar';
import {
    IconContainer,
    IconCheck,
    IconGear,
    IconStop,
    IconCode,
    IconGlobe,
    IconDatabase,
    IconLogs,
    IconRefresh,
    IconRocket,
    IconHourglass,
    IconChart,
    IconBalancer,
    IconLoop,
    IconTrendDown,
    IconPin,
    IconSearch,
    IconMonitor,
    IconServer,
    IconPlay,
    IconParty,
} from '@/components/Icons/Icons';

// ─── Types ───
interface ServiceInfo {
    id: string;
    name: string;
    status: string;
    image: string;
    ports: string;
}

interface BackendInfo {
    id: string;
    name: string;
    status: string;
    health: string;
}

type Section = 'upload' | 'overview' | 'containers' | 'scaling' | 'loadbalancer' | 'logs' | 'monitoring';

const SECTION_TITLES: Record<Section, string> = {
    upload: 'Upload & Deploy',
    overview: 'System Overview',
    containers: 'Container Management',
    scaling: 'Backend Scaling',
    loadbalancer: 'Load Balancer',
    logs: 'System Logs',
    monitoring: 'Monitoring',
};

const API = '';

// ─── Helpers ───
function formatTime(iso: string) {
    if (!iso) return '--:--:--';
    try { return new Date(iso).toLocaleTimeString(); }
    catch { return iso.substring(11, 19); }
}

function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// ═══════════════════════════════════════════════
//  DASHBOARD PAGE
// ═══════════════════════════════════════════════

export default function DashboardPage() {
    const [activeSection, setActiveSection] = useState<Section>('upload');
    const [lastUpdated, setLastUpdated] = useState('--:--:--');

    // ── Upload State ──
    const [uploadState, setUploadState] = useState({ backend: false, frontend: false, database: false });
    const [uploadInfo, setUploadInfo] = useState<Record<string, string>>({});
    const [stepState, setStepState] = useState({ step1: 'active', step2: '', step3: '' });

    // ── Config ──
    const [projectName, setProjectName] = useState('myproject');
    const [backendPort, setBackendPort] = useState('');
    const [replicaCount, setReplicaCount] = useState(3);
    const [lbAlgorithm, setLbAlgorithm] = useState('roundrobin');
    const [dbType, setDbType] = useState('mongodb');
    const [enableDb, setEnableDb] = useState(true);

    // ── Deploy ──
    const [deploying, setDeploying] = useState(false);
    const [deployLog, setDeployLog] = useState<string[]>([]);
    const [deployStatus, setDeployStatus] = useState('idle');
    const [showStopBtn, setShowStopBtn] = useState(false);

    // ── Overview ──
    const [stats, setStats] = useState({ total: '--', running: '--', backends: '--', stopped: '--' });
    const [services, setServices] = useState<ServiceInfo[]>([]);

    // ── Backends ──
    const [backends, setBackends] = useState<BackendInfo[]>([]);
    const [backendCount, setBackendCount] = useState(0);

    // ── Scaling ──
    const [sliderValue, setSliderValue] = useState(3);
    const [scaleResult, setScaleResult] = useState<{ type: string; msg: string } | null>(null);
    const [scaling, setScaling] = useState(false);

    // ── Algorithm ──
    const [activeAlgo, setActiveAlgo] = useState('');
    const [algoResult, setAlgoResult] = useState<{ type: string; msg: string } | null>(null);

    // ── HAProxy Config ──
    const [haproxyConfig, setHaproxyConfig] = useState('Loading...');

    // ── Logs ──
    const [logs, setLogs] = useState<any[]>([]);
    const [errorLogs, setErrorLogs] = useState<any[]>([]);
    const [errorCount, setErrorCount] = useState(0);

    // ── Health ──
    const [healthItems, setHealthItems] = useState<{ name: string; value: string; status: string }[]>([]);

    // ── Sidebar Health ──
    const [sidebarHealth, setSidebarHealth] = useState<{ dot: string; label: string }>({ dot: '', label: 'System Ready' });

    // ─── Section Switch ───
    const switchSection = useCallback((section: Section) => {
        setActiveSection(section);
        if (section === 'overview') loadStatus();
        if (section === 'containers') loadBackends();
        if (section === 'logs') { loadLogs(); loadErrorLogs(); }
        if (section === 'loadbalancer') loadHAProxyConfig();
        if (section === 'monitoring') loadHealth();
    }, []);

    // ─── Auto Refresh ───
    useEffect(() => {
        updateTimestamp();
        loadDeploymentStatus();
        const interval = setInterval(() => {
            updateTimestamp();
            loadDeploymentStatus();
        }, 20000);
        return () => clearInterval(interval);
    }, []);

    function updateTimestamp() {
        setLastUpdated(new Date().toLocaleTimeString());
    }

    // ═══════════════════════════════════════
    //  API CALLS
    // ═══════════════════════════════════════

    async function uploadFile(serviceType: string, file: File) {
        if (!file.name.endsWith('.zip')) { alert('Please upload a ZIP file.'); return; }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('project_name', projectName);

        try {
            const res = await fetch(`${API}/api/upload/${serviceType}`, { method: 'POST', body: formData });
            const data = await res.json();

            if (res.ok) {
                setUploadState(prev => ({ ...prev, [serviceType]: true }));
                const stackName = data.stack ? `${data.stack.framework} (${data.stack.type})` : 'detected';
                const dfMsg = data.dockerfile_generated ? ' | Dockerfile auto-generated' : ' | Using existing Dockerfile';
                setUploadInfo(prev => ({
                    ...prev,
                    [serviceType]: `${file.name} — ${data.file_count} files — ${stackName}${dfMsg}`,
                }));

                if (serviceType === 'backend') {
                    setStepState({ step1: 'done', step2: 'active', step3: '' });
                }
            } else {
                alert(data.detail || 'Upload failed');
            }
        } catch (e: any) {
            alert(`Upload error: ${e.message}`);
        }
    }

    async function deployProject() {
        if (!uploadState.backend) { alert('Please upload a backend service first (ZIP file).'); return; }

        setDeploying(true);
        setDeployLog(['Starting deployment...']);
        setDeployStatus('deploying');

        const payload = {
            project_name: projectName,
            backend_port: backendPort ? parseInt(backendPort) : null,
            replicas: replicaCount,
            algorithm: lbAlgorithm,
            db_type: dbType,
            enable_db: enableDb,
        };

        try {
            const res = await fetch(`${API}/api/deploy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();

            if (res.ok && data.status === 'success') {
                setDeployStatus('running');
                setShowStopBtn(true);
                setStepState({ step1: 'done', step2: 'done', step3: 'done' });
                if (data.log) setDeployLog(data.log);
            } else {
                setDeployStatus('error');
                const errorDetail = data.detail || data;
                if (errorDetail.log) setDeployLog(errorDetail.log);
                else setDeployLog([JSON.stringify(errorDetail)]);
            }
        } catch (e: any) {
            setDeployStatus('error');
            setDeployLog([`Error: ${e.message}`]);
        } finally {
            setDeploying(false);
        }
    }

    async function stopDeployment() {
        if (!confirm('Stop the current deployment? This will shut down all containers.')) return;
        try {
            await fetch(`${API}/api/stop`, { method: 'POST' });
            setShowStopBtn(false);
            setDeployStatus('stopped');
            alert('Deployment stopped.');
        } catch (e: any) { alert(`Error: ${e.message}`); }
    }

    async function loadDeploymentStatus() {
        try {
            const res = await fetch(`${API}/api/deploy/status`);
            const data = await res.json();
            if (data.status === 'running') {
                setSidebarHealth({ dot: 'healthy', label: 'Deployed & Running' });
            } else if (data.status === 'error') {
                setSidebarHealth({ dot: 'unhealthy', label: 'Deployment Error' });
            } else {
                setSidebarHealth({ dot: 'warning', label: 'No Deployment' });
            }
        } catch { /* ignore */ }
    }

    async function loadStatus() {
        try {
            const res = await fetch(`${API}/api/status`);
            const data = await res.json();
            setStats({
                total: data.total_containers,
                running: data.running,
                backends: data.backend_replicas,
                stopped: data.stopped,
            });
            if (data.services) setServices(data.services);
        } catch { /* ignore */ }
    }

    async function loadBackends() {
        try {
            const res = await fetch(`${API}/api/backends`);
            const data = await res.json();
            setBackendCount(data.total);
            setBackends(data.backends || []);
        } catch { /* ignore */ }
    }

    async function performScale() {
        setScaling(true);
        setScaleResult({ type: 'loading', msg: `Scaling to ${sliderValue} replicas...` });
        try {
            const res = await fetch(`${API}/api/scale`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ replicas: sliderValue }),
            });
            const data = await res.json();
            if (res.ok) {
                setScaleResult({ type: 'success', msg: `Scaled to ${sliderValue} replicas successfully!` });
                setTimeout(loadBackends, 3000);
            } else {
                setScaleResult({ type: 'error', msg: `${data.detail || 'Scaling failed'}` });
            }
        } catch (e: any) {
            setScaleResult({ type: 'error', msg: `${e.message}` });
        } finally {
            setScaling(false);
        }
    }

    async function setAlgorithm(algo: string) {
        setActiveAlgo(algo);
        setAlgoResult({ type: 'loading', msg: `Switching to ${algo}...` });
        try {
            const res = await fetch(`${API}/api/haproxy/algorithm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ algorithm: algo }),
            });
            const data = await res.json();
            if (res.ok) {
                setAlgoResult({ type: 'success', msg: `Algorithm changed to ${algo} — HAProxy reloaded` });
            } else {
                setAlgoResult({ type: 'error', msg: `${data.detail || 'Failed'}` });
            }
        } catch (e: any) {
            setAlgoResult({ type: 'error', msg: `${e.message}` });
        }
    }

    async function loadHAProxyConfig() {
        try {
            const res = await fetch(`${API}/api/haproxy/config`);
            const data = await res.json();
            setHaproxyConfig(data.config);
        } catch (e: any) { setHaproxyConfig(`Error: ${e.message}`); }
    }

    async function loadLogs() {
        try {
            const res = await fetch(`${API}/api/logs/recent`);
            const data = await res.json();
            setLogs(data.logs || []);
        } catch {
            setLogs([]);
        }
    }

    async function loadErrorLogs() {
        try {
            const res = await fetch(`${API}/api/logs/errors`);
            const data = await res.json();
            setErrorCount(data.total || 0);
            setErrorLogs(data.errors || []);
        } catch {
            setErrorLogs([]);
        }
    }

    async function loadHealth() {
        try {
            const res = await fetch(`${API}/api/health`);
            const data = await res.json();
            setHealthItems([
                { name: 'Controller', value: data.controller, status: data.controller === 'healthy' ? 'ok' : 'error' },
                { name: 'Docker Daemon', value: data.docker, status: data.docker === 'connected' ? 'ok' : 'error' },
                { name: 'Elasticsearch', value: data.elasticsearch, status: data.elasticsearch === 'green' ? 'ok' : data.elasticsearch === 'yellow' ? 'warning' : 'error' },
                { name: 'Deployment', value: data.deployment, status: data.deployment === 'running' ? 'ok' : data.deployment === 'idle' ? 'warning' : 'error' },
            ]);
        } catch (e: any) {
            setHealthItems([{ name: 'Error', value: e.message, status: 'error' }]);
        }
    }

    async function containerAction(id: string, action: string) {
        if (action !== 'start' && !confirm(`${capitalize(action)} container ${id}?`)) return;
        try {
            const res = await fetch(`${API}/api/container/${id}/${action}`, { method: 'POST' });
            const data = await res.json();
            alert(`Container ${data.container}: ${data.status}`);
            loadStatus();
            loadBackends();
        } catch (e: any) { alert(`Error: ${e.message}`); }
    }

    // ─── File Drop Handlers ───
    function handleFilePick(type: string) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.zip';
        input.onchange = () => {
            if (input.files && input.files[0]) uploadFile(type, input.files[0]);
        };
        input.click();
    }

    // Upload icon map
    const uploadIcons: Record<string, React.ReactNode> = {
        backend: <IconCode size={36} color="var(--accent)" />,
        frontend: <IconGlobe size={36} color="var(--green)" />,
        database: <IconDatabase size={36} color="var(--orange)" />,
    };

    // ═══════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════

    return (
        <>
            <BackgroundCanvas />
            <div className="app-layout">
                <Sidebar
                    activeSection={activeSection}
                    onSwitch={switchSection}
                    health={sidebarHealth}
                />

                <main className="main-content">
                    <header className="top-bar">
                        <h1>{SECTION_TITLES[activeSection]}</h1>
                        <div className="top-bar-actions">
                            <span className="timestamp-label">{lastUpdated}</span>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => { updateTimestamp(); loadDeploymentStatus(); }}
                                title="Refresh"
                            >
                                <IconRefresh size={16} />
                            </button>
                        </div>
                    </header>

                    {/* ═══ UPLOAD & DEPLOY ═══ */}
                    {activeSection === 'upload' && (
                        <section className="content-section" key="upload">
                            {/* Steps */}
                            <div className="steps-bar">
                                <div className={`step ${stepState.step1}`}><span className="step-num">1</span><span>Upload Services</span></div>
                                <div className="step-line" />
                                <div className={`step ${stepState.step2}`}><span className="step-num">2</span><span>Configure</span></div>
                                <div className="step-line" />
                                <div className={`step ${stepState.step3}`}><span className="step-num">3</span><span>Deploy</span></div>
                            </div>

                            {/* Upload Cards */}
                            <div className="upload-grid">
                                {(['backend', 'frontend', 'database'] as const).map((svc) => (
                                    <div key={svc} className={`upload-card ${uploadState[svc] ? 'uploaded' : ''}`}>
                                        <div className="upload-card-icon">
                                            {uploadIcons[svc]}
                                        </div>
                                        <h3>{capitalize(svc)} Service</h3>
                                        <p>
                                            {svc === 'backend' && 'Upload your backend code as a ZIP file (Flask, Django, Express, Spring, etc.)'}
                                            {svc === 'frontend' && 'Upload your frontend code as a ZIP file (HTML/CSS/JS, React, Vue, etc.)'}
                                            {svc === 'database' && 'Upload init scripts or select a database type below'}
                                        </p>
                                        <div
                                            className={`upload-zone ${uploadState[svc] ? 'uploaded' : ''}`}
                                            onClick={() => !uploadState[svc] && handleFilePick(svc)}
                                            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('dragover'); }}
                                            onDragLeave={(e) => e.currentTarget.classList.remove('dragover')}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                e.currentTarget.classList.remove('dragover');
                                                if (e.dataTransfer.files[0]) uploadFile(svc, e.dataTransfer.files[0]);
                                            }}
                                        >
                                            {uploadState[svc] ? (
                                                <div className="upload-success">
                                                    <IconCheck size={18} color="var(--green)" />
                                                    <span>{uploadInfo[svc] || 'Uploaded'}</span>
                                                </div>
                                            ) : (
                                                <div className="upload-placeholder">
                                                    <span className="upload-plus">+</span>
                                                    <span>Drop ZIP or click to browse</span>
                                                </div>
                                            )}
                                        </div>
                                        <span className="upload-status-tag">
                                            {uploadState[svc] ? (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><IconCheck size={12} color="var(--green)" /> Uploaded</span>
                                            ) : svc === 'backend' ? 'Required' : 'Optional'}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Config */}
                            <div className="glass-card">
                                <div className="card-header"><h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><IconGear size={18} /> Deployment Configuration</h2></div>
                                <div className="card-body">
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                                        <div className="form-field">
                                            <label>Project Name</label>
                                            <input className="form-input" value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="my-project" />
                                        </div>
                                        <div className="form-field">
                                            <label>Backend Port</label>
                                            <input className="form-input" type="number" value={backendPort} onChange={e => setBackendPort(e.target.value)} placeholder="Auto-detect" />
                                            <span className="form-hint">Leave empty for auto-detection</span>
                                        </div>
                                        <div className="form-field">
                                            <label>Backend Replicas</label>
                                            <input className="form-input" type="number" min={1} max={20} value={replicaCount} onChange={e => setReplicaCount(Number(e.target.value))} />
                                        </div>
                                        <div className="form-field">
                                            <label>LB Algorithm</label>
                                            <select className="form-select" value={lbAlgorithm} onChange={e => setLbAlgorithm(e.target.value)}>
                                                <option value="roundrobin">Round Robin</option>
                                                <option value="leastconn">Least Connections</option>
                                                <option value="source">Source IP Hash</option>
                                            </select>
                                        </div>
                                        <div className="form-field">
                                            <label>Database Type</label>
                                            <select className="form-select" value={dbType} onChange={e => setDbType(e.target.value)}>
                                                <option value="mongodb">MongoDB</option>
                                                <option value="mysql">MySQL</option>
                                                <option value="postgres">PostgreSQL</option>
                                            </select>
                                        </div>
                                        <div className="form-field" style={{ justifyContent: 'center' }}>
                                            <label className="checkbox-label">
                                                <input type="checkbox" checked={enableDb} onChange={e => setEnableDb(e.target.checked)} />
                                                <span>Enable Database</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Deploy Actions */}
                            <div className="deploy-actions">
                                <button className="btn btn-primary btn-lg" disabled={deploying} onClick={deployProject} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {deploying ? (
                                        <><IconHourglass size={18} /> Deploying...</>
                                    ) : (
                                        <><IconRocket size={18} /> Build & Deploy Project</>
                                    )}
                                </button>
                                {showStopBtn && (
                                    <button className="btn btn-danger btn-lg" onClick={stopDeployment} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <IconStop size={18} /> Stop Deployment
                                    </button>
                                )}
                            </div>

                            {/* Deploy Log */}
                            {deployLog.length > 0 && (
                                <div className="glass-card">
                                    <div className="card-header">
                                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><IconLogs size={18} /> Deployment Log</h2>
                                        <span className={`badge ${deployStatus.includes('running') ? 'badge-green' : deployStatus.includes('error') ? 'badge-red' : 'badge-blue'}`}>
                                            {deployStatus}
                                        </span>
                                    </div>
                                    <div className="card-body">
                                        <div className="log-viewer">
                                            {deployLog.map((line, i) => (
                                                <div className="log-entry" key={i}>
                                                    <span className="log-msg">{line}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </section>
                    )}

                    {/* ═══ OVERVIEW ═══ */}
                    {activeSection === 'overview' && (
                        <section className="content-section" key="overview">
                            <div className="stats-grid">
                                <div className="stat-card"><div className="stat-icon blue"><IconContainer size={22} color="var(--accent)" /></div><div><div className="stat-value">{stats.total}</div><div className="stat-label">Total Containers</div></div></div>
                                <div className="stat-card"><div className="stat-icon green"><IconCheck size={22} color="var(--green)" /></div><div><div className="stat-value">{stats.running}</div><div className="stat-label">Running</div></div></div>
                                <div className="stat-card"><div className="stat-icon orange"><IconGear size={22} color="var(--orange)" /></div><div><div className="stat-value">{stats.backends}</div><div className="stat-label">Backend Replicas</div></div></div>
                                <div className="stat-card"><div className="stat-icon red"><IconStop size={22} color="var(--red)" /></div><div><div className="stat-value">{stats.stopped}</div><div className="stat-label">Stopped</div></div></div>
                            </div>

                            <div className="glass-card">
                                <div className="card-header"><h2>All Services</h2></div>
                                <div className="card-body">
                                    <table className="data-table">
                                        <thead><tr><th>Container</th><th>Image</th><th>Status</th><th>Ports</th><th>Actions</th></tr></thead>
                                        <tbody>
                                            {services.length > 0 ? services.map(s => (
                                                <tr key={s.id}>
                                                    <td><strong>{s.name}</strong><br /><span className="muted" style={{ fontSize: '0.75rem' }}>{s.id}</span></td>
                                                    <td style={{ fontSize: '0.82rem' }}>{s.image}</td>
                                                    <td><span className={`status-pill status-${s.status}`}>{s.status}</span></td>
                                                    <td style={{ fontSize: '0.82rem' }}>{s.ports || '—'}</td>
                                                    <td>
                                                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => containerAction(s.id, 'restart')} title="Restart"><IconRefresh size={14} /></button>
                                                        {s.status === 'running'
                                                            ? <button className="btn btn-danger btn-icon btn-sm" onClick={() => containerAction(s.id, 'stop')} title="Stop"><IconStop size={14} /></button>
                                                            : <button className="btn btn-ghost btn-icon btn-sm" onClick={() => containerAction(s.id, 'start')} title="Start"><IconPlay size={12} /></button>
                                                        }
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr><td colSpan={5} className="muted text-center" style={{ padding: '24px' }}>Loading...</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="quick-links">
                                <a href="http://localhost:8404/stats" target="_blank" rel="noopener" className="quick-link-card"><span className="ql-icon"><IconBalancer size={24} color="var(--accent)" /></span><span className="ql-label">HAProxy Stats</span><span className="ql-port">:8404</span></a>
                                <a href="http://localhost:5601" target="_blank" rel="noopener" className="quick-link-card"><span className="ql-icon"><IconChart size={24} color="var(--green)" /></span><span className="ql-label">Kibana</span><span className="ql-port">:5601</span></a>
                                <a href="http://localhost:9200" target="_blank" rel="noopener" className="quick-link-card"><span className="ql-icon"><IconSearch size={24} color="var(--orange)" /></span><span className="ql-label">Elasticsearch</span><span className="ql-port">:9200</span></a>
                                <a href="http://localhost:8080" target="_blank" rel="noopener" className="quick-link-card"><span className="ql-icon"><IconGlobe size={24} color="var(--purple)" /></span><span className="ql-label">App (via LB)</span><span className="ql-port">:8080</span></a>
                            </div>
                        </section>
                    )}

                    {/* ═══ CONTAINERS ═══ */}
                    {activeSection === 'containers' && (
                        <section className="content-section" key="containers">
                            <div className="glass-card">
                                <div className="card-header">
                                    <h2>Backend Containers</h2>
                                    <span className="badge badge-blue">{backendCount}</span>
                                </div>
                                <div className="card-body">
                                    {backends.length > 0 ? (
                                        <div className="container-grid">
                                            {backends.map(b => (
                                                <div className="container-card" key={b.id}>
                                                    <div className="cc-header">
                                                        <span className="cc-name">{b.name}</span>
                                                        <span className={`status-pill status-${b.status}`}>{b.status}</span>
                                                    </div>
                                                    <div className="cc-meta">
                                                        <span>ID: {b.id}</span>
                                                        <span>Health: {b.health}</span>
                                                    </div>
                                                    <div className="cc-actions">
                                                        <button className="btn btn-ghost btn-sm" onClick={() => containerAction(b.id, 'restart')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconRefresh size={14} /> Restart</button>
                                                        <button className="btn btn-ghost btn-sm" onClick={() => { }} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconLogs size={14} /> Logs</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="muted text-center">No backend containers found. Deploy a project first.</p>
                                    )}
                                </div>
                            </div>
                        </section>
                    )}

                    {/* ═══ SCALING ═══ */}
                    {activeSection === 'scaling' && (
                        <section className="content-section" key="scaling">
                            <div className="glass-card">
                                <div className="card-header"><h2>Scale Backend Instances</h2></div>
                                <div className="card-body">
                                    <div className="scale-control">
                                        <label style={{ fontWeight: 600, fontSize: '1rem' }}>Number of Replicas</label>
                                        <div className="slider-group">
                                            <input type="range" className="slider" min={1} max={20} value={sliderValue} onChange={e => setSliderValue(Number(e.target.value))} />
                                            <span className="slider-value">{sliderValue}</span>
                                        </div>
                                        <div className="scale-presets">
                                            {[1, 3, 5, 10, 15, 20].map(n => (
                                                <button key={n} className="btn btn-outline btn-sm" onClick={() => setSliderValue(n)}>{n}</button>
                                            ))}
                                        </div>
                                        <button className="btn btn-primary btn-lg" disabled={scaling} onClick={performScale} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {scaling ? (
                                                <><IconHourglass size={18} /> Scaling...</>
                                            ) : (
                                                <><IconRocket size={18} /> Apply Scaling</>
                                            )}
                                        </button>
                                        {scaleResult && <div className={`result-box ${scaleResult.type}`}>{scaleResult.msg}</div>}
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* ═══ LOAD BALANCER ═══ */}
                    {activeSection === 'loadbalancer' && (
                        <section className="content-section" key="loadbalancer">
                            <div className="glass-card">
                                <div className="card-header"><h2>Load Balancing Algorithm</h2></div>
                                <div className="card-body">
                                    <div className="algo-grid">
                                        {[
                                            { key: 'roundrobin', icon: <IconLoop size={28} color="var(--accent)" />, title: 'Round Robin', desc: 'Equal distribution in sequence. Best for uniform workloads.' },
                                            { key: 'leastconn', icon: <IconTrendDown size={28} color="var(--green)" />, title: 'Least Connections', desc: 'Routes to least-busy server. Best for variable-length requests.' },
                                            { key: 'source', icon: <IconPin size={28} color="var(--orange)" />, title: 'Source IP Hash', desc: 'Sticky sessions — same client always hits same server.' },
                                        ].map(a => (
                                            <div key={a.key} className={`algo-card ${activeAlgo === a.key ? 'active' : ''}`} onClick={() => setAlgorithm(a.key)}>
                                                <div className="algo-card-icon">{a.icon}</div>
                                                <h3>{a.title}</h3>
                                                <p>{a.desc}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {algoResult && <div className={`result-box ${algoResult.type}`}>{algoResult.msg}</div>}
                                </div>
                            </div>

                            <div className="glass-card">
                                <div className="card-header">
                                    <h2>HAProxy Configuration</h2>
                                    <button className="btn btn-ghost btn-sm" onClick={loadHAProxyConfig}>Reload</button>
                                </div>
                                <div className="card-body">
                                    <pre className="config-viewer">{haproxyConfig}</pre>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* ═══ LOGS ═══ */}
                    {activeSection === 'logs' && (
                        <section className="content-section" key="logs">
                            <div className="glass-card">
                                <div className="card-header">
                                    <h2>Recent Logs</h2>
                                    <button className="btn btn-ghost btn-sm" onClick={loadLogs}><IconRefresh size={14} /></button>
                                </div>
                                <div className="card-body">
                                    <div className="log-viewer">
                                        {logs.length > 0 ? logs.map((l, i) => (
                                            <div className="log-entry" key={i}>
                                                <span className="log-time-col">{formatTime(l.timestamp)}</span>
                                                <span className="log-tag">{l.tag || '—'}</span>
                                                <span className="log-msg">{l.message || ''}</span>
                                            </div>
                                        )) : (
                                            <p className="muted">No logs found. Deploy a project and generate traffic first.</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="glass-card">
                                <div className="card-header">
                                    <h2>Error Logs</h2>
                                    <span className="badge badge-red">{errorCount}</span>
                                </div>
                                <div className="card-body">
                                    <div className="log-viewer">
                                        {errorLogs.length > 0 ? errorLogs.map((l, i) => (
                                            <div className="log-entry" key={i}>
                                                <span className="log-time-col">{formatTime(l['@timestamp'])}</span>
                                                <span className="log-tag">{l.tag || '—'}</span>
                                                <span className="log-msg error">{l.message || ''}</span>
                                            </div>
                                        )) : (
                                            <p className="muted" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>No errors found. <IconParty size={16} color="var(--green)" /></p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* ═══ MONITORING ═══ */}
                    {activeSection === 'monitoring' && (
                        <section className="content-section" key="monitoring">
                            <div className="glass-card">
                                <div className="card-header"><h2>System Health</h2></div>
                                <div className="card-body">
                                    {healthItems.length > 0 ? (
                                        <div className="health-grid">
                                            {healthItems.map((h, i) => (
                                                <div className="health-item" key={i}>
                                                    <div className={`hi-dot ${h.status}`} />
                                                    <div>
                                                        <div className="hi-name">{h.name}</div>
                                                        <div className="hi-value">{h.value}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="muted">Checking...</p>
                                    )}
                                </div>
                            </div>

                            <div className="glass-card">
                                <div className="card-header"><h2>External Dashboards</h2></div>
                                <div className="card-body monitoring-links">
                                    <a href="http://localhost:5601/app/discover" target="_blank" rel="noopener" className="monitoring-link"><span className="monitoring-link-icon"><IconChart size={18} /></span> Kibana Discover</a>
                                    <a href="http://localhost:5601/app/dashboards" target="_blank" rel="noopener" className="monitoring-link"><span className="monitoring-link-icon"><IconMonitor size={18} /></span> Kibana Dashboards</a>
                                    <a href="http://localhost:8404/stats" target="_blank" rel="noopener" className="monitoring-link"><span className="monitoring-link-icon"><IconBalancer size={18} /></span> HAProxy Statistics</a>
                                    <a href="http://localhost:9200/_cat/indices?v" target="_blank" rel="noopener" className="monitoring-link"><span className="monitoring-link-icon"><IconServer size={18} /></span> Elasticsearch Indices</a>
                                </div>
                            </div>
                        </section>
                    )}
                </main>
            </div>
        </>
    );
}
