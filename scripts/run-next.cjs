const { spawn } = require("node:child_process");
const path = require("node:path");

function hasBrokenLocalStorage() {
  return (
    "localStorage" in globalThis &&
    globalThis.localStorage &&
    typeof globalThis.localStorage.getItem !== "function"
  );
}

if (hasBrokenLocalStorage()) {
  try {
    delete globalThis.localStorage;
  } catch {
    globalThis.localStorage = undefined;
  }
}

const args = process.argv.slice(2);
const nextBin = require.resolve("next/dist/bin/next");
const localStorageFile = path.join(process.cwd(), ".node-localstorage");

const child = spawn(
  process.execPath,
  [`--localstorage-file=${localStorageFile}`, nextBin, ...args],
  {
  stdio: "inherit",
  env: process.env,
  cwd: process.cwd(),
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
