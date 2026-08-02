"use strict";

function buildOpenApiSpec({ version = "0.1.0", serverUrl = "http://127.0.0.1:0" } = {}) {
  const filePayload = {
    type: "object",
    required: ["content"],
    properties: {
      name: { type: "string", description: "Original filename, used in reports and errors." },
      content: { type: "string", format: "byte", description: "Base64-encoded .pptx file bytes." },
    },
  };

  const errorResponse = {
    description: "Error response",
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["error"],
          properties: { error: { type: "string" } },
        },
      },
    },
  };

  return {
    openapi: "3.1.0",
    info: {
      title: "pptxdiff Web API",
      version,
      description: "Local-first API for diffing PowerPoint decks with pptxdiff.",
    },
    servers: [{ url: serverUrl }],
    paths: {
      "/v1/health": {
        get: {
          summary: "Health check",
          responses: {
            200: {
              description: "Server is running",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["status", "version"],
                    properties: {
                      status: { type: "string", enum: ["ok"] },
                      version: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/v1/diff": {
        post: {
          summary: "Diff two PowerPoint decks",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["before", "after"],
                  properties: {
                    before: filePayload,
                    after: filePayload,
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "pptxdiff JSON report",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
            400: errorResponse,
            413: errorResponse,
            422: errorResponse,
            503: errorResponse,
            500: errorResponse,
          },
        },
      },
      "/v1/checksum": {
        post: {
          summary: "Compute a parser-independent deck checksum",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["file"],
                  properties: { file: filePayload },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Checksum",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["algorithm", "hash"],
                    properties: {
                      algorithm: { type: "string", enum: ["SHA-256"] },
                      hash: { type: "string", pattern: "^[0-9a-fA-F]{64}$" },
                    },
                  },
                },
              },
            },
            400: errorResponse,
            413: errorResponse,
            422: errorResponse,
            503: errorResponse,
            500: errorResponse,
          },
        },
      },
      "/openapi.json": {
        get: {
          summary: "OpenAPI specification",
          responses: {
            200: {
              description: "OpenAPI 3.1 document",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
      "/docs": {
        get: {
          summary: "Interactive API documentation",
          responses: {
            200: {
              description: "Swagger UI HTML",
              content: { "text/html": { schema: { type: "string" } } },
            },
          },
        },
      },
    },
  };
}

function buildDocsHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>pptxdiff Web API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <noscript><a href="/openapi.json">OpenAPI JSON</a></noscript>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.addEventListener("load", () => {
      SwaggerUIBundle({ url: "/openapi.json", dom_id: "#swagger-ui" });
    });
  </script>
</body>
</html>`;
}

module.exports = { buildOpenApiSpec, buildDocsHtml };
