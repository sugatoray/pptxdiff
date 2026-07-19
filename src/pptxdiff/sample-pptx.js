// Builds real, minimal-but-valid .pptx buffers from a compact shape spec, covering the full
// diff-engine feature set: text, images, tables (with per-cell formatting), charts, SmartArt,
// backgrounds, animations, transitions, speaker notes, hyperlinks, borders/wrap, embedded fonts,
// and dummy video/audio media. Used both to render (via @aiden0z/pptx-renderer) and to diff
// (via the app's XML parser), so the sample is a single source of truth. Requires global JSZip.

const NS = {
  ct: 'http://schemas.openxmlformats.org/package/2006/content-types',
  rel: 'http://schemas.openxmlformats.org/package/2006/relationships',
  oR: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  p: 'http://schemas.openxmlformats.org/presentationml/2006/main'
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const TINY_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
function tinyPngBytes() {
  const bin = atob(TINY_PNG_B64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
function dummyMediaBytes(seed, len) {
  const u8 = new Uint8Array(len);
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  for (let i = 0; i < len; i++) { h = (h * 1103515245 + 12345) >>> 0; u8[i] = h & 0xff; }
  return u8;
}

function shapeXml(s, id, linkRid) {
  const wrap = s.wrap === 'none' ? 'none' : 'square';
  const ln = s.border ? `<a:ln w="${Math.round(s.border.w * 12700)}"><a:solidFill><a:srgbClr val="${s.border.color.replace('#', '')}"/></a:solidFill></a:ln>` : '';
  const paras = s.paras.map((p) => {
    const algn = s.align && s.align !== 'l' ? ` algn="${s.align}"` : '';
    const bu = p.bullet ? `<a:buFont typeface="Arial"/><a:buChar char="\u2022"/>` : `<a:buNone/>`;
    const link = linkRid ? `<a:hlinkClick r:id="${linkRid}"/>` : '';
    const rPr = `<a:rPr lang="en-US" sz="${Math.round(s.size * 100)}" b="${s.bold ? 1 : 0}" i="${s.italic ? 1 : 0}" dirty="0">`
      + `<a:solidFill><a:srgbClr val="${(s.color || '#000000').replace('#', '')}"/></a:solidFill>`
      + `<a:latin typeface="${esc(s.font)}"/>${link}</a:rPr>`;
    return `<a:p><a:pPr${algn} indent="${p.bullet ? -274638 : 0}" marL="${p.bullet ? 274638 : 0}">${bu}</a:pPr>`
      + `<a:r>${rPr}<a:t>${esc(p.text)}</a:t></a:r></a:p>`;
  }).join('');
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${esc(s.name)}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr>${s.ph ? `<p:ph type="${s.ph}"/>` : ''}</p:nvPr></p:nvSpPr>`
    + `<p:spPr><a:xfrm><a:off x="${Math.round(s.x)}" y="${Math.round(s.y)}"/><a:ext cx="${Math.round(s.cx)}" cy="${Math.round(s.cy)}"/></a:xfrm>`
    + `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${ln}</p:spPr>`
    + `<p:txBody><a:bodyPr wrap="${wrap}" rtlCol="0"><a:normAutofit/></a:bodyPr><a:lstStyle/>${paras}</p:txBody></p:sp>`;
}

function cellXml(cell) {
  const c = typeof cell === 'string' ? { text: cell } : cell;
  const fill = c.bg ? `<a:solidFill><a:srgbClr val="${c.bg.replace('#', '')}"/></a:solidFill>` : '<a:noFill/>';
  const bw = c.border ? Math.round(c.border.w * 12700) : 6350;
  const bc = c.border ? c.border.color.replace('#', '') : 'CCCCCC';
  const side = (tag) => `<a:${tag} w="${bw}"><a:solidFill><a:srgbClr val="${bc}"/></a:solidFill></a:${tag}>`;
  return `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="1400" dirty="0"/><a:t>${esc(c.text)}</a:t></a:r></a:p></a:txBody>`
    + `<a:tcPr marL="45720" marR="45720" marT="22860" marB="22860">${side('lnL')}${side('lnR')}${side('lnT')}${side('lnB')}${fill}</a:tcPr></a:tc>`;
}
function tableXml(t, id) {
  const cols = t.rows[0].map(() => Math.round(t.cx / t.rows[0].length));
  const rowH = Math.round(t.cy / t.rows.length);
  const trs = t.rows.map((row) => `<a:tr h="${rowH}">${row.map(cellXml).join('')}</a:tr>`).join('');
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="${esc(t.name)}"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>`
    + `<p:xfrm><a:off x="${Math.round(t.x)}" y="${Math.round(t.y)}"/><a:ext cx="${Math.round(t.cx)}" cy="${Math.round(t.cy)}"/></p:xfrm>`
    + `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">`
    + `<a:tbl><a:tblPr firstRow="1" bandRow="1"/><a:tblGrid>${cols.map((w) => `<a:gridCol w="${w}"/>`).join('')}</a:tblGrid>${trs}</a:tbl>`
    + `</a:graphicData></a:graphic></p:graphicFrame>`;
}
function mediaShapeXml(m, id, mediaRid, posterRid) {
  const tag = m.kind === 'video' ? 'videoFile' : 'audioFile';
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${esc(m.name)}"/><p:cNvPicPr/><p:nvPr><p:${tag} r:link="${mediaRid}"/></p:nvPr></p:nvPicPr>`
    + `<p:blipFill><a:blip r:embed="${posterRid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>`
    + `<p:spPr><a:xfrm><a:off x="${Math.round(m.x)}" y="${Math.round(m.y)}"/><a:ext cx="${Math.round(m.cx)}" cy="${Math.round(m.cy)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}
function imagePicXml(img, id, rid) {
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${esc(img.name)}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>`
    + `<p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>`
    + `<p:spPr><a:xfrm><a:off x="${Math.round(img.x)}" y="${Math.round(img.y)}"/><a:ext cx="${Math.round(img.cx)}" cy="${Math.round(img.cy)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}
function chartPartXml(chart) {
  const sers = chart.series.map((s, i) => `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>`
    + `<c:tx><c:strRef><c:f>Sheet1!$${String.fromCharCode(66 + i)}$1</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${esc(s.name)}</c:v></c:pt></c:strCache></c:strRef></c:tx>`
    + `<c:cat><c:strRef><c:f>Sheet1!$A$2:$A$${s.values.length + 1}</c:f><c:strCache><c:ptCount val="${s.values.length}"/>${s.values.map((v, j) => `<c:pt idx="${j}"><c:v>Cat${j + 1}</c:v></c:pt>`).join('')}</c:strCache></c:strRef></c:cat>`
    + `<c:val><c:numRef><c:f>Sheet1!$${String.fromCharCode(66 + i)}$2:$${String.fromCharCode(66 + i)}$${s.values.length + 1}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${s.values.length}"/>${s.values.map((v, j) => `<c:pt idx="${j}"><c:v>${v}</c:v></c:pt>`).join('')}</c:numCache></c:numRef></c:val></c:ser>`).join('');
  const tag = { bar: 'barChart', line: 'lineChart', pie: 'pieChart' }[chart.chartType] || 'barChart';
  const axes = tag === 'pieChart' ? '' : `<c:catAx><c:axId val="1"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:crossAx val="2"/></c:catAx><c:valAx><c:axId val="2"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:crossAx val="1"/></c:valAx>`;
  const barDir = tag === 'barChart' ? '<c:barDir val="col"/>' : '';
  const axIds = tag === 'pieChart' ? '' : `<c:axId val="1"/><c:axId val="2"/>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="${NS.a}" xmlns:r="${NS.oR}">`
    + `<c:chart><c:plotArea><c:layout/><c:${tag}>${barDir}${sers}${axIds}</c:${tag}>${axes}</c:plotArea></c:chart></c:chartSpace>`;
}
function smartArtDataXml(items) {
  const pts = items.map((t, i) => `<dsp:sp><dsp:txBody><a:bodyPr/><a:p><a:r><a:t>${esc(t)}</a:t></a:r></a:p></dsp:txBody></dsp:sp>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<a:root xmlns:a="${NS.a}"><a:t>${items.map(esc).join('</a:t><a:t>')}</a:t></a:root>`;
}
function transitionXml(t) {
  if (!t || t.type === 'None') return '';
  const attrs = (t.spd ? ` spd="${t.spd}"` : '') + (t.advTm ? ` advTm="${t.advTm}" advClick="0"` : '');
  return `<p:transition${attrs}><p:${t.type}/></p:transition>`;
}
function notesXml(spec) {
  const s = typeof spec === 'string' ? { text: spec } : spec;
  const lines = String(s.text).split('\n');
  const paras = lines.map((line) => {
    const rPr = `<a:rPr lang="en-US" b="${s.bold ? 1 : 0}" i="${s.italic ? 1 : 0}" dirty="0">`
      + (s.color ? `<a:solidFill><a:srgbClr val="${s.color.replace('#', '')}"/></a:solidFill>` : '')
      + (s.font ? `<a:latin typeface="${esc(s.font)}"/>` : '') + `</a:rPr>`;
    return `<a:p><a:r>${rPr}<a:t>${esc(line)}</a:t></a:r></a:p>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:notes xmlns:a="${NS.a}" xmlns:r="${NS.oR}" xmlns:p="${NS.p}">`
    + `<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>`
    + `<p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes Placeholder"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>`
    + `<p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${paras}</p:txBody></p:sp></p:spTree></p:cSld></p:notes>`;
}

function buildSlidePart(slide, slideIdx) {
  let rid = 2;
  const rid_ptr = { get v() { return rid; }, set v(x) { rid = x; } };
  const rels = [`<Relationship Id="rId1" Type="${NS.oR}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>`];
  const extraFiles = [];

  const shapesXml = slide.shapes.map((s, i) => {
    let linkRid = null;
    if (s.link) { linkRid = 'rId' + (rid++); rels.push(`<Relationship Id="${linkRid}" Type="${NS.oR}/hyperlink" Target="${esc(s.link)}" TargetMode="External"/>`); }
    return shapeXml(s, 2 + i, linkRid);
  }).join('');

  const tablesXml = (slide.tables || []).map((t, i) => tableXml(t, 100 + i)).join('');

  const imagesXml = (slide.images || []).map((img, i) => {
    const rid = 'rId' + (rid_ptr.v++);
    const name = `img_${slideIdx}_${i}.png`;
    rels.push(`<Relationship Id="${rid}" Type="${NS.oR}/image" Target="../media/${name}"/>`);
    extraFiles.push({ path: `ppt/media/${name}`, bytes: img.bytes || tinyPngBytes() });
    return imagePicXml(img, 300 + i, rid);
  }).join('');

  const chartsXml = (slide.charts || []).map((ch, i) => {
    const rid = 'rId' + (rid_ptr.v++);
    const name = `chart_${slideIdx}_${i}.xml`;
    rels.push(`<Relationship Id="${rid}" Type="${NS.oR}/chart" Target="../charts/${name}"/>`);
    extraFiles.push({ path: `ppt/charts/${name}`, content: chartPartXml(ch) });
    return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${400 + i}" name="${esc(ch.name)}"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>`
      + `<p:xfrm><a:off x="${Math.round(ch.x)}" y="${Math.round(ch.y)}"/><a:ext cx="${Math.round(ch.cx)}" cy="${Math.round(ch.cy)}"/></p:xfrm>`
      + `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="${NS.oR}" r:id="${rid}"/></a:graphicData></a:graphic></p:graphicFrame>`;
  }).join('');

  const smartArtXml = (slide.smartArt || []).map((sa, i) => {
    const rid = 'rId' + (rid_ptr.v++);
    const name = `data_${slideIdx}_${i}.xml`;
    rels.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramData" Target="../diagrams/${name}"/>`);
    extraFiles.push({ path: `ppt/diagrams/${name}`, content: smartArtDataXml(sa.texts) });
    return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${500 + i}" name="${esc(sa.name)}"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>`
      + `<p:xfrm><a:off x="${Math.round(sa.x)}" y="${Math.round(sa.y)}"/><a:ext cx="${Math.round(sa.cx)}" cy="${Math.round(sa.cy)}"/></p:xfrm>`
      + `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/diagram"><dgm:relIds xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" xmlns:r="${NS.oR}" r:dm="${rid}" r:lo="${rid}" r:qs="${rid}" r:cs="${rid}"/></a:graphicData></a:graphic></p:graphicFrame>`;
  }).join('');

  const mediaXml = (slide.media || []).map((m, i) => {
    const mediaRid = 'rId' + (rid++);
    const ext = m.kind === 'video' ? 'mp4' : 'mp3';
    const mediaName = `media_${slideIdx}_${i}.${ext}`;
    rels.push(`<Relationship Id="${mediaRid}" Type="${NS.oR}/${m.kind}" Target="../media/${mediaName}"/>`);
    const posterRid = 'rId' + (rid++);
    const posterName = `poster_${slideIdx}_${i}.png`;
    rels.push(`<Relationship Id="${posterRid}" Type="${NS.oR}/image" Target="../media/${posterName}"/>`);
    extraFiles.push({ path: `ppt/media/${mediaName}`, bytes: m.bytes });
    extraFiles.push({ path: `ppt/media/${posterName}`, bytes: tinyPngBytes() });
    return mediaShapeXml(m, 200 + i, mediaRid, posterRid);
  }).join('');

  if (slide.notes) {
    const notesRid = 'rId' + (rid++);
    rels.push(`<Relationship Id="${notesRid}" Type="${NS.oR}/notesSlide" Target="../notesSlides/notesSlide${slideIdx + 1}.xml"/>`);
    extraFiles.push({ path: `ppt/notesSlides/notesSlide${slideIdx + 1}.xml`, content: notesXml(slide.notes) });
    extraFiles.push({ path: `ppt/notesSlides/_rels/notesSlide${slideIdx + 1}.xml.rels`, content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${NS.rel}"></Relationships>` });
  }

  const bg = slide.bg ? `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="${slide.bg.replace('#', '')}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>` : '';
  const trans = transitionXml(slide.transition);
  const sldXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`
    + `<p:sld xmlns:a="${NS.a}" xmlns:r="${NS.oR}" xmlns:p="${NS.p}">`
    + `<p:cSld>${bg}<p:spTree>`
    + `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>`
    + `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>`
    + `${shapesXml}${tablesXml}${imagesXml}${chartsXml}${smartArtXml}${mediaXml}</p:spTree></p:cSld>${trans}<p:clrMapOvr><a:overrideClrMapping `
    + `bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:clrMapOvr></p:sld>`;
  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${NS.rel}">${rels.join('')}</Relationships>`;
  return { sldXml, relsXml, extraFiles };
}

const THEME = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="${NS.a}" name="Office"><a:themeElements>
<a:clrScheme name="Office">
<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
<a:dk2><a:srgbClr val="44413A"/></a:dk2><a:lt2><a:srgbClr val="EAE4D6"/></a:lt2>
<a:accent1><a:srgbClr val="C9684A"/></a:accent1><a:accent2><a:srgbClr val="3E7C5A"/></a:accent2>
<a:accent3><a:srgbClr val="2A6FDB"/></a:accent3><a:accent4><a:srgbClr val="B23A2E"/></a:accent4>
<a:accent5><a:srgbClr val="7A5BD6"/></a:accent5><a:accent6><a:srgbClr val="9A9486"/></a:accent6>
<a:hlink><a:srgbClr val="2A6FDB"/></a:hlink><a:folHlink><a:srgbClr val="7A5BD6"/></a:folHlink>
</a:clrScheme>
<a:fontScheme name="Office">
<a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
<a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
</a:fontScheme>
<a:fmtScheme name="Office">
<a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>
<a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>
<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>
</a:fmtScheme>
</a:themeElements></a:theme>`;

const MASTER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="${NS.a}" xmlns:r="${NS.oR}" xmlns:p="${NS.p}">
<p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>
<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
</p:spTree></p:cSld>
<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
<p:txStyles>
<p:titleStyle><a:lvl1pPr><a:defRPr sz="1800"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mj-lt"/></a:defRPr></a:lvl1pPr></p:titleStyle>
<p:bodyStyle><a:lvl1pPr><a:defRPr sz="1800"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr></p:bodyStyle>
<p:otherStyle><a:defPPr><a:defRPr/></a:defPPr></p:otherStyle>
</p:txStyles></p:sldMaster>`;

const LAYOUT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="${NS.a}" xmlns:r="${NS.oR}" xmlns:p="${NS.p}" type="blank" preserve="1">
<p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
</p:spTree></p:cSld><p:clrMapOvr><a:overrideClrMapping bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:clrMapOvr></p:sldLayout>`;

export function makeVideo(seed, kb) { return { bytes: dummyMediaBytes('video:' + seed, kb * 1024) }; }
export function makeAudio(seed, kb) { return { bytes: dummyMediaBytes('audio:' + seed, kb * 1024) }; }

export async function buildPptx(slides, cx, cy, opts) {
  if (typeof JSZip === 'undefined') throw new Error('JSZip not loaded');
  opts = opts || {};
  const zip = new JSZip();
  const fonts = opts.embeddedFonts || [];

  zip.file('[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="${NS.ct}">`
    + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
    + `<Default Extension="xml" ContentType="application/xml"/>`
    + `<Default Extension="png" ContentType="image/png"/>`
    + `<Default Extension="mp4" ContentType="video/mp4"/>`
    + `<Default Extension="mp3" ContentType="audio/mpeg"/>`
    + `<Default Extension="fntdata" ContentType="application/x-font-fntdata"/>`
    + `<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>`
    + `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>`
    + `<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>`
    + slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')
    + slides.map((sl, i) => sl.notes ? `<Override PartName="/ppt/notesSlides/notesSlide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>` : '').join('')
    + slides.map((sl, i) => (sl.charts || []).map((_, ci) => `<Override PartName="/ppt/charts/chart_${i}_${ci}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`).join('')).join('')
    + `<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>`
    + `</Types>`);

  zip.file('_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${NS.rel}">`
    + `<Relationship Id="rId1" Type="${NS.oR}/officeDocument" Target="ppt/presentation.xml"/></Relationships>`);

  const sldIds = slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${10 + i}"/>`).join('');
  const embedFontLst = fonts.length
    ? `<p:embeddedFontLst>${fonts.map((f, i) => `<p:embeddedFont><p:font typeface="${esc(f)}"/><p:regular r:id="rIdFont${i}"/></p:embeddedFont>`).join('')}</p:embeddedFontLst>`
    : '';
  zip.file('ppt/presentation.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:presentation xmlns:a="${NS.a}" xmlns:r="${NS.oR}" xmlns:p="${NS.p}"${fonts.length ? ' embedTrueTypeFonts="1"' : ''}>`
    + `<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>`
    + `<p:sldIdLst>${sldIds}</p:sldIdLst>`
    + `<p:sldSz cx="${cx}" cy="${cy}"/><p:notesSz cx="6858000" cy="9144000"/>${embedFontLst}</p:presentation>`);

  const presRels = [`<Relationship Id="rId1" Type="${NS.oR}/slideMaster" Target="slideMasters/slideMaster1.xml"/>`,
    `<Relationship Id="rId2" Type="${NS.oR}/theme" Target="theme/theme1.xml"/>`]
    .concat(slides.map((_, i) => `<Relationship Id="rId${10 + i}" Type="${NS.oR}/slide" Target="slides/slide${i + 1}.xml"/>`))
    .concat(fonts.map((f, i) => `<Relationship Id="rIdFont${i}" Type="${NS.oR}/font" Target="fonts/font${i}.fntdata"/>`))
    .join('');
  zip.file('ppt/_rels/presentation.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${NS.rel}">${presRels}</Relationships>`);
  fonts.forEach((f, i) => zip.file(`ppt/fonts/font${i}.fntdata`, dummyMediaBytes('font:' + f, 512)));

  zip.file('ppt/theme/theme1.xml', THEME);
  zip.file('ppt/slideMasters/slideMaster1.xml', MASTER);
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${NS.rel}">`
    + `<Relationship Id="rId1" Type="${NS.oR}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>`
    + `<Relationship Id="rId2" Type="${NS.oR}/theme" Target="../theme/theme1.xml"/></Relationships>`);
  zip.file('ppt/slideLayouts/slideLayout1.xml', LAYOUT);
  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${NS.rel}">`
    + `<Relationship Id="rId1" Type="${NS.oR}/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`);

  slides.forEach((sl, i) => {
    const part = buildSlidePart(sl, i);
    zip.file(`ppt/slides/slide${i + 1}.xml`, part.sldXml);
    zip.file(`ppt/slides/_rels/slide${i + 1}.xml.rels`, part.relsXml);
    part.extraFiles.forEach((f) => zip.file(f.path, f.bytes || f.content));
  });

  return await zip.generateAsync({ type: 'arraybuffer' });
}
