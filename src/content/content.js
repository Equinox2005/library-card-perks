// On a site where your library gives something away (a news paywall, a
// course site, a movie rental page), shows a small card in the corner once a
// day with the library's own link. Nothing shows until you've picked a
// library, and it can be turned off per site.
(() => {
  const HOST_ID = 'library-card-perks';
  const site = location.hostname.replace(/^www\./, '');
  let lastPath = null;

  const STYLE = `
    :host { all: initial; position: fixed; right: 16px; bottom: 16px; z-index: 2147483646; }
    .card { box-sizing: border-box; width: 310px; font: 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      color: #1f2328; background: #fff; border: 1px solid #d0d7de; border-radius: 8px; box-shadow: 0 6px 18px rgba(31, 35, 40, .15);
      padding: 10px 12px 10px; }
    .top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .label { font-size: 11px; color: #59636e; letter-spacing: .02em; }
    .close { all: unset; cursor: pointer; color: #59636e; font-size: 16px; line-height: 1; padding: 0 2px; }
    .close:focus-visible, .mute:focus-visible, a:focus-visible { outline: 2px solid #0969da; outline-offset: 1px; border-radius: 3px; }
    p { margin: 4px 0 6px; }
    ul { list-style: none; margin: 0 0 8px; padding: 0; }
    li { padding: 5px 0; border-top: 1px solid #eaeef2; display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
    li:last-child { border-bottom: 1px solid #eaeef2; }
    .name { font-weight: 600; }
    .note { display: block; color: #59636e; font-size: 12px; font-weight: normal; }
    a { color: #0969da; white-space: nowrap; }
    .mute { all: unset; cursor: pointer; color: #59636e; font-size: 12px; text-decoration: underline; }
  `;

  function render(library, offers) {
    document.getElementById(HOST_ID)?.remove();
    const host = document.createElement('div');
    host.id = HOST_ID;
    const root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLE;
    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('role', 'complementary');
    card.setAttribute('aria-label', 'Library Card Perks');

    const top = document.createElement('div');
    top.className = 'top';
    const close = Object.assign(document.createElement('button'), { className: 'close', textContent: '×', title: 'Close for today' });
    close.setAttribute('aria-label', 'Close for today');
    top.append(Object.assign(document.createElement('span'), { className: 'label', textContent: 'Library Card Perks' }), close);

    const intro = Object.assign(document.createElement('p'), { textContent: `Free with your ${library.name} card:` });
    const list = document.createElement('ul');
    for (const offer of offers) {
      const li = document.createElement('li');
      const name = Object.assign(document.createElement('span'), { className: 'name', textContent: offer.label });
      if (offer.note) name.append(Object.assign(document.createElement('span'), { className: 'note', textContent: offer.note }));
      li.append(name, Object.assign(document.createElement('a'), { href: offer.url, textContent: 'Open', target: '_blank', rel: 'noopener noreferrer' }));
      list.append(li);
    }
    const mute = Object.assign(document.createElement('button'), { className: 'mute', textContent: `Don't show on ${site}` });

    close.addEventListener('click', () => host.remove());
    mute.addEventListener('click', async () => {
      const { hiddenSites = [] } = await chrome.storage.sync.get('hiddenSites');
      await chrome.storage.sync.set({ hiddenSites: [...new Set([...hiddenSites, site])] });
      host.remove();
    });

    card.append(top, intro, list, mute);
    root.append(style, card);
    document.documentElement.append(host);
  }

  async function check() {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    try {
      const { library, offers = [] } = await chrome.runtime.sendMessage({ type: 'offers', hostname: location.hostname, pathname: location.pathname });
      if (!library || !offers.length) return document.getElementById(HOST_ID)?.remove();
      const { hiddenSites = [] } = await chrome.storage.sync.get('hiddenSites');
      if (hiddenSites.includes(site)) return;
      // Once a day per site; the toolbar badge and the popup have it the rest of the time.
      const day = new Date().toISOString().slice(0, 10);
      const { shown = {} } = await chrome.storage.local.get('shown');
      if (shown[site] === day) return;
      await chrome.storage.local.set({ shown: { ...shown, [site]: day } });
      render(library, offers);
    } catch {
      // The extension was reloaded or updated; this page's copy of the script is orphaned.
    }
  }

  // Course and video sites change pages without reloading.
  let timer;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(check, 500);
  }).observe(document.documentElement, { childList: true, subtree: true });
  check();
})();
