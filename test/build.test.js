import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findResources, links } from '../scripts/build-data.mjs';

const page = 'https://library.example.org/databases';

test('links are read with their text and made absolute', () => {
  const html = `<ul>
    <li><a href="/go/nyt" class="db">New York <b>Times</b></a></li>
    <li><a href='https://proxy.example.org/login?url=https://www.wsj.com'>Wall Street Journal &amp; Barron&#39;s</a></li>
    <li><a href="#top">Back to top</a></li>
    <li><a href="mailto:ask@example.org">Ask us</a></li>
  </ul>`;
  assert.deepEqual(links(html, page), [
    ['New York Times', 'https://library.example.org/go/nyt'],
    ["Wall Street Journal & Barron's", 'https://proxy.example.org/login?url=https://www.wsj.com'],
  ]);
});

test('archives and microfilm are not today’s paper', () => {
  const found = findResources(
    [
      ['New York Times Historical (1851-2021)', 'https://a.example/hist'],
      ['New York Times Digital Microfilm', 'https://a.example/micro'],
      ['Wall Street Journal Digital Microfilm', 'https://a.example/wsj-micro'],
    ],
    page,
  );
  assert.deepEqual(found, {});
});

test('the shortest matching name wins over a sentence that mentions it', () => {
  const found = findResources(
    [
      ['Read the New York Times and more with your library card today', 'https://a.example/blog'],
      ['New York Times', 'https://a.example/nyt'],
      ['New York Times Cooking', 'https://a.example/cooking'],
    ],
    page,
  );
  assert.deepEqual(found.nyt, { label: 'New York Times', url: 'https://a.example/nyt' });
});

test('job help is not homework help, and a magazine pass is not hoopla', () => {
  const found = findResources(
    [
      ['Brainfuse JobNow', 'https://a.example/jobnow'],
      ['Brainfuse HelpNow', 'https://a.example/helpnow'],
      ['Hoopla Magazines BingePass', 'https://a.example/binge'],
    ],
    page,
  );
  assert.equal(found.tutor.url, 'https://a.example/helpnow');
  assert.equal(found.hoopla, undefined);
});

test('a bare vendor home page is swapped for the library’s own list', () => {
  const found = findResources(
    [
      ['hoopla', 'https://www.hoopladigital.com/'],
      ['PressReader', 'https://proxy.example.org/login?url=https://www.pressreader.com'],
    ],
    page,
  );
  assert.equal(found.hoopla.url, page);
  assert.equal(found.pressreader.url, 'https://proxy.example.org/login?url=https://www.pressreader.com');
});
