import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://controller:9000/api/:path*',
      },
    ];
  },
};

export default nextConfig;
