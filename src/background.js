import { allOffers, chosenLibrary, offersFor } from './lib/perks.js';

let ready;
const data = () => (ready ??= fetch(chrome.runtime.getURL('data/libraries.json')).then((r) => r.json()));

async function library() {
  const settings = await chrome.storage.sync.get(['library', 'custom']);
  return chosenLibrary(settings, await data());
}

// Pick a library first; nothing shows until there is one.
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install' && !(await library())) chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  (async () => {
    if (message.type === 'offers') {
      const lib = await library();
      const offers = offersFor(lib, message.hostname, message.pathname);
      const tabId = sender.tab?.id;
      if (tabId !== undefined) {
        await chrome.action.setBadgeBackgroundColor({ tabId, color: '#1a7f37' });
        await chrome.action.setBadgeText({ tabId, text: offers.length ? String(offers.length) : '' });
      }
      reply({ library: lib && { name: lib.name }, offers });
    } else if (message.type === 'library') {
      const lib = await library();
      const tab = message.url ? new URL(message.url) : null;
      reply({ library: lib, offers: allOffers(lib), here: tab ? offersFor(lib, tab.hostname, tab.pathname) : [] });
    } else if (message.type === 'libraries') {
      const { fetched, libraries } = await data();
      reply({ fetched, libraries: libraries.map(({ id, name, place, state, resources }) => ({ id, name, place, state, count: Object.keys(resources).length })) });
    } else {
      reply({});
    }
  })().catch((error) => reply({ error: String(error) }));
  return true;
});
