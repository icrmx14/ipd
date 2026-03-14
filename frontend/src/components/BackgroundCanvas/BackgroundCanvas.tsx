'use client';

import { useRef, useEffect } from 'react';

const BackgroundCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particlesArray: Particle[] = [];
    const mouse = { x: null as number | null, y: null as number | null };

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    class Particle {
      x: number;
      y: number;
      size: number;
      vx: number;
      vy: number;
      baseX: number;
      baseY: number;
      speed: number;

      constructor() {
        this.x = Math.random() * canvas!.width;
        this.y = Math.random() * canvas!.height;
        this.size = Math.random() * 2 + 0.5;
        this.vx = 0;
        this.vy = 0;
        this.baseX = this.x;
        this.baseY = this.y;
        this.speed = Math.random() * 0.0015 + 0.0005;
      }

      draw() {
        if (!ctx) return;
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 5; // Slight glow
        ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;
      }

      update() {
        if (mouse.x !== null && mouse.y !== null) {
          let dx = mouse.x - this.x;
          let dy = mouse.y - this.y;
          let distance = Math.sqrt(dx * dx + dy * dy);

          // NEW PHYSICS: Define the gravity zones
          let interactionRadius = 250; // Stars outside this distance ignore the cursor
          let orbitRadius = 80;        // Stars inside this distance will spin instead of falling in

          if (distance < interactionRadius) {
            if (distance > orbitRadius) {
              // Pull stars towards the cursor
              let force = (distance - orbitRadius) / distance;
              this.vx += dx * force * this.speed;
              this.vy += dy * force * this.speed;
            } else {
              // Stars are close! Make them orbit (tangential velocity)
              this.vx += -dy * 0.0008;
              this.vy += dx * 0.0008;

              // Add a slight anti-gravity push so they don't crash into the exact center
              let pushForce = (orbitRadius - distance) / orbitRadius;
              this.vx -= dx * pushForce * 0.0002;
              this.vy -= dy * pushForce * 0.0002;
            }
          } else {
            // Outside the gravity well, float slowly back to original position
            this.vx += (this.baseX - this.x) * 0.0005;
            this.vy += (this.baseY - this.y) * 0.0005;
          }
        } else {
          // No mouse on screen, return to base
          this.vx += (this.baseX - this.x) * 0.0005;
          this.vy += (this.baseY - this.y) * 0.0005;
        }

        // Friction to prevent infinite acceleration
        this.vx *= 0.92;
        this.vy *= 0.92;

        this.x += this.vx;
        this.y += this.vy;
      }
    }

    const initParticles = () => {
      particlesArray = [];
      // INCREASED DENSITY: 450 stars for a thicker galaxy feel
      for (let i = 0; i < 450; i++) {
        particlesArray.push(new Particle());
      }
    };

    let animationFrameId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesArray.forEach((p) => {
        p.update();
        p.draw();
      });
      animationFrameId = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleMouseOut = () => {
      mouse.x = null;
      mouse.y = null;
    };

    const handleResize = () => {
      resizeCanvas();
      initParticles();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseout', handleMouseOut);
    window.addEventListener('resize', handleResize);

    resizeCanvas();
    initParticles();
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseout', handleMouseOut);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      id="particleCanvas"
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 0,
        pointerEvents: 'none'
      }}
    />
  );
};

export default BackgroundCanvas;