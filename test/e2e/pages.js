// Stand-in pages for the sites the extension watches. Only the URL matters
// to the content script; the text is there to make the screenshots readable.
const shell = (title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<style>
  body { font: 17px/1.6 Georgia, serif; color: #222; margin: 0; background: #fff; }
  header { border-bottom: 1px solid #ddd; padding: 14px 32px; font: 600 22px Georgia, serif; text-align: center; }
  main { max-width: 640px; margin: 0 auto; padding: 24px 32px 120px; }
  h1 { font: 700 30px/1.25 Georgia, serif; margin: 0 0 12px; }
  .wall { margin-top: 28px; padding: 22px; border: 1px solid #ddd; background: #f7f7f5; font: 15px/1.5 system-ui, sans-serif; text-align: center; }
</style></head>
<body>${body}</body></html>`;

export const PAGES = {
  'www.nytimes.com/2026/11/04/business/electricity-prices.html': shell(
    'Electricity prices',
    `<header>The Daily Paper</header>
     <main><h1>Why Your Electricity Bill Keeps Going Up</h1>
       <p>Residential electricity prices have climbed in most states this year, and the reasons vary from region to region.</p>
       <div class="wall">You have reached your limit of free articles. Subscribe to continue reading.</div></main>`,
  ),
  'www.linkedin.com/learning/excel-essential-training': shell(
    'Excel Essential Training',
    `<header>Learning</header><main><h1>Excel Essential Training</h1><p>Start your free month to watch this course.</p></main>`,
  ),
  'www.consumerreports.org/appliances/refrigerators/best-refrigerators': shell(
    'Best refrigerators',
    `<header>Ratings</header><main><h1>Best Refrigerators of 2026</h1><div class="wall">Become a member to see ratings.</div></main>`,
  ),
};
