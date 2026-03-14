import type { Metadata } from 'next';
import { Inter, Poppins } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-main',
  display: 'swap',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-alt',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'IPD Platform — Intelligent Deployment & Load Balancing',
  description: 'Upload, containerize, deploy, and load-balance any project with auto-detection, scaling, and real-time monitoring.',
  keywords: ['load balancer', 'docker', 'deployment', 'containerization', 'HAProxy'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${poppins.variable}`}>
        {children}
      </body>
    </html>
  );
}
