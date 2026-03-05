const https = require('https');

function fetchHackerNews() {
  return new Promise((resolve) => {
    https.get('https://hacker-news.firebaseio.com/v0/topstories.json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const ids = JSON.parse(data).slice(0, 10);
          let stories = 0;
          let completed = 0;
          const titles = [];
          if (ids.length === 0) resolve({ source: 'HackerNews', data: [] });
          ids.forEach(id => {
            https.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, (r) => {
              let d = '';
              r.on('data', c => d += c);
              r.on('end', () => {
                try {
                  const item = JSON.parse(d);
                  if (item && item.title) titles.push({ title: item.title, url: item.url, score: item.score });
                } catch(e) {}
                completed++;
                if (completed === ids.length) {
                  resolve({ source: 'HackerNews', data: titles });
                }
              });
            }).on('error', () => { completed++; if (completed === ids.length) resolve({ source: 'HackerNews', data: [] }); });
          });
        } catch(e) { resolve({ source: 'HackerNews', error: e.message }); }
      });
    }).on('error', e => resolve({ source: 'HackerNews', error: e.message }));
  });
}

function fetchReddit() {
  return new Promise((resolve) => {
    const req = https.get('https://www.reddit.com/r/worldnews.json', {
      headers: { 'User-Agent': 'SignalMarket/1.0' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const posts = json.data.children.slice(0, 10).map(c => ({
            title: c.data.title,
            score: c.data.score,
            url: 'https://reddit.com' + c.data.permalink
          }));
          resolve({ source: 'Reddit', data: posts });
        } catch(e) { resolve({ source: 'Reddit', error: e.message }); }
      });
    });
    req.on('error', e => resolve({ source: 'Reddit', error: e.message }));
  });
}

module.exports = { fetchHackerNews, fetchReddit };
