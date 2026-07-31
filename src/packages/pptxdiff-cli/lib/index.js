"use strict";

// Public programmatic API — what @pptxdiff/server (and any other future
// Node consumer) imports, rather than reaching into lib/automation.js or
// lib/format.js directly. Keeps exactly one place that defines this
// package's external contract.
const { diffDecks, computeChecksum, extractDeckText, BrowserUnavailableError, PptxParseError } = require("./automation.js");
const { hasDifferences, countChangedSlides, formatDiffSummary } = require("./format.js");
const { formatDeckText } = require("./textconv.js");

module.exports = {
  diffDecks,
  computeChecksum,
  extractDeckText,
  hasDifferences,
  countChangedSlides,
  formatDiffSummary,
  formatDeckText,
  BrowserUnavailableError,
  PptxParseError,
};
