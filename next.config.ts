import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse and the AWS SDK rely on Node.js APIs — keep these route handlers
  // on the Node runtime (the default) and out of the Edge bundle.
  serverExternalPackages: ["pdf-parse"],
  // Mirrors server-only UPLOAD_MAX_MB into a client-readable var, so the
  // upload panel's copy/validation stays in sync with the real configured
  // limit instead of a hardcoded duplicate number.
  env: {
    NEXT_PUBLIC_UPLOAD_MAX_MB: process.env.UPLOAD_MAX_MB ?? "250",
  },
};

export default nextConfig;
