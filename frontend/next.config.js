/** @type {import('next').NextConfig} */

// Where the Next.js server forwards /api/v1/* requests (server-to-server).
// Rewrites are compiled at BUILD time, so set API_INTERNAL_URL when running `next build`
// (e.g. http://api:4000 inside docker compose). Browsers only ever talk to the frontend origin.
const API_INTERNAL_URL = (process.env.API_INTERNAL_URL || 'http://localhost:4000').replace(/\/$/, '');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${API_INTERNAL_URL}/api/v1/:path*`,
      },
    ];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

module.exports = nextConfig;
