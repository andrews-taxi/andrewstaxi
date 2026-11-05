import fs from 'fs';
import path from 'path';

const DIST_DIR = path.join(process.cwd(), 'dist');
const BLOG_DIR = path.join(process.cwd(), 'blog');
const SITE_URL = 'https://www.andrewstaxi.com';

function main() {
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.log('No dist/index.html found, skipping prerender.');
    return;
  }
  const indexHtml = fs.readFileSync(indexPath, 'utf8');

  if (!fs.existsSync(BLOG_DIR)) {
    console.log('No blog folder found, skipping prerender.');
    return;
  }

  const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));

  for (const file of files) {
    const slug = file.replace('.md', '');
    const content = fs.readFileSync(path.join(BLOG_DIR, file), 'utf8');

    let title = 'Andrew\'s Taxi Blog';
    let excerpt = '';
    let image = '/andrew-vehicle.jpeg';
    let keywords = '';

    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (match) {
      const tLine = match[1].match(/^title:\s*(.+)$/m);
      if (tLine) title = tLine[1].trim().replace(/^["']|["']$/g, '');
      const eLine = match[1].match(/^excerpt:\s*(.+)$/m);
      if (eLine) excerpt = eLine[1].trim().replace(/^["']|["']$/g, '');
      const iLine = match[1].match(/^image:\s*(.+)$/m);
      if (iLine) image = iLine[1].trim().replace(/^["']|["']$/g, '');
      const kLine = match[1].match(/^keywords:\s*(.+)$/m);
      if (kLine) keywords = kLine[1].trim().replace(/^["']|["']$/g, '');
    }

    const fullImageUrl = image.startsWith('http') ? image : `${SITE_URL}${image}`;

    let newHtml = indexHtml;
    // Replace title
    newHtml = newHtml.replace(/<title>(.*?)<\/title>/, `<title>${title} | Andrew's Taxi</title>`);
    newHtml = newHtml.replace(/<meta name="description" content="([^"]*)"\s*\/?>/, `<meta name="description" content="${excerpt}" />`);
    if (keywords) {
      newHtml = newHtml.replace(/<meta name="keywords" content="([^"]*)"\s*\/?>/, `<meta name="keywords" content="${keywords}" />`);
    }


    // Replace OG tags
    newHtml = newHtml.replace(/<meta property="og:title" content="([^"]*)"\s*\/?>/, `<meta property="og:title" content="${title} | Andrew's Taxi" />`);
    newHtml = newHtml.replace(/<meta property="og:description" content="([^"]*)"\s*\/?>/, `<meta property="og:description" content="${excerpt}" />`);
    newHtml = newHtml.replace(/<meta property="og:image" content="([^"]*)"\s*\/?>/, `<meta property="og:image" content="${fullImageUrl}" />`);
    newHtml = newHtml.replace(/<meta property="og:url" content="([^"]*)"\s*\/?>/, `<meta property="og:url" content="${SITE_URL}/blog/${slug}" />`);

    // Replace Twitter tags
    newHtml = newHtml.replace(/<meta name="twitter:title" content="([^"]*)"\s*\/?>/, `<meta name="twitter:title" content="${title} | Andrew's Taxi" />`);
    newHtml = newHtml.replace(/<meta name="twitter:description" content="([^"]*)"\s*\/?>/, `<meta name="twitter:description" content="${excerpt}" />`);
    newHtml = newHtml.replace(/<meta name="twitter:image" content="([^"]*)"\s*\/?>/, `<meta name="twitter:image" content="${fullImageUrl}" />`);
    newHtml = newHtml.replace(/<meta name="twitter:url" content="([^"]*)"\s*\/?>/, `<meta name="twitter:url" content="${SITE_URL}/blog/${slug}" />`);

    const destDir = path.join(DIST_DIR, 'blog', slug);
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(path.join(destDir, 'index.html'), newHtml);
    console.log(`Prerendered SEO for /blog/${slug}`);
  }
}

main();
