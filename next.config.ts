import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // ルートレイアウトが (ja) と [lang] の2つあるため、404 は app/global-not-found.tsx で出す
    globalNotFound: true,
  },
};

export default nextConfig;
