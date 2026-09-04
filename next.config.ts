import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse and the AWS SDK rely on Node.js APIs — keep these route handlers
  // on the Node runtime (the default) and out of the Edge bundle. @napi-rs/canvas
  // (pdf-parse's own canvas dependency, needed for its worker's CanvasFactory —
  // see the "pdf-parse/worker" imports in app/api/pdf/{extract,ocr}/route.ts)
  // must also be external, or Vercel's serverless bundling can fail to carry
  // its native binary along, per pdf-parse's own Vercel troubleshooting docs.
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  // Mirrors server-only UPLOAD_MAX_MB into a client-readable var, so the
  // upload panel's copy/validation stays in sync with the real configured
  // limit instead of a hardcoded duplicate number.
  env: {
    NEXT_PUBLIC_UPLOAD_MAX_MB: process.env.UPLOAD_MAX_MB ?? "250",
  },
};

export default nextConfig;
