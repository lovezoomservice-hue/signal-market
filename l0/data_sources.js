/**
 * L0: Data Sources
 * Real-time data ingestion from external sources
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  dataDir: '/home/nice005/.openclaw/workspace/signal-market/output/raw',
  refreshInterval: {
    github: 10 * 60 * 1000,    // 10 min
    hackernews: 5 * 60 * 1000,  // 5 min
    arxiv: 30 * 60 * 1000       // 30 min
  }
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getDatePath() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
}

// GitHub Trending
async function fetchGitHubTrending() {
  return new Promise((resolve, reject) => {
    const url = 'https://api.github.com/search/repositories?q=created:>2024-01-01&sort=stars&order=desc&per_page=20';
    
    const options = {
      headers: {
        'User-Agent': 'Signal-Market/1.0',
        'Accept': 'application/vnd.github.v3+json'
      }
    };
    
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const repos = json.items || [];
          const formatted = repos.map(repo => ({
            source: 'github',
            type: 'repository',
            topic: repo.name,
            title: repo.full_name,
            description: repo.description,
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            language: repo.language,
            url: repo.html_url,
            created_at: repo.created_at,
            updated_at: repo.updated_at,
            timestamp: new Date().toISOString()
          }));
          resolve(formatted);
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', reject);
  });
}

// Hacker News
async function fetchHackerNews() {
  return new Promise((resolve, reject) => {
    https.get('https://hacker-news.firebaseio.com/v0/topstories.json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', async () => {
        try {
          const ids = JSON.parse(data).slice(0, 20);
          const promises = ids.map(id => 
            new Promise((r) => {
              https.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, (res2) => {
                let d2 = '';
                res2.on('data', c => d2 += c);
                res2.on('end', () => {
                  try {
                    const item = JSON.parse(d2);
                    r({
                      source: 'hackernews',
                      type: 'story',
                      topic: item.title?.substring(0, 50),
                      title: item.title,
                      url: item.url,
                      score: item.score,
                      comments: item.descendants,
                      timestamp: new Date().toISOString()
                    });
                  } catch { r(null); }
                });
              }).on('error', () => r(null));
            })
          );
          const results = await Promise.all(promises);
          resolve(results.filter(Boolean));
        } catch { resolve([]); }
      });
    }).on('error', reject);
  });
}

// arXiv Papers
async function fetchArxivPapers() {
  return new Promise((resolve) => {
    const url = 'https://export.arxiv.org/api/query?search_query=cat:cs.AI&sortBy=submittedDate&sortOrder=descending&max_results=10';
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Simple XML parsing
        const entries = [];
        const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
        let match;
        while ((match = entryRegex.exec(data)) !== null) {
          const entry = match[1];
          const getField = (tag) => {
            const m = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
            return m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
          };
          
          entries.push({
            source: 'arxiv',
            type: 'paper',
            topic: getField('title').substring(0, 50),
            title: getField('title'),
            abstract: getField('summary'),
            authors: entry.match(/<author>[\s\S]*?<name>([^<]+)<\/name>/g)?.map(m => m.replace(/<[^>]+>/g, '')) || [],
            categories: entry.match(/<category[^>]*term="([^"]+)"/g)?.map(m => m.match(/term="([^"]+)"/)[1]) || [],
            published: getField('published'),
            timestamp: new Date().toISOString()
          });
        }
        resolve(entries);
      });
    }).on('error', () => resolve([]));
  });
}

// Save to file
async function saveData(type, data) {
  ensureDir(CONFIG.dataDir);
  const datePath = getDatePath();
  const file = path.join(CONFIG.dataPath, `${type}_${datePath}.json`);
  ensureDir(path.dirname(file));
  
  fs.writeFileSync(file, JSON.stringify({
    type,
    timestamp: new Date().toISOString(),
    count: data.length,
    data
  }, null, 2));
}

module.exports = {
  fetchGitHubTrending,
  fetchHackerNews,
  fetchArxivPapers,
  getDatePath
};
