#!/usr/bin/env node
// Red/Green regression for the macOS/Chrome difftool hang:
// closing the visible page/window must unblock the CLI even if the
// browser process does not immediately emit Playwright's `disconnected`.

import { EventEmitter } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const automation = await import(`file://${path.join(DIR, "lib", "automation.js")}`);
const { waitForDifftoolClose } = automation.default || automation;

let failures = [];
let checks = 0;

function assert(label, cond) {
  checks++;
  if (!cond) failures.push(label);
}

function fakePage() {
  const emitter = new EventEmitter();
  return {
    emitClose() {
      emitter.emit("close");
    },
    waitForEvent(name) {
      return new Promise((resolve) => emitter.once(name, resolve));
    },
  };
}

function fakeBrowser() {
  const emitter = new EventEmitter();
  return {
    emitDisconnected() {
      emitter.emit("disconnected");
    },
    on(name, fn) {
      emitter.on(name, fn);
    },
  };
}

async function resolvesWithin(promise, timeoutMs = 100) {
  let timer;
  return Promise.race([
    promise.then(() => true),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

{
  const page = fakePage();
  const browser = fakeBrowser();
  const closed = waitForDifftoolClose(page, browser);

  page.emitClose();

  assert(
    "waitForDifftoolClose resolves when the visible page closes even if browser stays connected",
    await resolvesWithin(closed)
  );
}

{
  const page = fakePage();
  const browser = fakeBrowser();
  const closed = waitForDifftoolClose(page, browser);

  browser.emitDisconnected();

  assert(
    "waitForDifftoolClose still resolves on browser disconnected",
    await resolvesWithin(closed)
  );
}

console.log(`difftool-close-wait check: ${checks - failures.length}/${checks} passed`);

if (failures.length) {
  console.error("FAILED:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
}

console.log("All difftool-close-wait checks passed (GREEN).");
