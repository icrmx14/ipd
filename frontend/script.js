/**
 * IPD Frontend — Interactive Load Balancer Demo
 * Refactored for modularity, performance, and readability.
 */

document.addEventListener("DOMContentLoaded", () => {
    // ==========================================
    // 1. CONFIGURATION & STATE
    // ==========================================
    const CONFIG = {
        colors: ["#f87171", "#fb923c", "#fbbf24", "#34d399", "#22d3ee", "#4f8ff7", "#a78bfa", "#f472b6", "#94a3b8", "#e879f9"],
        burstCount: 10,
        burstDelayMs: 150,
        maxLogEntries: 50
    };

    const STATE = {
        requestCount: 0,
        serverHits: {},
        colorMap: {},
        colorIndex: 0
    };

    // DOM Elements
    const DOM = {
        callButton: document.getElementById("callButton"),
        burstButton: document.getElementById("burstButton"),
        content: document.getElementById("content"),
        spinner: document.getElementById("spinner"),
        responseCard: document.getElementById("response"),
        chart: document.getElementById("distributionChart"),
        log: document.getElementById("requestLog"),
        totalRequests: document.getElementById("totalRequests"),
        uniqueServers: document.getElementById("uniqueServers"),
        header: document.querySelector('.hero h1'),
        canvas: document.getElementById('particleCanvas')
    };

    // ==========================================
    // 2. LOAD BALANCER LOGIC & API
    // ==========================================
    function initLoadBalancer() {
        DOM.callButton.addEventListener("click", () => handleRequest());
        
        DOM.burstButton.addEventListener("click", async () => {
            const btnSpan = DOM.burstButton.querySelector("span:last-child");
            DOM.burstButton.disabled = true;
            if (btnSpan) btnSpan.textContent = "Sending...";

            for (let i = 0; i < CONFIG.burstCount; i++) {
                await handleRequest();
                await sleep(CONFIG.burstDelayMs);
            }

            DOM.burstButton.disabled = false;
            if (btnSpan) btnSpan.textContent = `Send ${CONFIG.burstCount} Requests`;
        });
    }

    async function handleRequest() {
        resetUIForRequest();

        try {
            const response = await fetch("/api/");
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();

            updateState(data.server_id);
            renderResponse(data);
            renderChart();
            renderLogEntry(data.server_id, data.timestamp);
        } catch (error) {
            renderError(error);
        } finally {
            DOM.spinner.style.display = "none";
            DOM.callButton.disabled = false;
        }
    }

    function updateState(serverId) {
        STATE.requestCount++;
        if (!STATE.serverHits[serverId]) {
            STATE.serverHits[serverId] = 0;
            STATE.colorMap[serverId] = CONFIG.colors[STATE.colorIndex % CONFIG.colors.length];
            STATE.colorIndex++;
        }
        STATE.serverHits[serverId]++;
    }

    // ==========================================
    // 3. UI RENDERING
    // ==========================================
    function resetUIForRequest() {
        DOM.content.innerHTML = "";
        DOM.responseCard.classList.remove("error");
        DOM.spinner.style.display = "block";
        DOM.callButton.disabled = true;
    }

    function renderResponse(data) {
        const serverNum = parseInt(data.server_id.slice(-1), 10) % 10 || 0;
        DOM.content.innerHTML = `
            <div class="response-content">
                <h3 class="server-${serverNum}">🖥 ${data.server_id}</h3>
                <p>${data.message}</p>
                <small>Timestamp: ${data.timestamp}</small>
            </div>
        `;
    }

    function renderError(error) {
        DOM.responseCard.classList.add("error");
        DOM.content.innerHTML = `
            <div class="response-content">
                <h3 style="color:var(--red)">❌ Error</h3>
                <p>Failed to connect to backend</p>
                <small>${error.message}</small>
            </div>
        `;
    }

    function renderChart() {
        const maxHits = Math.max(...Object.values(STATE.serverHits));
        const sorted = Object.entries(STATE.serverHits).sort((a, b) => b[1] - a[1]);

        DOM.chart.innerHTML = sorted.map(([server, count]) => {
            const pct = (count / maxHits) * 100;
            const color = STATE.colorMap[server];
            return `
                <div class="dist-bar-row">
                    <span class="dist-label" style="color:${color}">${server}</span>
                    <div class="dist-bar-bg">
                        <div class="dist-bar" style="width:${pct}%;background:${color}"></div>
                    </div>
                    <span class="dist-count">${count} (${((count / STATE.requestCount) * 100).toFixed(1)}%)</span>
                </div>
            `;
        }).join("");

        DOM.totalRequests.textContent = `Total: ${STATE.requestCount}`;
        DOM.uniqueServers.textContent = `Servers: ${Object.keys(STATE.serverHits).length}`;
    }

    function renderLogEntry(server, timestamp) {
        const placeholder = DOM.log.querySelector(".placeholder");
        if (placeholder) placeholder.remove();

        const color = STATE.colorMap[server];
        const entry = document.createElement("div");
        entry.className = "log-item";
        entry.innerHTML = `
            <span class="log-num">#${STATE.requestCount}</span>
            <span class="log-server" style="color:${color}">${server}</span>
            <span class="log-time">${timestamp || new Date().toLocaleTimeString()}</span>
        `;

        DOM.log.insertBefore(entry, DOM.log.firstChild);

        while (DOM.log.children.length > CONFIG.maxLogEntries) {
            DOM.log.removeChild(DOM.log.lastChild);
        }
    }

    // ==========================================
    // 4. PARTICLE ENGINE (GALAXY SWARM)
    // ==========================================
    function initParticleEngine() {
        if (!DOM.canvas) return;
        const ctx = DOM.canvas.getContext('2d');
        let particlesArray = [];
        const mouse = { x: null, y: null };

        function resizeCanvas() {
            DOM.canvas.width = window.innerWidth;
            DOM.canvas.height = window.innerHeight;
        }

        class Particle {
            constructor() {
                this.x = Math.random() * DOM.canvas.width;
                this.y = Math.random() * DOM.canvas.height;
                this.size = Math.random() * 2 + 0.5; 
                this.vx = 0; 
                this.vy = 0; 
                this.baseX = this.x;
                this.baseY = this.y;
                
                this.speed = Math.random() * 0.0015 + 0.0005; 
            }

            draw() {
                ctx.fillStyle = '#ffffff'; 
                ctx.shadowBlur = 8;
                ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
                
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.closePath();
                ctx.fill();
                
                ctx.shadowBlur = 0; 
            }

            update() {
                if (mouse.x !== null) {
                    let dx = mouse.x - this.x;
                    let dy = mouse.y - this.y;
                    let distance = Math.sqrt(dx * dx + dy * dy);
                    
                    let orbitRadius = 120; 

                    if (distance > 0.1) {
                        let force = (distance - orbitRadius) / distance;
                        this.vx += dx * force * this.speed;
                        this.vy += dy * force * this.speed;

                        this.vx += -dy * 0.0004;
                        this.vy += dx * 0.0004;
                    }
                } else {
                    this.vx += (this.baseX - this.x) * 0.001;
                    this.vy += (this.baseY - this.y) * 0.001;
                }

                this.vx *= 0.92;
                this.vy *= 0.92;

                this.x += this.vx;
                this.y += this.vy;
            }
        }

        function initParticles() {
            particlesArray = [];
            for (let i = 0; i < 200; i++) {
                particlesArray.push(new Particle());
            }
        }

        function animate() {
            ctx.clearRect(0, 0, DOM.canvas.width, DOM.canvas.height);
            particlesArray.forEach(p => {
                p.update();
                p.draw();
            });
            requestAnimationFrame(animate);
        }

        window.addEventListener('mousemove', (e) => { mouse.x = e.x; mouse.y = e.y; });
        window.addEventListener('mouseout', () => { mouse.x = null; mouse.y = null; });
        window.addEventListener('resize', () => { resizeCanvas(); initParticles(); });

        resizeCanvas();
        initParticles();
        animate();
    }

    // ==========================================
    // 5. SCROLL ANIMATIONS
    // ==========================================
    function initScrollAnimations() {
        if (!DOM.header) return;
        window.addEventListener('scroll', () => {
            DOM.header.classList.toggle('mini', window.scrollY > 50);
        });
    }

    // ==========================================
    // 6. PLANETARY NAVIGATION ENGINE
    // ==========================================
    function initPlanetaryNav() {
        const nav = document.getElementById('planetaryNav');
        const line = document.getElementById('nav-line');
        const planets = document.querySelectorAll('.planet-sphere');
        
        if (!nav || !line || planets.length === 0) return;

        function updateConstellation() {
            const navRect = nav.getBoundingClientRect();
            let points = [];
            
            planets.forEach(p => {
                const rect = p.getBoundingClientRect();
                const x = rect.left + (rect.width / 2) - navRect.left;
                const y = rect.top + (rect.height / 2) - navRect.top;
                points.push(`${x},${y}`);
            });
            
            line.setAttribute('points', points.join(' '));
            requestAnimationFrame(updateConstellation);
        }
        
        updateConstellation();
    }

    // ==========================================
    // 7. VISIBILITY TOGGLE (NEW)
    // ==========================================
    function initVisibilityToggle() {
        const lbPlanet = document.getElementById('lb-planet');
        const mainBlock = document.getElementById('main-block');
        const controls = document.getElementById('action-controls');

        if (lbPlanet && mainBlock) {
            lbPlanet.addEventListener('click', (e) => {
                e.preventDefault(); // Stop standard jump
                
                // Add the class that overrides display: none to block and triggers CSS fade animation
                mainBlock.classList.add('visible');
                
                // Give the browser 50 milliseconds to render the block before we tell the window to scroll
                setTimeout(() => {
                    controls.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 50);
            });
        }
    }

    // ==========================================
    // UTILITIES
    // ==========================================
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // ==========================================
    // INITIALIZATION
    // ==========================================
    initLoadBalancer();
    initParticleEngine();
    initScrollAnimations();
    initPlanetaryNav();
    initVisibilityToggle(); // <-- Starts the new click-to-reveal logic!
});