// Generates docs/assets/sample_before.pptx and sample_after.pptx by reusing this repo's own
// sample-pptx.js buildPptx() with the exact buildSample() shape spec from src/pptxdiff/index.html
// (the app's built-in Red/Green TDD fixture: every diff category + add/remove/move slides).
//
// Requires jszip (devDependency, generation-time only — the shipped app loads JSZip from a CDN
// and this script is never served/bundled with it). Run from the repo root:
//   node src/pptxdiff/gen-sample-pptx.mjs [outBefore] [outAfter]
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import JSZip from 'jszip';
import { buildPptx } from './sample-pptx.js';

globalThis.JSZip = JSZip;
globalThis.atob = (b64) => Buffer.from(b64, 'base64').toString('binary');

const EMU = 914400;

function mk(name, x, y, cx, cy, fmt, paras) {
  return Object.assign({ name, x, y, cx, cy, font: 'Arial', size: 18, bold: false, italic: false, color: '#1F1E1B', align: 'l' }, fmt, { paras });
}

const _PNG_DEFAULT = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const _PNG_ALT = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
function _pngSeed(seed) {
  const b64 = seed === 'red-v2' ? _PNG_ALT : _PNG_DEFAULT;
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
function _mediaSeed(kind, seed, kb) {
  const len = kb * 1024;
  const u8 = new Uint8Array(len);
  let h = 0; const str = kind + ':' + seed;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  for (let i = 0; i < len; i++) { h = (h * 1103515245 + 12345) >>> 0; u8[i] = h & 0xff; }
  return { bytes: u8 };
}

// Same shape spec as buildSample() in Slide Diff.dc.html (index.html) — kept in sync deliberately;
// see docs/.scrolls/WISDOM.md for the "build the parser and the sample-data generator together"
// rule this project follows, which this script's sibling relationship to sample-pptx.js continues.
function buildSample() {
  const E = EMU;
  const A = [{
    w: Math.round(13.333 * E), h: 7.5 * E,
    shapes: [
      mk('Title', 0.75 * E, 0.55 * E, 11.8 * E, 1.2 * E, { font: 'Georgia', size: 40, bold: true, color: '#1F1E1B', align: 'l' }, [{ text: 'Q3 Business Review', bullet: false }]),
      mk('Subtitle', 0.75 * E, 1.8 * E, 9 * E, 0.55 * E, { font: 'Arial', size: 18, color: '#6B655A' }, [{ text: 'Prepared by the Strategy Team', bullet: false }]),
      mk('Key points', 1.0 * E, 3.0 * E, 8.2 * E, 3.0 * E, { font: 'Arial', size: 22, color: '#1F1E1B', align: 'l' }, [
        { text: 'Revenue up 12% year over year', bullet: true },
        { text: 'Churn down to 4.1%', bullet: true },
        { text: 'Three new markets launched', bullet: true }
      ]),
      mk('Note', 8.0 * E, 4.9 * E, 4.4 * E, 1.2 * E, { font: 'Arial', size: 14, italic: true, color: '#9A9486', align: 'l' }, [{ text: 'Draft — internal only', bullet: false }]),
      mk('Footer', 0.75 * E, 6.85 * E, 6 * E, 0.4 * E, { font: 'Arial', size: 12, color: '#9A9486' }, [{ text: 'Confidential — 2026', bullet: false }])
    ],
    tables: [{ name: 'Metrics table', x: 0.9 * E, y: 4.55 * E, cx: 6 * E, cy: 1.7 * E, rows: [['Metric', 'Q2', 'Q3'], ['Revenue', '$4.1M', '$4.6M'], ['Churn', '4.3%', '4.1%']] }],
    bg: '#FFFFFF'
  }];
  const B = [{
    w: Math.round(13.333 * E), h: 7.5 * E,
    shapes: [
      mk('Title', 0.75 * E, 0.55 * E, 11.8 * E, 1.2 * E, { font: 'Arial', size: 44, bold: true, color: '#C9684A', align: 'l' }, [{ text: 'Q3 Business Review', bullet: false }]),
      mk('Subtitle', 0.75 * E, 1.8 * E, 9 * E, 0.55 * E, { font: 'Arial', size: 18, color: '#6B655A' }, [{ text: 'Prepared by Strategy & Finance', bullet: false }]),
      mk('Key points', 1.0 * E, 3.0 * E, 8.2 * E, 3.0 * E, { font: 'Arial', size: 22, color: '#1F1E1B', align: 'l' }, [
        { text: 'Revenue up 15% year over year', bullet: true },
        { text: 'Churn down to 4.1%', bullet: true },
        { text: 'Three new markets launched', bullet: true }
      ]),
      mk('Callout', 9.0 * E, 3.1 * E, 3.5 * E, 1.3 * E, { font: 'Georgia', size: 20, italic: true, color: '#C9684A', align: 'ctr' }, [{ text: 'On track for a record Q4', bullet: false }]),
      mk('Footer', 6.6 * E, 6.85 * E, 6 * E, 0.4 * E, { font: 'Arial', size: 12, color: '#9A9486', align: 'r' }, [{ text: 'Confidential — 2026', bullet: false }])
    ],
    tables: [{ name: 'Metrics table', x: 0.9 * E, y: 4.55 * E, cx: 6 * E, cy: 1.7 * E, rows: [['Metric', 'Q2', 'Q3'], ['Revenue', '$4.1M', '$4.6M'], ['Churn', '4.3%', '4.1%'], ['New logos', '18', '27']] }],
    bg: '#FBF8F1'
  }];

  const redA = {
    w: Math.round(13.333 * E), h: 7.5 * E, bg: '#FFFFFF',
    transition: { type: 'fade', spd: 'med', advTm: null },
    notes: 'Walk through the roadmap slide slowly — leadership cares about Q4 dates.',
    shapes: [
      mk('Title', 0.75 * E, 0.5 * E, 11.8 * E, 1.0 * E, { font: 'Georgia', size: 32, bold: true }, [{ text: 'Feature Showcase', bullet: false }]),
      Object.assign(mk('Details link', 0.75 * E, 1.6 * E, 6 * E, 0.5 * E, { font: 'Arial', size: 16, color: '#2A6FDB' }, [{ text: 'Full roadmap and details', bullet: false }]), { link: 'https://example.com/roadmap-2026-draft', wrap: 'square' }),
      Object.assign(mk('Wrapped note', 7.1 * E, 1.55 * E, 2.2 * E, 0.9 * E, { font: 'Arial', size: 13, color: '#6B655A' }, [{ text: 'This note wraps across lines inside a narrow box.', bullet: false }]), { wrap: 'square' }),
      Object.assign(mk('Bordered callout', 0.75 * E, 5.35 * E, 4.6 * E, 1.15 * E, { font: 'Arial', size: 16, bold: true, color: '#1F1E1B' }, [{ text: 'On track for GA', bullet: false }]), { border: { w: 1, color: '#3E7C5A' } }),
      mk('Footer', 0.75 * E, 6.9 * E, 6 * E, 0.4 * E, { font: 'Arial', size: 12, color: '#9A9486' }, [{ text: 'Confidential — draft v1', bullet: false }])
    ],
    images: [{ name: 'Product shot', x: 9.3 * E, y: 0.55 * E, cx: 3.2 * E, cy: 1.9 * E, bytes: _pngSeed('red-v1') }],
    tables: [{ name: 'Formatting table', x: 0.75 * E, y: 2.65 * E, cx: 6.2 * E, cy: 2.4 * E, rows: [
      [{ text: 'Region', bg: '#EAE4D6' }, { text: 'Owner', bg: '#EAE4D6' }, { text: 'Status', bg: '#EAE4D6' }],
      [{ text: 'AMER', bg: '#FFFFFF', border: { w: 0.75, color: '#CCCCCC' } }, { text: 'A. Chen' }, { text: 'Green', bg: '#E4F3E9' }],
      [{ text: 'EMEA', bg: '#FFFFFF' }, { text: 'R. Diaz' }, { text: 'At risk', bg: '#FBEFEC' }]
    ] }],
    charts: [{ name: 'Adoption chart', x: 9.3 * E, y: 2.65 * E, cx: 3.2 * E, cy: 2.4 * E, chartType: 'bar', series: [{ name: 'Adoption', values: [12, 18, 24] }] }],
    smartArt: [{ name: 'Process diagram', x: 9.3 * E, y: 5.2 * E, cx: 3.2 * E, cy: 1.3 * E, texts: ['Plan', 'Build', 'Launch'] }],
    media: [Object.assign({ name: 'Demo clip', x: 4.6 * E, y: 5.35 * E, cx: 2.0 * E, cy: 1.15 * E }, { kind: 'video' }, _mediaSeed('video', 'red-v1', 24))]
  };
  const redB = {
    w: Math.round(13.333 * E), h: 7.5 * E, bg: '#F4EFE3',
    transition: { type: 'push', spd: 'fast', advTm: 4000 },
    notes: { text: 'Walk through the roadmap slide slowly — leadership cares about Q4 dates. Mention the EMEA slip.', bold: true, color: '#C9684A' },
    shapes: [
      mk('Title', 0.75 * E, 0.5 * E, 11.8 * E, 1.0 * E, { font: 'Georgia', size: 32, bold: true }, [{ text: 'Feature Showcase', bullet: false }]),
      Object.assign(mk('Details link', 0.75 * E, 1.6 * E, 6 * E, 0.5 * E, { font: 'Arial', size: 16, color: '#2A6FDB' }, [{ text: 'Full roadmap and details', bullet: false }]), { link: 'https://example.com/roadmap-2026-final', wrap: 'square' }),
      Object.assign(mk('Wrapped note', 7.1 * E, 1.55 * E, 2.2 * E, 0.9 * E, { font: 'Arial', size: 13, color: '#6B655A' }, [{ text: 'This note wraps across lines inside a narrow box.', bullet: false }]), { wrap: 'none' }),
      Object.assign(mk('Bordered callout', 0.75 * E, 5.35 * E, 4.6 * E, 1.15 * E, { font: 'Arial', size: 16, bold: true, color: '#1F1E1B' }, [{ text: 'On track for GA', bullet: false }]), { border: { w: 3, color: '#C9684A' } }),
      mk('Footer', 0.75 * E, 6.9 * E, 6 * E, 0.4 * E, { font: 'Arial', size: 12, color: '#9A9486' }, [{ text: 'Confidential — final', bullet: false }])
    ],
    images: [{ name: 'Product shot', x: 9.3 * E, y: 0.55 * E, cx: 3.2 * E, cy: 1.9 * E, bytes: _pngSeed('red-v2') }],
    tables: [{ name: 'Formatting table', x: 0.75 * E, y: 2.65 * E, cx: 6.2 * E, cy: 2.4 * E, rows: [
      [{ text: 'Region', bg: '#EAE4D6' }, { text: 'Owner', bg: '#EAE4D6' }, { text: 'Status', bg: '#EAE4D6' }],
      [{ text: 'AMER', bg: '#FFFFFF', border: { w: 2, color: '#3E7C5A' } }, { text: 'A. Chen' }, { text: 'Green', bg: '#E4F3E9' }],
      [{ text: 'EMEA', bg: '#FBEFEC' }, { text: 'R. Diaz' }, { text: 'Blocked', bg: '#FBEFEC' }]
    ] }],
    charts: [{ name: 'Adoption chart', x: 9.3 * E, y: 2.65 * E, cx: 3.2 * E, cy: 2.4 * E, chartType: 'bar', series: [{ name: 'Adoption', values: [12, 18, 31] }] }],
    smartArt: [{ name: 'Process diagram', x: 9.3 * E, y: 5.2 * E, cx: 3.2 * E, cy: 1.3 * E, texts: ['Plan', 'Build', 'Launch', 'Iterate'] }],
    media: [Object.assign({ name: 'Demo clip', x: 4.6 * E, y: 5.35 * E, cx: 2.0 * E, cy: 1.15 * E }, { kind: 'video' }, _mediaSeed('video', 'red-v2', 30))]
  };

  const greenSpec = {
    w: Math.round(13.333 * E), h: 7.5 * E, bg: '#FFFFFF',
    transition: { type: 'fade', spd: 'slow', advTm: null },
    notes: 'This slide should show zero differences — a control for the diff engine.',
    shapes: [
      mk('Title', 0.75 * E, 0.5 * E, 11.8 * E, 1.0 * E, { font: 'Georgia', size: 32, bold: true }, [{ text: 'Stable Slide (control)', bullet: false }]),
      Object.assign(mk('Link', 0.75 * E, 1.6 * E, 6 * E, 0.5 * E, { font: 'Arial', size: 16, color: '#2A6FDB' }, [{ text: 'Unchanged reference link', bullet: false }]), { link: 'https://example.com/stable', wrap: 'square' }),
      Object.assign(mk('Bordered box', 0.75 * E, 2.3 * E, 4.6 * E, 1.15 * E, { font: 'Arial', size: 16, bold: true }, [{ text: 'No changes here', bullet: false }]), { border: { w: 1.5, color: '#8A8273' } })
    ],
    images: [{ name: 'Static shot', x: 6.0 * E, y: 2.3 * E, cx: 2.6 * E, cy: 1.6 * E, bytes: _pngSeed('green-const') }],
    tables: [{ name: 'Control table', x: 0.75 * E, y: 4.0 * E, cx: 6.2 * E, cy: 1.4 * E, rows: [
      [{ text: 'Item', bg: '#EAE4D6' }, { text: 'Value', bg: '#EAE4D6' }],
      [{ text: 'Uptime', bg: '#FFFFFF' }, { text: '99.98%' }]
    ] }],
    smartArt: [{ name: 'Static diagram', x: 0.75 * E, y: 5.6 * E, cx: 4.6 * E, cy: 1.2 * E, texts: ['Same', 'Same', 'Same'] }]
  };
  const greenA = structuredClone(greenSpec);
  const greenB = structuredClone(greenSpec);

  const E2 = EMU;
  const deprecatedSlide = {
    w: Math.round(13.333 * E2), h: 7.5 * E2, bg: '#FFFFFF',
    shapes: [
      mk('Title', 0.75 * E2, 0.55 * E2, 11.8 * E2, 1.0 * E2, { font: 'Georgia', size: 32, bold: true }, [{ text: 'Deprecated Process (remove in v2)', bullet: false }]),
      mk('Body', 0.75 * E2, 1.9 * E2, 10 * E2, 2 * E2, { font: 'Arial', size: 18 }, [{ text: 'This workflow was retired ahead of the v2 review.', bullet: false }])
    ]
  };
  const onboardingSlide = {
    w: Math.round(13.333 * E2), h: 7.5 * E2, bg: '#FFFFFF',
    shapes: [
      mk('Title', 0.75 * E2, 0.55 * E2, 11.8 * E2, 1.0 * E2, { font: 'Georgia', size: 32, bold: true }, [{ text: 'Onboarding Flow', bullet: false }]),
      mk('Body', 0.75 * E2, 1.9 * E2, 10 * E2, 2 * E2, { font: 'Arial', size: 18 }, [{ text: 'New-user activation steps and drop-off metrics.', bullet: false }])
    ]
  };
  const billingSlide = {
    w: Math.round(13.333 * E2), h: 7.5 * E2, bg: '#FFFFFF',
    shapes: [
      mk('Title', 0.75 * E2, 0.55 * E2, 11.8 * E2, 1.0 * E2, { font: 'Georgia', size: 32, bold: true }, [{ text: 'Billing Flow', bullet: false }]),
      mk('Body', 0.75 * E2, 1.9 * E2, 10 * E2, 2 * E2, { font: 'Arial', size: 18 }, [{ text: 'Invoice generation and payment retry logic.', bullet: false }])
    ]
  };

  A.push(redA, greenA, deprecatedSlide, onboardingSlide, billingSlide);
  B.push(redB, greenB, billingSlide, onboardingSlide);
  return { A, B };
}

const s = buildSample();
const E = EMU, cx = Math.round(13.333 * E), cy = Math.round(7.5 * E);
const bufA = await buildPptx(s.A, cx, cy, { embeddedFonts: ['Brand Sans'] });
const bufB = await buildPptx(s.B, cx, cy, { embeddedFonts: ['Brand Sans', 'Brand Mono'] });

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const outBefore = process.argv[2] || path.join(repoRoot, 'docs/assets/sample_before.pptx');
const outAfter = process.argv[3] || path.join(repoRoot, 'docs/assets/sample_after.pptx');

writeFileSync(outBefore, Buffer.from(bufA));
writeFileSync(outAfter, Buffer.from(bufB));
console.log('wrote', outBefore, bufA.byteLength, 'bytes');
console.log('wrote', outAfter, bufB.byteLength, 'bytes');
