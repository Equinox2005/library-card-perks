// The paid services that public libraries commonly give away, how a library
// names them in its list of online resources, and the sites where reminding
// you about them is useful.
//
// `skip` drops archive and microfilm products that share the name: a library
// with "New York Times Historical (1851-2021)" doesn't give you today's paper.
export const RESOURCES = {
  nyt: { name: 'The New York Times', match: /\b(new york times|nytimes(\.com)?)\b/i, skip: /cooking|games|athletic|crossword/i },
  wsj: { name: 'The Wall Street Journal', match: /\bwall street journal\b|\bwsj(\.com)?\b/i },
  wapo: { name: 'The Washington Post', match: /\bwashington post\b/i },
  cr: { name: 'Consumer Reports', match: /\bconsumer reports\b/i },
  linkedin: { name: 'LinkedIn Learning', match: /\blinkedin learning\b/i },
  udemy: { name: 'Udemy', match: /\budemy\b/i },
  coursera: { name: 'Coursera', match: /\bcoursera\b/i },
  kanopy: { name: 'Kanopy', match: /\bkanopy\b/i },
  hoopla: { name: 'hoopla', match: /\bhoopla\b/i, skip: /bingepass|magazine/i },
  mango: { name: 'Mango Languages', match: /\bmango\b/i },
  ancestry: { name: 'Ancestry Library Edition', match: /\bancestry\b/i, note: 'Usually only on library computers or library Wi-Fi.' },
  morningstar: { name: 'Morningstar Investment Research Center', match: /\bmorningstar\b/i },
  valueline: { name: 'Value Line', match: /\bvalue ?line\b/i },
  tutor: { name: 'Live homework help', match: /\btutor\.com\b|\bbrainfuse\b|\bhelpnow\b/i, skip: /\bjob/i },
  pressreader: { name: 'PressReader', match: /\bpressreader\b/i },
};

export const ARCHIVE = /historical|historic\b|microfilm|archive|backfile|\b1[89]\d\d\b|index\b|obituar|abstracts?\b/i;

// Which resources to mention on which site. A path, when given, has to match
// too: LinkedIn Learning, not the rest of LinkedIn.
export const SITES = [
  { host: /(^|\.)nytimes\.com$/, resources: ['nyt', 'pressreader'] },
  { host: /(^|\.)wsj\.com$/, resources: ['wsj', 'pressreader'] },
  { host: /(^|\.)washingtonpost\.com$/, resources: ['wapo', 'pressreader'] },
  { host: /(^|\.)consumerreports\.org$/, resources: ['cr'] },
  { host: /(^|\.)linkedin\.com$/, path: /^\/learning\b/, resources: ['linkedin'] },
  { host: /(^|\.)udemy\.com$/, resources: ['udemy', 'linkedin'] },
  { host: /(^|\.)coursera\.org$/, resources: ['coursera', 'linkedin', 'udemy'] },
  { host: /(^|\.)(rosettastone|babbel)\.com$/, resources: ['mango'] },
  { host: /(^|\.)ancestry\.com$/, resources: ['ancestry'] },
  { host: /(^|\.)morningstar\.com$/, resources: ['morningstar', 'valueline'] },
  { host: /(^|\.)valueline\.com$/, resources: ['valueline', 'morningstar'] },
  { host: /(^|\.)chegg\.com$/, resources: ['tutor'] },
  { host: /(^|\.)primevideo\.com$/, path: /\/detail\//, resources: ['kanopy', 'hoopla'] },
  { host: /^tv\.apple\.com$/, path: /\/movie\//, resources: ['kanopy', 'hoopla'] },
];

export function siteFor(hostname, pathname = '/') {
  return SITES.find((s) => s.host.test(hostname) && (!s.path || s.path.test(pathname))) ?? null;
}
