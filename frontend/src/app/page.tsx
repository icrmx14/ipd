'use client';

import Link from 'next/link';
import BackgroundCanvas from '@/components/BackgroundCanvas/BackgroundCanvas';
import {
  IconRocket,
  IconBalancer,
  IconChart,
  IconMonitor,
} from '@/components/Icons/Icons';

const navCards = [
  {
    href: '/dashboard',
    icon: <IconRocket size={28} color="#4f8ff7" />,
    iconBg: 'linear-gradient(135deg, rgba(79, 143, 247, 0.2), rgba(167, 139, 250, 0.2))',
    accentColor: '#4f8ff7',
    title: 'Dashboard',
    description: 'Upload, deploy, scale, and monitor your entire platform from one control center.',
    badge: 'localhost:9000',
  },
  {
    href: '/loadbalancer',
    icon: <IconBalancer size={28} color="#f472b6" />,
    iconBg: 'linear-gradient(135deg, rgba(244, 114, 182, 0.2), rgba(248, 113, 113, 0.2))',
    accentColor: '#f472b6',
    title: 'Load Balancer',
    description: 'Interactive demo — send requests and watch server distribution in real time.',
    badge: 'localhost:8080',
  },
  {
    href: 'http://localhost:8404/stats',
    icon: <IconChart size={28} color="#fb923c" />,
    iconBg: 'linear-gradient(135deg, rgba(251, 146, 60, 0.2), rgba(251, 191, 36, 0.2))',
    accentColor: '#fb923c',
    title: 'HAProxy Stats',
    description: 'Real-time HAProxy statistics dashboard with connection and traffic metrics.',
    badge: ':8404',
    external: true,
  },
  {
    href: 'http://localhost:5601',
    icon: <IconMonitor size={28} color="#34d399" />,
    iconBg: 'linear-gradient(135deg, rgba(52, 211, 153, 0.2), rgba(34, 211, 238, 0.2))',
    accentColor: '#34d399',
    title: 'Kibana',
    description: 'Explore logs, build dashboards, and visualize application data with ELK.',
    badge: ':5601',
    external: true,
  },
];

export default function HomePage() {
  return (
    <>
      <BackgroundCanvas />

      <div className="landing-container">
        <div className="landing-hero">
          <h1 className="landing-title">IPD Platform</h1>
          <p className="landing-subtitle">
            Intelligent Containerized Deployment &amp; Load Balancing.
            Upload your project, auto-detect the stack, containerize,
            and scale — all from a single interface.
          </p>
        </div>

        <div className="landing-nav">
          {navCards.map((card) => {
            const inner = (
              <div
                className="landing-card"
                style={{ '--card-accent': card.accentColor } as React.CSSProperties}
              >
                <div
                  className="landing-card-icon"
                  style={{ background: card.iconBg }}
                >
                  {card.icon}
                </div>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
                <span className="landing-card-badge">{card.badge}</span>
              </div>
            );

            if (card.external) {
              return (
                <a key={card.title} href={card.href} target="_blank" rel="noopener noreferrer">
                  {inner}
                </a>
              );
            }

            return (
              <Link key={card.title} href={card.href}>
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}