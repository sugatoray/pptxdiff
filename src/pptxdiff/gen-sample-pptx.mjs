// Generates docs/assets/sample_before.pptx and sample_after.pptx using pptxgenjs (a real,
// battle-tested OOXML writer) instead of sample-pptx.js's hand-rolled XML. That homegrown
// generator was only ever "valid enough" for this app's own tolerant parser/renderer — it
// produced files real Microsoft PowerPoint could not open or even repair (invalid SmartArt
// diagram XML, missing Content-Types overrides). pptxgenjs writes genuinely spec-compliant
// parts, so it's used here in place of sample-pptx.js for on-disk fixtures.
//
// Covers: text/font/size/color/bold/italic/align, hyperlinks, text wrap, shape border, images
// (content differs before/after), tables (per-cell fill/border), charts (bar, series values
// differ), speaker notes, slide backgrounds, and add/remove/move slide scenarios (deck-level
// alignment testing). NOT covered (pptxgenjs has no API for these, or they were the proven
// cause of real-PowerPoint corruption in the prior generator): SmartArt/diagrams, slide
// transitions, embedded fonts, real video/audio media — see docs/.scrolls/GAP_ANALYSIS.md.
//
// Run from the repo root: node src/pptxdiff/gen-sample-pptx.mjs [outBefore] [outAfter]
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import PptxGenJS from 'pptxgenjs';

// pptxgenjs's built-in 'LAYOUT_16x9' preset is 10 x 5.625in, NOT the 13.333 x 7.5in modern
// PowerPoint widescreen default — every coordinate below is authored against the latter, so a
// custom layout is defined to match (this mismatch was the root cause of shapes rendering
// outside the slide bounds; see docs/.scrolls/HANDOFF.md).
const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

// Two distinct, real, valid 1x1 PNGs (different pixel colors) so the image diff (content hash)
// has something real to detect between before/after.
const PNG_A = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const PNG_B = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

// Regression guard: every add* call site below passes through here so a future coordinate typo
// (or another wrong-canvas-size mistake) fails loudly at generation time instead of silently
// producing a slide with content past its edges.
function checkBounds(label, { x = 0, y = 0, w = 0, h = 0 }) {
  const right = x + w;
  const bottom = y + h;
  if (x < 0 || y < 0 || right > SLIDE_W + 1e-6 || bottom > SLIDE_H + 1e-6) {
    throw new Error(`${label}: bounds [x=${x}, y=${y}, w=${w}, h=${h}] (right=${right.toFixed(3)}, bottom=${bottom.toFixed(3)}) exceed slide ${SLIDE_W}x${SLIDE_H}in`);
  }
}
function placedText(slide, label, text, opts) {
  checkBounds(label, opts);
  slide.addText(text, opts);
}
function placedImage(slide, label, opts) {
  checkBounds(label, opts);
  slide.addImage(opts);
}
function placedTable(slide, label, rows, opts) {
  checkBounds(label, opts); // h is auto (content-driven) for tables, so only x/y/w are checked
  slide.addTable(rows, opts);
}
function placedChart(slide, label, type, data, opts) {
  checkBounds(label, opts);
  slide.addChart(type, data, opts);
}

