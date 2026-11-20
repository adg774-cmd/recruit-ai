const fs = require('node:fs');
const path = require('node:path');

const source = path.join(__dirname, 'index.html');
const outputDirectory = path.join(__dirname, 'dist');
const output = path.join(outputDirectory, 'home.html');
const rawConfig = process.env.VERCEL_OBSERVABILITY_CLIENT_CONFIG;

if (!rawConfig) {
  throw new Error('VERCEL_OBSERVABILITY_CLIENT_CONFIG is not available.');
}

const config = JSON.parse(rawConfig);
const scriptSrc = config.analytics?.scriptSrc;

if (!scriptSrc) {
  throw new Error('The Vercel Analytics script path is missing.');
}

const html = fs.readFileSync(source, 'utf8').replace(
  '/_vercel/insights/script.js',
  scriptSrc,
);

fs.rmSync(outputDirectory, { recursive: true, force: true });
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(output, html);
fs.copyFileSync(path.join(__dirname, 'admin.html'), path.join(outputDirectory, 'access-analytics.html'));
fs.copyFileSync(path.join(__dirname, 'inquiries.html'), path.join(outputDirectory, 'inquiries.html'));
fs.copyFileSync(path.join(__dirname, 'tracker.js'), path.join(outputDirectory, 'tracker.js'));
console.log(`Analytics script configured at ${scriptSrc}`);
