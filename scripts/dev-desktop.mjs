/**
 * Dev launcher that auto-picks a free port for the frontend,
 * then passes it to both Next.js (--port) and Tauri (TAURI_CONFIG override).
 */
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

// Fixed dev session token. Pinned (instead of the backend's per-run random
// token) so that uvicorn `--reload` restarts don't rotate the token out from
// under the already-loaded desktop webview. Must keep the `openyak_st_` prefix.
const DEV_FIXED_SESSION_TOKEN = "openyak_st_dev_desktop_fixed_local_token";

async function findFreePort(preferred = 3000, host = "0.0.0.0") {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(preferred, host, () => {
      server.close(() => resolve(preferred));
    });
    server.on("error", () => {
      // preferred port busy — let OS assign one
      const s = createServer();
      s.listen(0, host, () => {
        const port = s.address().port;
        s.close(() => resolve(port));
      });
    });
  });
}

const frontendHost = "127.0.0.1";
const port = await findFreePort(3000, frontendHost);
const backendHost = "127.0.0.1";
const backendPort = await findFreePort(8000, backendHost);
const backendDataDir = resolve(process.cwd(), "backend", "data");
const backendTokenPath = resolve(backendDataDir, "session_token.json");

// Pre-seed the fixed dev token BEFORE spawning anything. The desktop shell
// (Tauri) reads session_token.json within a ~5s window at boot; the backend's
// own startup (model index, MCP connectors) can take longer than that, so
// relying on the backend to write the token first races Tauri's timeout and
// leaves the webview unauthenticated (every /api call → 401). Writing the
// known fixed token here means Tauri reads it instantly, and the backend later
// writes the identical value (idempotent) via OPENYAK_DEV_SESSION_TOKEN.
mkdirSync(dirname(backendTokenPath), { recursive: true });
writeFileSync(
  backendTokenPath,
  JSON.stringify({ token: DEV_FIXED_SESSION_TOKEN }),
  { mode: 0o600 },
);

console.log(`\x1b[33m[dev-desktop] Using frontend port: ${port}\x1b[0m`);
console.log(`\x1b[33m[dev-desktop] Using backend port: ${backendPort}\x1b[0m`);

const env = {
  ...process.env,
  DEV_BACKEND_PORT: String(backendPort),
  // Dev backend writes session_token.json under backend/data/ (cwd=backend).
  // Pin the absolute path so the Tauri dev binary reads the same token
  // regardless of where `cargo tauri dev` is invoked from.
  DEV_BACKEND_DATA_DIR: backendDataDir,
  // The backend default (``session_token.json``) assumes the prod
  // ``run.py`` has chdired into ``--data-dir``. Dev runs uvicorn from
  // ``backend/`` directly (no chdir), so override the path to keep the
  // file under ``backend/data/`` where ``DEV_BACKEND_DATA_DIR`` says
  // Tauri will poll for it.
  OPENYAK_SESSION_TOKEN_PATH: "data/session_token.json",
  // Keep desktop dev auth out of the debugging loop. The backend still uses
  // its per-run bearer token; this only disables the optional employee gate.
  OPENYAK_AUTH_ENABLED: "false",
  // Pin a fixed dev session token so that backend `--reload` restarts (e.g.
  // when editing files under backend/app) do NOT rotate the token out from
  // under the already-loaded desktop webview. Without this, every backend
  // hot-reload invalidates the token the webview cached at boot, and every
  // /api request starts returning 401 until the window is reloaded.
  OPENYAK_ALLOW_DEV_SESSION_TOKEN: "true",
  OPENYAK_DEV_SESSION_TOKEN: DEV_FIXED_SESSION_TOKEN,
  NEXT_PUBLIC_API_URL: `http://${backendHost}:${backendPort}`,
  // Tauri merges TAURI_CONFIG JSON into tauri.conf.json at runtime
  TAURI_CONFIG: JSON.stringify({
    build: { devUrl: `http://${frontendHost}:${port}` },
  }),
};

const cmd = [
  "npx concurrently -k",
  "-n backend,frontend,tauri",
  "-c blue,green,yellow",
  `"cd backend && venv/bin/python -m uvicorn app.main:create_app --factory --reload --reload-dir app --host ${backendHost} --port ${backendPort}"`,
  `"cd frontend && npx next dev --turbopack --hostname ${frontendHost} --port ${port}"`,
  `"cd desktop-tauri && cargo tauri dev"`,
].join(" ");

const proc = spawn(cmd, [], { stdio: "inherit", shell: true, env });

proc.on("exit", (code) => process.exit(code ?? 1));
