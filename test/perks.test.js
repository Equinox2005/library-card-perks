import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { allOffers, chosenLibrary, offersFor } from '../src/lib/perks.js';
import { ARCHIVE, RESOURCES, siteFor } from '../src/lib/resources.js';

const data = JSON.parse(readFileSync(new URL('../data/libraries.json', import.meta.url), 'utf8'));

const sample = {
  id: 'x',
  name: 'Example Library',
  resources: {
    nyt: { label: 'New York Times Digital', url: 'https://lib.example/nyt' },
    pressreader: { label: 'PressReader', url: 'https://lib.example/pr' },
    linkedin: { label: 'LinkedIn Learning', url: 'https://lib.example/li' },
    kanopy: { label: 'Kanopy', url: 'https://lib.example/kanopy' },
    ancestry: { label: 'Ancestry Library Edition', url: 'https://lib.example/anc' },
  },
};

test('the shipped data: every library has a page and https links, and no archives', () => {
  assert.ok(data.libraries.length >= 10);
  const ids = new Set();
  for (const library of data.libraries) {
    assert.ok(!ids.has(library.id), library.id);
    ids.add(library.id);
    assert.ok(library.name && library.state && library.page, library.id);
    assert.ok(Object.keys(library.resources).length >= 3, `${library.id} has few resources`);
    for (const [key, value] of Object.entries(library.resources)) {
      assert.ok(RESOURCES[key], `${library.id}: unknown ${key}`);
      assert.match(value.url, /^https?:\/\//, `${library.id} ${key}`);
      assert.ok(!ARCHIVE.test(value.label), `${library.id} ${key}: ${value.label}`);
    }
  }
});

test('Carnegie Library of Pittsburgh has the NYT and Consumer Reports', () => {
  const clp = data.libraries.find((l) => l.id === 'clp');
  assert.ok(clp.resources.nyt && clp.resources.cr, JSON.stringify(Object.keys(clp.resources)));
});

test('sites map to the right services, with paths where it matters', () => {
  assert.deepEqual(siteFor('www.nytimes.com', '/2026/11/04/us/story.html').resources, ['nyt', 'pressreader']);
  assert.ok(siteFor('www.linkedin.com', '/learning/excel-essential-training'));
  assert.equal(siteFor('www.linkedin.com', '/feed/'), null);
  assert.ok(siteFor('www.primevideo.com', '/detail/0ABC/'));
  assert.equal(siteFor('www.primevideo.com', '/storefront/'), null);
  assert.equal(siteFor('www.example.com', '/'), null);
});

test('offers are only what the library has, for the site you are on', () => {
  assert.deepEqual(offersFor(sample, 'www.nytimes.com', '/').map((o) => o.label), ['New York Times Digital', 'PressReader']);
  assert.deepEqual(offersFor(sample, 'www.wsj.com', '/').map((o) => o.key), ['pressreader']);
  assert.deepEqual(offersFor(sample, 'www.consumerreports.org', '/'), []);
  assert.deepEqual(offersFor(null, 'www.nytimes.com', '/'), []);
  assert.equal(offersFor(sample, 'www.ancestry.com', '/').at(0).note, 'Usually only on library computers or library Wi-Fi.');
});

test('all offers follow the order of the services list', () => {
  assert.deepEqual(allOffers(sample).map((o) => o.key), ['nyt', 'linkedin', 'kanopy', 'ancestry', 'pressreader']);
});

test('a library typed in by hand keeps only real links', () => {
  const custom = chosenLibrary({ library: 'custom', custom: { name: 'Mt. Lebanon Public Library', links: { nyt: 'https://mtl.example/nyt', wsj: 'not a link', bogus: 'https://x' } } }, data);
  assert.equal(custom.name, 'Mt. Lebanon Public Library');
  assert.deepEqual(Object.keys(custom.resources), ['nyt']);
  assert.equal(chosenLibrary({ library: 'clp' }, data).name, 'Carnegie Library of Pittsburgh');
  assert.equal(chosenLibrary({}, data), null);
});
