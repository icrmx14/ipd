'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import BackgroundCanvas from '@/components/BackgroundCanvas/BackgroundCanvas';
import {
    IconServer,
    IconError,
    IconArrowLeft,
} from '@/components/Icons/Icons';

const CONFIG = {
    colors: ['#f87171', '#fb923c', '#fbbf24', '#34d399', '#22d3ee', '#4f8ff7', '#a78bfa', '#f472b6', '#94a3b8', '#e879f9'],
    burstCount: 10,
    burstDelayMs: 150,
    maxLogEntries: 50,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface LogEntry {
    id: number;
    server: string;
    time: string;
}

export default function LoadBalancerPage() {
    const [requestCount, setRequestCount] = useState(0);
    const [serverHits, setServerHits] = useState<Record<string, number>>({});
    const [colorMap, setColorMap] = useState<Record<string, string>>({});
    const [colorIndex, setColorIndex] = useState(0);
    const [response, setResponse] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [log, setLog] = useState<LogEntry[]>([]);
    const [isBursting, setIsBursting] = useState(false);

    const handleRequest = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/').catch(() => null);
            let data;

            if (res && res.ok) {
                data = await res.json();
            } else {
                // Mock fallback for demo
                const mockServers = ['Server-Alpha', 'Server-Beta', 'Server-Gamma', 'Server-Delta'];
                const randomServer = mockServers[Math.floor(Math.random() * mockServers.length)];
                data = {
                    server_id: randomServer,
                    message: 'Request processed successfully.',
                    timestamp: new Date().toLocaleTimeString(),
                };
            }

            setRequestCount((prev) => prev + 1);
            setServerHits((prev) => {
                const newHits = { ...prev };
                if (!newHits[data.server_id]) {
                    newHits[data.server_id] = 0;
                    setColorMap((prevColors) => ({
                        ...prevColors,
                        [data.server_id]: CONFIG.colors[colorIndex % CONFIG.colors.length],
                    }));
                    setColorIndex((prev) => prev + 1);
                }
                newHits[data.server_id]++;
                return newHits;
            });
            setResponse(data);
            setLog((prev) => [{
                id: requestCount + 1,
                server: data.server_id,
                time: data.timestamp,
            }, ...prev.slice(0, CONFIG.maxLogEntries - 1)]);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [requestCount, colorIndex]);

    const handleBurst = useCallback(async () => {
        setIsBursting(true);
        for (let i = 0; i < CONFIG.burstCount; i++) {
            await handleRequest();
            await sleep(CONFIG.burstDelayMs);
        }
        setIsBursting(false);
    }, [handleRequest]);

    const sortedHits = Object.entries(serverHits).sort((a, b) => b[1] - a[1]);
    const maxHits = Math.max(...Object.values(serverHits), 1);

    return (
        <>
            <BackgroundCanvas />

            <div style={{ minHeight: '100vh', position: 'relative', zIndex: 10 }}>
                {/* Top Nav */}
                <nav style={{
                    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
                    height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0 32px',
                    background: 'rgba(3, 0, 20, 0.7)', backdropFilter: 'blur(16px)',
                    borderBottom: '1px solid var(--border)',
                }}>
                    <Link href="/" style={{
                        fontWeight: 800, fontSize: '1.1rem',
                        background: 'linear-gradient(135deg, var(--accent), var(--purple))',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        display: 'flex', alignItems: 'center', gap: '8px',
                    }}>
                        <IconArrowLeft size={16} color="var(--accent)" />
                        IPD Platform
                    </Link>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Load Balancer Demo
                    </span>
                </nav>

                {/* Content */}
                <main style={{
                    maxWidth: '800px', width: '100%', margin: '0 auto',
                    padding: '100px 24px 60px',
                    display: 'flex', flexDirection: 'column', gap: '28px',
                }}>
                    {/* Hero */}
                    <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                        <h1 style={{
                            fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 900,
                            background: 'linear-gradient(135deg, #4f8ff7 0%, #a78bfa 50%, #f87171 100%)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                            filter: 'drop-shadow(0 4px 15px rgba(0,0,0,0.2))',
                            marginBottom: '8px',
                        }}>
                            HAProxy Load Balancer
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                            Send requests and watch real-time distribution across backend servers
                        </p>
                    </div>

                    {/* Controls */}
                    <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                        <button
                            onClick={handleRequest}
                            disabled={loading || isBursting}
                            className="btn"
                            style={{
                                background: 'var(--bg-card)', color: 'var(--accent)',
                                border: '1px solid var(--border)', padding: '16px 32px',
                                borderRadius: '12px', fontSize: '1rem',
                            }}
                        >
                            Send Request
                        </button>
                        <button
                            onClick={handleBurst}
                            disabled={loading || isBursting}
                            className="btn"
                            style={{
                                background: 'linear-gradient(135deg, var(--accent), var(--red), var(--accent))',
                                backgroundSize: '200% 100%', color: 'white',
                                border: 'none', padding: '16px 32px', borderRadius: '12px', fontSize: '1rem',
                                animation: 'cosmicDrift 4s ease infinite',
                            }}
                        >
                            {isBursting ? 'Sending...' : `Send ${CONFIG.burstCount} Requests`}
                        </button>
                    </div>

                    {/* Response Card */}
                    <div className="glass-card" style={{ minHeight: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="card-body" style={{ textAlign: 'center', width: '100%' }}>
                            {loading && (
                                <div style={{
                                    width: '30px', height: '30px', margin: '0 auto',
                                    border: '3px solid rgba(255,255,255,0.1)',
                                    borderTop: '3px solid var(--accent)',
                                    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                                }} />
                            )}
                            {!loading && response && (
                                <div>
                                    <h3 style={{ fontSize: '1.75rem', fontWeight: 700, color: colorMap[response.server_id] || 'var(--accent)', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                        <IconServer size={24} color={colorMap[response.server_id] || 'var(--accent)'} /> {response.server_id}
                                    </h3>
                                    <p style={{ color: 'var(--text-primary)' }}>{response.message}</p>
                                    <small style={{ color: 'var(--text-muted)' }}>{response.timestamp}</small>
                                </div>
                            )}
                            {!loading && error && (
                                <div>
                                    <h3 style={{ color: 'var(--red)', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                        <IconError size={22} color="var(--red)" /> Error
                                    </h3>
                                    <p>{error}</p>
                                </div>
                            )}
                            {!loading && !response && !error && (
                                <p className="muted" style={{ fontStyle: 'italic' }}>Click a button to see which server responds...</p>
                            )}
                        </div>
                    </div>

                    {/* Distribution Chart */}
                    <div className="glass-card">
                        <div className="card-header"><h2 style={{ color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '1rem' }}>Server Distribution</h2></div>
                        <div className="card-body">
                            {sortedHits.length > 0 ? (
                                <>
                                    {sortedHits.map(([server, count]) => {
                                        const pct = (count / maxHits) * 100;
                                        const color = colorMap[server];
                                        return (
                                            <div key={server} style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600, minWidth: '110px', color }}>{server}</span>
                                                <div style={{ flex: 1, height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '20px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: '20px', background: color, transition: 'width 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }} />
                                                </div>
                                                <span style={{ fontWeight: 700, minWidth: '90px', textAlign: 'right', fontSize: '0.85rem' }}>
                                                    {count} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({((count / requestCount) * 100).toFixed(1)}%)</span>
                                                </span>
                                            </div>
                                        );
                                    })}
                                    <div style={{ display: 'flex', gap: '20px', marginTop: '20px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem' }}>
                                        <span>Total: {requestCount}</span>
                                        <span>Servers: {Object.keys(serverHits).length}</span>
                                    </div>
                                </>
                            ) : (
                                <p className="muted" style={{ fontStyle: 'italic' }}>Send requests to see distribution data...</p>
                            )}
                        </div>
                    </div>

                    {/* Request Log */}
                    <div className="glass-card">
                        <div className="card-header"><h2 style={{ color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '1rem' }}>Request Log</h2></div>
                        <div className="card-body">
                            <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {log.length > 0 ? log.map((item) => (
                                    <div key={item.id} style={{
                                        display: 'flex', alignItems: 'center',
                                        padding: '12px 16px',
                                        background: 'rgba(255,255,255,0.03)',
                                        borderRadius: '10px', fontSize: '0.85rem',
                                        transition: 'background 0.2s ease',
                                    }}>
                                        <span style={{ color: 'var(--accent)', fontFamily: 'monospace', fontWeight: 700, marginRight: '15px' }}>#{item.id}</span>
                                        <span style={{ color: colorMap[item.server], fontWeight: 700 }}>{item.server}</span>
                                        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{item.time}</span>
                                    </div>
                                )) : (
                                    <p className="muted" style={{ fontStyle: 'italic' }}>Responses will appear here...</p>
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {/* Spin animation for spinner */}
            <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
        </>
    );
}
