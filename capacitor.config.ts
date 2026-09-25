import type { CapacitorConfig } from "@capacitor/cli";

// NiroLearn mobile shell — Capacitor runs in REMOTE mode: the WebView loads
// the real, live Next.js deployment directly (server.url below), it never
// bundles a local copy of the app. This is required, not just preferred:
// next.config.ts has no static-export mode, and the app depends on Server
// Components, cookies, and live API/tRPC routes that only exist on the
// real deployed server. `webDir` below is never actually served at
// runtime (server.url takes precedence over it on load) — it exists only
// because Capacitor's own tooling (`cap sync`) requires the directory to
// be present; see mobile-shell/README.md for why it's an empty placeholder.
const config: CapacitorConfig = {
  appId: "com.nirolearn.app",
  appName: "NiroLearn",
  webDir: "mobile-shell",
  server: {
    url: "https://alexmed-production.up.railway.app",
    androidScheme: "https",
    cleartext: false,
  },
};

export default config;
