'use client';

import Link from 'next/link';
import {
  IconUpload,
  IconDashboard,
  IconContainer,
  IconScale,
  IconBalancer,
  IconLogs,
  IconMonitor,
  IconBolt,
} from '@/components/Icons/Icons';

type Section = 'upload' | 'overview' | 'containers' | 'scaling' | 'loadbalancer' | 'logs' | 'monitoring';

interface SidebarProps {
    activeSection: Section;
    onSwitch: (section: Section) => void;
    health: { dot: string; label: string };
}

const navItems: { key: Section; icon: React.ReactNode; label: string }[] = [
    { key: 'upload', icon: <IconUpload size={18} />, label: 'Upload & Deploy' },
    { key: 'overview', icon: <IconDashboard size={18} />, label: 'Overview' },
    { key: 'containers', icon: <IconContainer size={18} />, label: 'Containers' },
    { key: 'scaling', icon: <IconScale size={18} />, label: 'Scaling' },
    { key: 'loadbalancer', icon: <IconBalancer size={18} />, label: 'Load Balancer' },
    { key: 'logs', icon: <IconLogs size={18} />, label: 'Logs' },
    { key: 'monitoring', icon: <IconMonitor size={18} />, label: 'Monitoring' },
];

export default function Sidebar({ activeSection, onSwitch, health }: SidebarProps) {
    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <Link href="/" className="sidebar-logo">
                    <div className="sidebar-logo-icon"><IconBolt size={18} color="white" /></div>
                    <span className="sidebar-logo-text">IPD Platform</span>
                </Link>
            </div>

            <nav className="sidebar-nav">
                {navItems.map((item) => (
                    <div
                        key={item.key}
                        className={`nav-item ${activeSection === item.key ? 'active' : ''}`}
                        onClick={() => onSwitch(item.key)}
                    >
                        <span className="nav-icon">{item.icon}</span>
                        <span className="nav-label">{item.label}</span>
                    </div>
                ))}
            </nav>

            <div className="sidebar-footer">
                <div className="health-dot">
                    <span className={`dot ${health.dot}`} />
                    <span>{health.label}</span>
                </div>
            </div>
        </aside>
    );
}