function buildSlide1(pptx, isBefore) {
  const s = pptx.addSlide();
  s.background = { color: isBefore ? 'FFFFFF' : 'FBF8F1' };
  placedText(s, 'slide1:title', 'Q3 Business Review', isBefore
    ? { x: 0.75, y: 0.4, w: 11.8, h: 1.0, fontFace: 'Georgia', fontSize: 40, bold: true, color: '1F1E1B', align: 'left' }
    : { x: 0.75, y: 0.4, w: 11.8, h: 1.0, fontFace: 'Arial', fontSize: 44, bold: true, color: 'C9684A', align: 'left' });
  placedText(s, 'slide1:subtitle', isBefore ? 'Prepared by the Strategy Team' : 'Prepared by Strategy & Finance',
    { x: 0.75, y: 1.5, w: 9, h: 0.5, fontFace: 'Arial', fontSize: 18, color: '6B655A' });
  placedText(s, 'slide1:bullets', [
    { text: isBefore ? 'Revenue up 12% year over year' : 'Revenue up 15% year over year', options: { bullet: true, breakLine: true } },
    { text: 'Churn down to 4.1%', options: { bullet: true, breakLine: true } },
    { text: 'Three new markets launched', options: { bullet: true } }
  ], { x: 1.0, y: 2.3, w: 8.2, h: 2.2, fontFace: 'Arial', fontSize: 22, color: '1F1E1B' });
  if (isBefore) {
    placedText(s, 'slide1:note', 'Draft — internal only', { x: 8.0, y: 4.9, w: 4.4, h: 0.8, fontFace: 'Arial', fontSize: 14, italic: true, color: '9A9486' });
  } else {
    placedText(s, 'slide1:callout', 'On track for a record Q4', { x: 9.0, y: 3.1, w: 3.5, h: 1.0, fontFace: 'Georgia', fontSize: 20, italic: true, color: 'C9684A', align: 'center' });
  }
  placedText(s, 'slide1:footer', 'Confidential — 2026', {
    x: isBefore ? 0.75 : 6.6, y: 6.85, w: 6, h: 0.4, fontFace: 'Arial', fontSize: 12, color: '9A9486', align: isBefore ? 'left' : 'right'
  });
  const metricsHeader = [
    { text: 'Metric', options: { bold: true, fill: { color: 'EAE4D6' } } },
    { text: 'Q2', options: { bold: true, fill: { color: 'EAE4D6' } } },
    { text: 'Q3', options: { bold: true, fill: { color: 'EAE4D6' } } }
  ];
  const metricsRows = [metricsHeader, ['Revenue', '$4.1M', '$4.6M'], ['Churn', '4.3%', '4.1%']];
  if (!isBefore) metricsRows.push(['New logos', '18', '27']);
  placedTable(s, 'slide1:table', metricsRows, { x: 0.9, y: 4.55, w: 6, fontSize: 14, border: { type: 'solid', color: 'CCCCCC', pt: 0.75 } });
}

function buildSlide2(pptx, isBefore) {
  const s = pptx.addSlide();
  s.background = { color: isBefore ? 'FFFFFF' : 'F4EFE3' };
  placedText(s, 'slide2:title', 'Feature Showcase', { x: 0.75, y: 0.5, w: 11.8, h: 1.0, fontFace: 'Georgia', fontSize: 32, bold: true, color: '1F1E1B' });
  placedText(s, 'slide2:link', 'Full roadmap and details', {
    x: 0.75, y: 1.6, w: 6, h: 0.5, fontFace: 'Arial', fontSize: 16, color: '2A6FDB',
    hyperlink: { url: isBefore ? 'https://example.com/roadmap-2026-draft' : 'https://example.com/roadmap-2026-final' }
  });
  placedText(s, 'slide2:wrappedNote', 'This note wraps across lines inside a narrow box.', {
    x: 7.1, y: 1.55, w: 2.2, h: 0.9, fontFace: 'Arial', fontSize: 13, color: '6B655A', wrap: isBefore
  });
  placedText(s, 'slide2:borderedCallout', 'On track for GA', {
    x: 0.75, y: 5.35, w: 4.6, h: 1.15, fontFace: 'Arial', fontSize: 16, bold: true, color: '1F1E1B',
    line: isBefore ? { color: '3E7C5A', width: 1 } : { color: 'C9684A', width: 3 }
  });
  placedText(s, 'slide2:footer', isBefore ? 'Confidential — draft v1' : 'Confidential — final', { x: 0.75, y: 6.9, w: 6, h: 0.4, fontFace: 'Arial', fontSize: 12, color: '9A9486' });
  placedImage(s, 'slide2:image', { data: `image/png;base64,${isBefore ? PNG_A : PNG_B}`, x: 9.3, y: 0.55, w: 3.2, h: 1.9 });
  const fmtHeader = [
    { text: 'Region', options: { bold: true, fill: { color: 'EAE4D6' } } },
    { text: 'Owner', options: { bold: true, fill: { color: 'EAE4D6' } } },
    { text: 'Status', options: { bold: true, fill: { color: 'EAE4D6' } } }
  ];
  const fmtRows = isBefore
    ? [fmtHeader,
      [{ text: 'AMER', options: { fill: { color: 'FFFFFF' }, border: { type: 'solid', color: 'CCCCCC', pt: 0.75 } } }, 'A. Chen', { text: 'Green', options: { fill: { color: 'E4F3E9' } } }],
      [{ text: 'EMEA', options: { fill: { color: 'FFFFFF' } } }, 'R. Diaz', { text: 'At risk', options: { fill: { color: 'FBEFEC' } } }]]
    : [fmtHeader,
      [{ text: 'AMER', options: { fill: { color: 'FFFFFF' }, border: { type: 'solid', color: '3E7C5A', pt: 2 } } }, 'A. Chen', { text: 'Green', options: { fill: { color: 'E4F3E9' } } }],
      [{ text: 'EMEA', options: { fill: { color: 'FBEFEC' } } }, 'R. Diaz', { text: 'Blocked', options: { fill: { color: 'FBEFEC' } } }]];
  placedTable(s, 'slide2:table', fmtRows, { x: 0.75, y: 2.65, w: 6.2, fontSize: 13 });
  placedChart(s, 'slide2:chart', pptx.ChartType.bar,
    [{ name: 'Adoption', labels: ['C1', 'C2', 'C3'], values: isBefore ? [12, 18, 24] : [12, 18, 31] }],
    { x: 9.3, y: 2.65, w: 3.2, h: 2.4, showTitle: false, showLegend: false });
  s.addNotes(isBefore
    ? 'Walk through the roadmap slide slowly — leadership cares about Q4 dates.'
    : 'Walk through the roadmap slide slowly — leadership cares about Q4 dates. Mention the EMEA slip.');
}

