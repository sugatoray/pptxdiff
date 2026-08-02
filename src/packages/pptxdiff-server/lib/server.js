"use strict";

const http = require("node:http");
const { diffDecks, computeChecksum, BrowserUnavailableError, PptxParseError } = require("@pptxdiff/cli/lib/index.js");
const { buildOpenApiSpec, buildDocsHtml } = require("./openapi.js");

const DEFAULT_MAX_BODY_BYTES = 100 * 1024 * 1024; // 100MB — real decks can be large; still bounded (see readJsonBody) so an unbounded upload can't exhaust memory

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(text) });
  res.end(text);
}

function sendHtml(res, status, html) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Content-Length": Buffer.byteLength(html) });
  res.end(html);
}

// Reads and JSON-parses a request body, enforcing maxBodyBytes as it
// streams in (rather than buffering an unbounded body first and checking
// after) — an unbounded upload is a real DoS vector for a server whose
// whole job is accepting file uploads, per CLI_API_DESIGN.md §8's request
// size limit requirement.
//
// Once the limit is crossed, incoming chunks are still drained (so 'end'
// eventually fires) but no longer accumulated into `chunks` — memory stays
// bounded at ~maxBodyBytes regardless of how much more the client sends.
// Deliberately does NOT call req.destroy() on overflow: that tears down
// the shared request/response socket immediately, which was tried first
// and found (via a genuine RED test failure — the client saw a raw
// connection reset, never the intended 413 JSON body) to prevent the
// error response from ever being written at all.
function readJsonBody(req, maxBodyBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let overflowed = false;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        overflowed = true;
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (overflowed) {
        return reject(Object.assign(new Error(`Request body exceeds the ${maxBodyBytes}-byte limit`), { statusCode: 413 }));
      }
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (e) {
        reject(Object.assign(new Error("Invalid JSON request body"), { statusCode: 400 }));
      }
    });
    req.on("error", reject);
  });
}

// A file field is `{ name?: string, content: string }` with content as
// base64 — the simplest wire format that needs no extra dependency
// (multipart/form-data parsing is a documented fast-follow, not attempted
// here — see PLAN.md).
function decodeFileField(field, fieldName, defaultName) {
  if (!field || typeof field.content !== "string") {
    throw Object.assign(
      new Error(`Missing or invalid "${fieldName}" field (expected { name?, content } with base64-encoded content)`),
      { statusCode: 400 }
    );
  }
  return { name: field.name || defaultName, buffer: Buffer.from(field.content, "base64") };
}

function statusForError(e, { PptxParseErrorClass, BrowserUnavailableErrorClass }) {
  if (e instanceof PptxParseErrorClass) return 422;
  if (e instanceof BrowserUnavailableErrorClass) return 503;
  return 500;
}

// Builds (but does not start listening on) the HTTP server — same
// diffDecks()/computeChecksum() automation layer pptxdiff-cli uses,
// wrapped in the smallest reasonable REST surface: POST /v1/diff,
// POST /v1/checksum, GET /v1/health. Every diffDecksFn/computeChecksumFn/
// error-class param is injectable so request-handling logic (routing,
// status codes, body validation) is testable without a real browser —
// see test_server_unit.mjs; the real automation path is covered
// separately by test_server_e2e.mjs.
function createServer({
  maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
  diffDecksFn = diffDecks,
  computeChecksumFn = computeChecksum,
  PptxParseErrorClass = PptxParseError,
  BrowserUnavailableErrorClass = BrowserUnavailableError,
  version = require("../package.json").version,
} = {}) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");

      if (req.method === "GET" && url.pathname === "/openapi.json") {
        const host = req.headers.host || "127.0.0.1";
        return sendJson(res, 200, buildOpenApiSpec({ version, serverUrl: `http://${host}` }));
      }

      if (req.method === "GET" && url.pathname === "/docs") {
        return sendHtml(res, 200, buildDocsHtml());
      }


      if (req.method === "GET" && url.pathname === "/v1/health") {
        return sendJson(res, 200, { status: "ok", version });
      }

      if (req.method === "POST" && url.pathname === "/v1/diff") {
        const body = await readJsonBody(req, maxBodyBytes);
        const before = decodeFileField(body.before, "before", "before.pptx");
        const after = decodeFileField(body.after, "after", "after.pptx");
        const report = await diffDecksFn({ name: before.name, buffer: before.buffer }, { name: after.name, buffer: after.buffer });
        return sendJson(res, 200, report);
      }

      if (req.method === "POST" && url.pathname === "/v1/checksum") {
        const body = await readJsonBody(req, maxBodyBytes);
        const file = decodeFileField(body.file, "file", "file.pptx");
        const result = await computeChecksumFn({ name: file.name, buffer: file.buffer });
        return sendJson(res, 200, result);
      }

      return sendJson(res, 404, { error: "Not found" });
    } catch (e) {
      const status = e.statusCode || statusForError(e, { PptxParseErrorClass, BrowserUnavailableErrorClass });
      return sendJson(res, status, { error: (e && e.message) || String(e) });
    }
  });
}

// Starts the server, defaulting to loopback-only — same security posture
// bin/cli.js's static server established (see SECURITY_ANALYSIS.md): a
// non-loopback bind is an explicit opt-in via `host`, never the default.
function startServer({ host = "127.0.0.1", port = 0, ...serverOpts } = {}) {
  return new Promise((resolve, reject) => {
    const server = createServer(serverOpts);
    server.on("error", reject);
    server.listen(port, host, () => {
      const addr = server.address();
      resolve({ server, port: addr.port, url: `http://${host}:${addr.port}` });
    });
  });
}

module.exports = { createServer, startServer, DEFAULT_MAX_BODY_BYTES };
