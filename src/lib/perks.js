import { RESOURCES, siteFor } from './resources.js';

// The library the person picked, or the one they typed in themselves.
export function chosenLibrary(settings, data) {
  if (settings?.library === 'custom' && settings.custom?.name) {
    const resources = {};
    for (const [key, url] of Object.entries(settings.custom.links ?? {})) {
      if (RESOURCES[key] && /^https?:\/\//i.test(url ?? '')) resources[key] = { label: RESOURCES[key].name, url };
    }
    return { id: 'custom', name: settings.custom.name, place: '', state: '', page: null, resources };
  }
  return data.libraries.find((l) => l.id === settings?.library) ?? null;
}

const offer = (library, key) => ({
  key,
  name: RESOURCES[key].name,
  label: library.resources[key].label,
  url: library.resources[key].url,
  note: RESOURCES[key].note ?? null,
});

// What the library gives away that's relevant to the site you're on.
export function offersFor(library, hostname, pathname) {
  const site = siteFor(hostname, pathname);
  if (!library || !site) return [];
  return site.resources.filter((key) => library.resources[key]).map((key) => offer(library, key));
}

// Everything the library gives away, in the order of RESOURCES.
export const allOffers = (library) => (library ? Object.keys(RESOURCES).filter((key) => library.resources[key]).map((key) => offer(library, key)) : []);

export const today = (now = new Date()) => now.toISOString().slice(0, 10);