function buildSlide3(pptx) {
  const s = pptx.addSlide();
  s.background = { color: 'FFFFFF' };
  placedText(s, 'slide3:title', 'Stable Slide (control)', { x: 0.75, y: 0.5, w: 11.8, h: 1.0, fontFace: 'Georgia', fontSize: 32, bold: true, color: '1F1E1B' });
  placedText(s, 'slide3:link', 'Unchanged reference link', { x: 0.75, y: 1.6, w: 6, h: 0.5, fontFace: 'Arial', fontSize: 16, color: '2A6FDB', hyperlink: { url: 'https://example.com/stable' } });
  placedText(s, 'slide3:box', 'No changes here', { x: 0.75, y: 2.3, w: 4.6, h: 1.15, fontFace: 'Arial', fontSize: 16, bold: true, color: '1F1E1B', line: { color: '8A8273', width: 1.5 } });
  placedImage(s, 'slide3:image', { data: `image/png;base64,${PNG_A}`, x: 6.0, y: 2.3, w: 2.6, h: 1.6 });
  placedTable(s, 'slide3:table', [
    [{ text: 'Item', options: { bold: true, fill: { color: 'EAE4D6' } } }, { text: 'Value', options: { bold: true, fill: { color: 'EAE4D6' } } }],
    ['Uptime', '99.98%']
  ], { x: 0.75, y: 4.0, w: 6.2, fontSize: 14 });
  s.addNotes('This slide should show zero differences — a control for the diff engine.');
}

// Slides 4-6 — deletion + reorder: a Before-only slide (removed), and two slides that swap
// order between Before and After (moved).
function simpleSlide(pptx, title, body) {
  const s = pptx.addSlide();
  s.background = { color: 'FFFFFF' };
  placedText(s, `simple:${title}:title`, title, { x: 0.75, y: 0.55, w: 11.8, h: 1.0, fontFace: 'Georgia', fontSize: 32, bold: true });
  placedText(s, `simple:${title}:body`, body, { x: 0.75, y: 1.9, w: 10, h: 2, fontFace: 'Arial', fontSize: 18 });
}

function buildDeck(variant) {
  const isBefore = variant === 'before';
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'PPTXDIFF_16X9', width: SLIDE_W, height: SLIDE_H });
  pptx.layout = 'PPTXDIFF_16X9';
  pptx.author = 'pptxdiff';
  pptx.company = 'pptxdiff';
  pptx.title = isBefore ? 'Sample Before' : 'Sample After';

  buildSlide1(pptx, isBefore);
  buildSlide2(pptx, isBefore);
  buildSlide3(pptx);

  if (isBefore) {
    simpleSlide(pptx, 'Deprecated Process (remove in v2)', 'This workflow was retired ahead of the v2 review.');
    simpleSlide(pptx, 'Onboarding Flow', 'New-user activation steps and drop-off metrics.');
    simpleSlide(pptx, 'Billing Flow', 'Invoice generation and payment retry logic.');
  } else {
    simpleSlide(pptx, 'Billing Flow', 'Invoice generation and payment retry logic.');
    simpleSlide(pptx, 'Onboarding Flow', 'New-user activation steps and drop-off metrics.');
  }

  return pptx;
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const outBefore = process.argv[2] || path.join(repoRoot, 'docs/assets/sample_before.pptx');
const outAfter = process.argv[3] || path.join(repoRoot, 'docs/assets/sample_after.pptx');

await buildDeck('before').writeFile({ fileName: outBefore });
await buildDeck('after').writeFile({ fileName: outAfter });
console.log('wrote', outBefore);
console.log('wrote', outAfter);
