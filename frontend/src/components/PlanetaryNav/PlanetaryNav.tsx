'use client';

import { useRef, useEffect } from 'react';
import {
  IconDashboard,
  IconChart,
  IconMonitor,
  IconBalancer,
} from '@/components/Icons/Icons';

interface PlanetaryNavProps {
  onReveal: (e: React.MouseEvent) => void;
}

const PlanetaryNav = ({ onReveal }: PlanetaryNavProps) => {
  const navRef = useRef<HTMLElement>(null);
  const lineRef = useRef<SVGPolylineElement>(null);
  const planetRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    const nav = navRef.current;
    const line = lineRef.current;
    const planets = planetRefs.current.filter((p) => p !== null) as HTMLAnchorElement[];

    if (!nav || !line || planets.length === 0) return;

    let animationFrameId: number;

    const updateConstellation = () => {
      const navRect = nav.getBoundingClientRect();
      const points = planets.map((p) => {
        const rect = p.getBoundingClientRect();
        const x = rect.left + rect.width / 2 - navRect.left;
        const y = rect.top + rect.height / 2 - navRect.top;
        return `${x},${y}`;
      });

      line.setAttribute('points', points.join(' '));
      animationFrameId = requestAnimationFrame(updateConstellation);
    };

    updateConstellation();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const navItems = [
    { href: "http://localhost:9000", label: "Controller", color: "#4f8ff7", icon: IconDashboard },
    { href: "http://localhost:8404/stats", label: "HAProxy Stats", color: "#f59e0b", icon: IconChart },
    { href: "http://localhost:5601", label: "Kibana", color: "#10b981", icon: IconMonitor },
    { href: "#action-controls", label: "Load Balancer", color: "#f472b6", icon: IconBalancer, id: "lb-planet" },
  ];

  return (
    <footer className="planetary-nav" id="planetaryNav" ref={navRef}>
      <svg className="connectors" width="100%" height="100%">
        <polyline
          id="nav-line"
          ref={lineRef}
          fill="none"
          stroke="white"
          strokeWidth="1.5"
          strokeDasharray="4,8"
          className="connector-line"
        />
      </svg>

      <div className="planet-container">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isLoadBalancerBtn = item.id === "lb-planet";

          return (
            <a
              key={item.label}
              href={item.href}
              target={item.href.startsWith('http') ? "_blank" : undefined}
              className={`planet-wrapper p${index + 1}`}
              id={item.id}
              ref={(el) => { planetRefs.current[index] = el; }}
              onClick={isLoadBalancerBtn ? onReveal : undefined}
            >
              <div
                className="planet-sphere"
                style={{ '--planet-color': item.color } as React.CSSProperties}
              ></div>
              <span className="planet-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon size={14} />
                {item.label}
              </span>
            </a>
          );
        })}
      </div>
    </footer>
  );
};

export default PlanetaryNav;