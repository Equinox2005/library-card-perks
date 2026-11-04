const $ = (id) => document.getElementById(id);

function rows(list, offers) {
  list.replaceChildren(
    ...offers.map((offer) => {
      const li = document.createElement('li');
      const name = Object.assign(document.createElement('span'), { textContent: offer.label });
      if (offer.note) name.append(Object.assign(document.createElement('span'), { className: 'note', textContent: offer.note }));
      li.append(name, Object.assign(document.createElement('a'), { href: offer.url, textContent: 'Open', target: '_blank', rel: 'noopener noreferrer' }));
      return li;
    }),
  );
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = /^https?:/.test(tab?.url ?? '') ? tab.url : null;
  const { library, offers, here } = await chrome.runtime.sendMessage({ type: 'library', url });
  $('none').hidden = Boolean(library);
  $('mine').hidden = !library;
  $('change').hidden = !library;
  if (!library) return;

  $('libname').textContent = library.name;
  rows($('all'), offers);
  $('nothing').hidden = offers.length > 0;

  $('here-box').hidden = !here.length;
  if (here.length) {
    rows($('here'), here);
    const site = new URL(url).hostname.replace(/^www\./, '');
    $('mute-label').textContent = `Don't show the card on ${site}`;
    const { hiddenSites = [] } = await chrome.storage.sync.get('hiddenSites');
    $('mute').checked = hiddenSites.includes(site);
    $('mute').addEventListener('change', async (e) => {
      const { hiddenSites: current = [] } = await chrome.storage.sync.get('hiddenSites');
      const next = e.target.checked ? [...new Set([...current, site])] : current.filter((s) => s !== site);
      await chrome.storage.sync.set({ hiddenSites: next });
    });
  }
}

init();
