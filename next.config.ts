import type { NextConfig } from 'next';

const isFrontendMode = process.env.NEXT_PUBLIC_ENABLE_FRONTEND_MODE === 'true';

const nextConfig: NextConfig = {
  ...(isFrontendMode
    ? {
        output: 'export' as const,
        images: {
          unoptimized: true,
        },
      }
    : {}),
};

export default nextConfig;
