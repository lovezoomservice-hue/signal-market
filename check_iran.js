const fs = require('fs');
const files = fs.readdirSync('./output/raw/news/');
const latest = files.sort().pop();
const data = fs.readFileSync('./output/raw/news/' + latest, 'utf8');
const lines = data.split('\n');
console.log('=== Iran/Israel News ===');
let found = 0;
for (const line of lines) {
  if (!line) continue;
  try {
    const d = JSON.parse(line);
    if (d.data) {
      for (const item of d.data) {
        const title = item.title || '';
        const t = title.toLowerCase();
        if (t.includes('iran') || t.includes('israel') || t.includes('gaza') || t.includes('middle east')) {
          console.log('📰', title.substring(0, 100));
          found++;
        }
      }
    }
  } catch(e) {}
}
if (found === 0) console.log('No Iran/Israel news found in current data');
