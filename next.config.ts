import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // A4 page JPEGs from iOS WebKit can exceed the 1 MB default; Vercel caps request bodies at 4.5 MB
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
