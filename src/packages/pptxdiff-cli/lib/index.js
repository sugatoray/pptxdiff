"use strict";

// Public programmatic API — what @pptxdiff/server (and any other future
// Node consumer) imports, rather than reaching into lib/automation.js or
// lib/format.js directly. Keeps exactly one place that defines this
// package's external contract.
const { diffDecks, computeChecksum, extractDeckText, openDifftool, BrowserUnavailableError, PptxParseError } = require("./automation.js");
const { hasDifferences, countChangedSlides, formatDiffSummary } = require("./format.js");
const { formatDeckText } = require("./textconv.js");
const { installGitIntegration } = require("./git-integration.js");

module.exports = {
  diffDecks,
  computeChecksum,
  extractDeckText,
  openDifftool,
  hasDifferences,
  countChangedSlides,
  formatDiffSummary,
  formatDeckText,
  installGitIntegration,
  BrowserUnavailableError,
  PptxParseError,
};
