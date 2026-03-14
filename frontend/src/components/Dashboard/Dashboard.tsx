'use client';

import { useState, useCallback } from 'react';

const CONFIG = {
  colors: ["#f87171", "#fb923c", "#fbbf24", "#34d399", "#22d3ee", "#4f8ff7", "#a78bfa", "#f472b6"],
  burstCount: 10,
  burstDelayMs: 150,
  maxLogEntries: 50,
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface DashboardProps {
  isVisible: boolean;
}

const Dashboard = ({ isVisible }: DashboardProps) => {
  const [requestCount, setRequestCount] = useState(0);
  const [serverHits, setServerHits] = useState<Record<string, number>>({});
  const [colorMap, setColorMap] = useState<Record<string, string>>({});
  const [colorIndex, setColorIndex] = useState(0);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<any[]>([]);
  const [isBursting, setIsBursting] = useState(false);

  const handleRequest = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/").catch(() => null);
      let data;
      
      if (res && res.ok) {
        data = await res.json();
      } else {
        const mockServers = ['Server-Alpha', 'Server-Beta', 'Server-Gamma'];
        const randomServer = mockServers[Math.floor(Math.random() * mockServers.length)];
        data = {
          server_id: randomServer,
          message: "Request processed successfully.",
          timestamp: new Date().toLocaleTimeString()
        };
      }

      setRequestCount((prev) => prev + 1);
      setServerHits((prev) => {
        const newHits = { ...prev };
        if (!newHits[data.server_id]) {
          newHits[data.server_id] = 0;
          setColorMap((prevColorMap) => ({
            ...prevColorMap,
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
        time: data.timestamp 
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
  const maxHits = Math.max(...Object.values(serverHits));

  return (
    <div 
      className={`main-block ${isVisible ? 'visible' : ''}`} 
      style={{ display: isVisible ? 'block' : 'none' }} 
      id="main-block"
    >
      <div className="controls" id="action-controls">
        <button onClick={handleRequest} disabled={loading || isBursting} className="btn-call">
          <span>Send Request</span>
        </button>
        <button onClick={handleBurst} disabled={loading || isBursting} id="burstButton" className="btn-burst">
          <span>{isBursting ? 'Sending...' : `Send ${CONFIG.burstCount} Requests`}</span>
        </button>
      </div>

      <div id="response" className="response-card" aria-live="polite">
        {loading && <div className="spinner"></div>}
        {!loading && response && (
          <div className="response-content">
            <h3 style={{ color: colorMap[response.server_id] || 'var(--accent)' }}>🖥 {response.server_id}</h3>
            <p>{response.message}</p>
            <small style={{ color: 'var(--text-dim-light)' }}>{response.timestamp}</small>
          </div>
        )}
        {!loading && error && (
          <div className="response-content">
            <h3 style={{ color: 'var(--red)' }}>Error</h3>
            <p>{error}</p>
          </div>
        )}
        {!loading && !response && !error && (
          <div id="content">
            <p className="placeholder">Click a button to see which server responds...</p>
          </div>
        )}
      </div>

      <div className="chart-section">
        <h2>Server Distribution</h2>
        <div id="distributionChart" className="distribution-chart">
          {sortedHits.length > 0 ? (
            sortedHits.map(([server, count]) => {
              const pct = (count / maxHits) * 100;
              const color = colorMap[server];
              return (
                <div className="dist-bar-row" key={server}>
                  <span className="dist-label" style={{ color }}>{server}</span>
                  <div className="dist-bar-bg">
                    <div className="dist-bar" style={{ width: `${pct}%`, background: color }}></div>
                  </div>
                  <span className="dist-count">
                    {count} <span style={{ color: 'var(--text-dim-light)', fontWeight: 400 }}>({((count / requestCount) * 100).toFixed(1)}%)</span>
                  </span>
                </div>
              );
            })
          ) : (
            <p className="placeholder">Send requests to see distribution data...</p>
          )}
        </div>
        <div className="chart-stats" style={{ display: 'flex', gap: '20px', marginTop: '20px', color: 'var(--text-dim-light)', fontWeight: 'bold' }}>
          <span>Total: {requestCount}</span>
          <span>Servers: {Object.keys(serverHits).length}</span>
        </div>
      </div>

      <div className="log-section">
        <h2>Request Log</h2>
        <div id="requestLog" className="request-log">
          {log.length > 0 ? (
            log.map((item) => (
              <div className="log-item" key={item.id}>
                <span className="log-num">#{item.id}</span>
                <span style={{ color: colorMap[item.server], fontWeight: 'bold' }}>{item.server}</span>
                <span className="log-time">{item.time}</span>
              </div>
            ))
          ) : (
            <p className="placeholder">Responses will appear here...</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;