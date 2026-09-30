import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "coffeeug.online" }],
  },
};

export default nextConfig;
