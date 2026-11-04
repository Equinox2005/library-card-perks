import { RESOURCES } from '../lib/resources.js';

const $ = (id) => document.getElementById(id);
const CUSTOM_FIELDS = ['nyt', 'wsj', 'wapo', 'cr', 'linkedin', 'udemy', 'kanopy', 'hoopla', 'mango', 'morningstar', 'tutor', 'pressreader'];

const say = (text) => {
  $('status').textContent = text;
};

async function init() {
  const { fetched, libraries } = await chrome.runtime.sendMessage({ type: 'libraries' });
  const settings = await chrome.storage.sync.get(['library', 'custom']);
  if (fetched) $('fetched').textContent = `${libraries.length} libraries, checked against their websites on ${fetched}.`;

  const draw = () => {
    const words = $('filter').value.toLowerCase().split(/\s+/).filter(Boolean);
    const shown = libraries.filter((l) => words.every((w) => `${l.name} ${l.place} ${l.state}`.toLowerCase().includes(w)));
    $('list').replaceChildren(
      ...shown.map((l) => {
        const li = document.createElement('li');
        const label = document.createElement('label');
        const radio = Object.assign(document.createElement('input'), { type: 'radio', name: 'library', value: l.id, checked: settings.library === l.id });
        radio.addEventListener('change', async () => {
          settings.library = l.id;
          await chrome.storage.sync.set({ library: l.id });
          say(`Saved: ${l.name}.`);
        });
        label.append(
          radio,
          Object.assign(document.createElement('span'), { textContent: l.name }),
          Object.assign(document.createElement('span'), { className: 'where', textContent: `${l.place}, ${l.state}` }),
          Object.assign(document.createElement('span'), { className: 'count', textContent: `${l.count} services` }),
        );
        li.append(label);
        return li;
      }),
    );
  };
  $('filter').addEventListener('input', draw);
  draw();

  // A library that isn't in the list, typed in by hand.
  for (const key of CUSTOM_FIELDS) {
    const id = `custom-${key}`;
    $('fields').append(
      Object.assign(document.createElement('label'), { htmlFor: id, textContent: RESOURCES[key].name }),
      Object.assign(document.createElement('input'), { id, type: 'url', placeholder: 'https://', value: settings.custom?.links?.[key] ?? '' }),
    );
  }
  $('custom-name').value = settings.custom?.name ?? '';
  if (settings.library === 'custom') $('custom-box').open = true;
  $('custom').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('custom-name').value.trim();
    if (!name) return say('Enter the library name first.');
    const links = {};
    for (const key of CUSTOM_FIELDS) {
      const value = $(`custom-${key}`).value.trim();
      if (/^https?:\/\//i.test(value)) links[key] = value;
    }
    settings.library = 'custom';
    await chrome.storage.sync.set({ library: 'custom', custom: { name, links } });
    draw();
    say(`Saved: ${name}, ${Object.keys(links).length} services.`);
  });
}

init();
