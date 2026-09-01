#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const eveBin = join(dirname(require.resolve("eve/package.json")), "bin", "eve.js");

const evePort = process.env.EVE_PORT ?? "2010";
const children = [];
let shuttingDown = false;

console.log(`\n  Starting the agent on port ${evePort}…`);

const agent = spawn(process.execPath, [eveBin, "dev", "--no-ui", "--port", evePort], {
  stdio: ["ignore", "pipe", "pipe"],
});
children.push(agent);

let origin;
try {
  origin = await waitForServerUrl(agent);
} catch (error) {

  console.error(`\n  \x1b[31mThe agent didn't start.\x1b[0m ${error.message}\n`);
  console.error("  Things to try:");
  console.error("    • npm run check          — are your keys set?");
  console.error("    • npx eve dev            — run the agent on its own to see the real error");
  console.error(`    • EVE_PORT=2020 npm run dev  — in case port ${evePort} is taken`);
  console.error("    • close other apps       — this needs roughly 2 GB of free memory\n");
  shutdown(1);
}

console.log(`  Agent ready at ${origin}\n`);

const web = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev"], {
  stdio: "inherit",
  env: { ...process.env, EVE_BASE_URL: origin },
});
children.push(web);

web.on("exit", (code) => shutdown(code ?? 0));
agent.on("exit", (code) => shutdown(code ?? 1));

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(0));
}

function waitForServerUrl(child) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let buffer = "";

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`The agent didn't start within 3 minutes. Its output is above.`));
      }
    }, 180_000);

    const onChunk = (chunk) => {
      const text = chunk.toString("utf8");
      buffer += text;
      process.stdout.write(prefix(text));

      const match = /listening at\s+(https?:\/\/[^\s/]+)/i.exec(buffer);
      if (match && !settled) {
        settled = true;
        clearTimeout(timer);
        resolve(match[1]);
      }
    };

    child.stdout.on("data", onChunk);
    child.stderr.on("data", onChunk);

    child.on("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`The agent exited with code ${code} before it was ready. See its output above.`));
    });
  });
}

function prefix(text) {
  return text
    .split("\n")
    .map((line) => (line.trim() ? `  \x1b[2m[agent]\x1b[0m ${line}` : line))
    .join("\n");
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  process.exit(code);
}
