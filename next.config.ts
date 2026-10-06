import type { NextConfig } from "next";

// Fully static export: all data lives in Supabase and every security-relevant
// check (auth, GPS distance, cooldown, timestamps) runs inside Postgres.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: false,
  images: { unoptimized: true },
};

export default nextConfig;
