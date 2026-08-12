import { YoutubeTranscript } from 'youtube-transcript';
import fs from 'fs';

const EN = ['en','en-US','en-GB','en-orig','a.en'];

function parseAvail(msg) {
  const m = /Available languages:\s*([^\n.]+)/i.exec(msg||'');
  return m?.[1]?.split(/[,，]/).map(s=>s.trim()).filter(Boolean) || [];
}
function preferEn(langs) {
  return langs.filter(l => /^en\b|^a\.en/i.test(l) || l.toLowerCase().includes('en-'));
}
async function hasEnglishCaptions(videoId) {
  const tried = new Set();
  const queue = [...EN];
  while (queue.length) {
    const lang = queue.shift();
    const key = lang.toLowerCase();
    if (tried.has(key)) continue;
    tried.add(key);
    try {
      const cues = await YoutubeTranscript.fetchTranscript(videoId, { lang });
      const text = cues.map(c => String(c.text||'').replace(/\[[^\]]*\]/g,'').trim()).filter(Boolean).join(' ');
      if (text.length >= 80 && /[A-Za-z]{3,}/.test(text)) {
        return { ok: true, lang, chars: text.length, head: text.slice(0,80) };
      }
    } catch (e) {
      const msg = e.message || '';
      if (/disabled on this video/i.test(msg)) return { ok: false, reason: 'disabled' };
      for (const a of preferEn(parseAvail(msg))) {
        if (!tried.has(a.toLowerCase())) queue.push(a);
      }
      if (/No transcripts are available/i.test(msg) && preferEn(parseAvail(msg)).length === 0 && parseAvail(msg).length === 0) {
        // may still have default
      }
    }
  }
  try {
    const cues = await YoutubeTranscript.fetchTranscript(videoId);
    const text = cues.map(c => String(c.text||'')).join(' ');
    if (text.length >= 80 && /[A-Za-z]{3,}/.test(text)) {
      return { ok: true, lang: 'default', chars: text.length, head: text.slice(0,80) };
    }
    return { ok: false, reason: 'non-english-or-short', chars: text.length };
  } catch (e) {
    const msg = e.message || '';
    if (/disabled/i.test(msg)) return { ok: false, reason: 'disabled' };
    return { ok: false, reason: msg.slice(0,120) };
  }
}

// Extract catalogs via regex from source files (no TS load needed)
function extractVideoEntries(file, titleKey='title') {
  const src = fs.readFileSync(file,'utf8');
  const entries = [];
  const re = /videoId:\s*"([^"]+)"[\s\S]*?title:\s*"([^"]+)"/g;
  // Better: split by videoId blocks
  const blocks = src.split(/\{\s*\n\s*videoId:/).slice(1);
  for (const b of blocks) {
    const id = /^[\s"]*([^"\s]+)/.exec(b)?.[1] || /"([^"]+)"/.exec(b)?.[1];
    const title = /title:\s*"([^"]+)"/.exec(b)?.[1];
    if (id && title) entries.push({ videoId: id.replace(/"/g,''), title });
  }
  // dedupe by videoId keeping first
  const seen = new Set();
  return entries.filter(e => (seen.has(e.videoId) ? false : (seen.add(e.videoId), true)));
}

function extractNatGeo(file) {
  const src = fs.readFileSync(file,'utf8');
  const blocks = src.split(/\{\s*\n\s*slug:/).slice(1);
  const out = [];
  for (const b of blocks) {
    const slug = /"([^"]+)"/.exec(b)?.[1];
    const title = /title:\s*"([^"]+)"/.exec(b)?.[1];
    const videoId = /videoId:\s*"([^"]+)"/.exec(b)?.[1] || null;
    const body = /body:\s*`([\s\S]*?)`/.exec(b)?.[1]
      || /body:\s*"([\s\S]*?)"/.exec(b)?.[1]
      || '';
    // body might be template string spanning - try simpler length from body: field
    let bodyLen = 0;
    const bodyMatch = /body:\s*[`"']([\s\S]*?)[`"']\s*,/.exec(b);
    if (bodyMatch) bodyLen = bodyMatch[1].length;
    else {
      // multiline body with backticks
      const m2 = /body:\s*`([\s\S]*?)`/.exec(b);
      if (m2) bodyLen = m2[1].length;
    }
    out.push({ slug, title, videoId, bodyLen });
  }
  return out;
}

const bbc = extractVideoEntries('src/lib/entertain/bbc-catalog.ts');
const rsa = extractVideoEntries('src/lib/entertain/rsa-catalog.ts');
console.log('BBC entries', bbc.length, 'RSA entries', rsa.length);

async function audit(name, entries) {
  const bad = [];
  const good = [];
  for (const e of entries) {
    const r = await hasEnglishCaptions(e.videoId);
    const row = { ...e, ...r };
    if (r.ok) good.push(row); else bad.push(row);
    console.log(`${name}\t${r.ok?'OK':'BAD'}\t${e.videoId}\t${(e.title||'').slice(0,50)}\t${r.ok?`lang=${r.lang} chars=${r.chars}`:r.reason}`);
    await new Promise(r => setTimeout(r, 200)); // gentle rate limit
  }
  console.log(`\n=== ${name} SUMMARY ===`);
  console.log(`total=${entries.length} good=${good.length} bad=${bad.length} badPct=${((bad.length/entries.length)*100).toFixed(1)}%`);
  return { good, bad };
}

const bbcRes = await audit('BBC', bbc);
const rsaRes = await audit('RSA', rsa);

// NatGeo: articles without enough body OR video without captions when body thin
const natgeo = extractNatGeo('src/lib/entertain/natgeo-catalog.ts');
console.log('\nNatGeo entries', natgeo.length, 'withVideo', natgeo.filter(n=>n.videoId).length);
const thin = natgeo.filter(n => n.bodyLen < 400);
console.log('NatGeo thin body (<400):', thin.length);
for (const n of thin) console.log(' THIN', n.slug, 'body', n.bodyLen, 'video', n.videoId);

const ngVideoBad = [];
for (const n of natgeo.filter(x => x.videoId)) {
  const r = await hasEnglishCaptions(n.videoId);
  if (!r.ok) {
    ngVideoBad.push({ ...n, ...r });
    console.log(`NATGEO-VID\tBAD\t${n.videoId}\t${n.slug}\tbody=${n.bodyLen}\t${r.reason}`);
  } else {
    console.log(`NATGEO-VID\tOK\t${n.videoId}\t${n.slug}\tbody=${n.bodyLen}\tchars=${r.chars}`);
  }
  await new Promise(r => setTimeout(r, 200));
}
console.log(`\n=== NATGEO VIDEO SUMMARY ===`);
console.log(`withVideo=${natgeo.filter(n=>n.videoId).length} badVideo=${ngVideoBad.length}`);

fs.writeFileSync('/tmp/caption-audit.json', JSON.stringify({ bbc: bbcRes, rsa: rsaRes, natgeoVideoBad: ngVideoBad, natgeoThin: thin }, null, 2));
console.log('\nWrote /tmp/caption-audit.json');
