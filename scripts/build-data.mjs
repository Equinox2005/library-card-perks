// Rebuilds data/libraries.json: for each library in scripts/libraries.json,
// reads its public list of online resources and records which of the
// services in src/lib/resources.js it offers, with the library's own link.
//
//   npm run data
//
// Libraries publish these lists either as Springshare LibGuides A-Z pages,
// which have a JSON endpoint, or as ordinary web pages. The GitHub workflow
// runs this weekly and commits any change.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ARCHIVE, RESOURCES } from '../src/lib/resources.js';

const root = new URL('../', import.meta.url);
const UA = 'Mozilla/5.0 (compatible; library-card-perks-data/1.0; +https://github.com/Equinox2005/library-card-perks)';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’' };
const decode = (html) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_, e) =>
      e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e.toLowerCase()] ?? ' '),
    )
    .replace(/\s+/g, ' ')
    .trim();

// Every link on the page as [text, absolute url].
export function links(html, base) {
  const out = [];
  for (const [, attrs, inner] of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attrs.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2];
    const text = decode(inner);
    if (!href || !text || /^(#|javascript:|mailto:)/i.test(href)) continue;
    try {
      out.push([text, new URL(decode(href), base).href]);
    } catch {
      // Not a usable URL.
    }
  }
  return out;
}

// A link straight to a vendor's front page ("https://www.hoopladigital.com/")
// doesn't sign you in through the library; the library's own list explains
// how to get in, so that's the better place to send people.
const VENDOR_HOME = /^https?:\/\/(www\.)?(nytimes|wsj|washingtonpost|hoopladigital|pressreader|kanopy|ancestrylibrary\.proquest|consumerreports)\.(com|org)\/?$/i;

// For each service, the best link: a short name for the service itself
// beats a sentence that mentions it, and archive products don't count.
export function findResources(pageLinks, page) {
  const found = {};
  for (const [key, resource] of Object.entries(RESOURCES)) {
    const candidates = pageLinks.filter(([text]) => text.length <= 80 && resource.match.test(text) && !ARCHIVE.test(text) && !resource.skip?.test(text));
    if (!candidates.length) continue;
    const [text, url] = candidates.reduce((a, b) => (b[0].length < a[0].length ? b : a));
    found[key] = { label: text, url: VENDOR_HOME.test(url) && page ? page : url };
  }
  return found;
}

async function get(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/json' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res;
}

async function readList(list) {
  if (list.libguides) {
    const url = `https://${list.libguides}/process/az/dblist?site_id=${list.site}&is_widget=0`;
    const json = await (await get(url)).json();
    return { page: `https://${list.libguides}/az/databases`, links: links(json.data?.html ?? '', `https://${list.libguides}/`) };
  }
  const res = await get(list.html);
  return { page: res.url, links: links(await res.text(), res.url) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const libraries = JSON.parse(readFileSync(new URL('scripts/libraries.json', root), 'utf8'));
  const out = [];
  let failed = 0;
  for (const library of libraries) {
    const { lists, ...info } = library;
    const resources = {};
    let page = null;
    try {
      for (const list of lists) {
        const read = await readList(list);
        page ??= read.page;
        for (const [key, value] of Object.entries(findResources(read.links, read.page))) resources[key] ??= value;
      }
    } catch (error) {
      failed++;
      console.error(`${library.id}: ${error.message}`);
      continue;
    }
    out.push({ ...info, page, resources });
    console.log(`${library.id}: ${Object.keys(resources).join(' ')}`);
  }
  // A library whose page failed this time keeps last week's entry.
  if (failed) {
    const previous = JSON.parse(readFileSync(new URL('data/libraries.json', root), 'utf8'));
    for (const old of previous.libraries) if (!out.some((l) => l.id === old.id)) out.push(old);
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  const fetched = new Date().toISOString().slice(0, 10);
  writeFileSync(new URL('data/libraries.json', root), `${JSON.stringify({ fetched, libraries: out }, null, 1)}\n`);
  console.log(`${out.length} libraries${failed ? `, ${failed} kept from last time` : ''}`);
}
