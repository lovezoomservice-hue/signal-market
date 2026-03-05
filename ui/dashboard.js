/**
 * Signal Market - Dashboard Server
 * 
 * 实时仪表板
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const API_PORT = 3000;
const DASHBOARD_PORT = 3001;

// 读取最新数据
function getLatestData() {
  const baseDir = '/home/nice005/.openclaw/workspace/signal-market/output';
  
  // 读取事件
  const eventsDir = path.join(baseDir, 'events');
  let events = [];
  try {
    const dates = fs.readdirSync(eventsDir).sort();
    if (dates.length > 0) {
      const latest = dates[dates.length - 1];
      const registry = JSON.parse(fs.readFileSync(path.join(eventsDir, latest, 'event_registry.json'), 'utf8'));
      events = registry.events || [];
    }
  } catch (e) {}
  
  // 读取预测
  let predictions = [];
  try {
    predictions = require('./l3/prediction_market').getAllPredictions();
  } catch (e) {}
  
  return { events, predictions, timestamp: new Date().toISOString() };
}

// Dashboard HTML
const dashboardHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Signal Market Dashboard</title>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Inter', -apple-system, sans-serif; 
      background: #0a0a0f; 
      color: #f8fafc; 
      padding: 24px;
    }
    h1 { font-size: 24px; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 24px; }
    .card { 
      background: #1a1a24; 
      border: 1px solid #2e2e3a; 
      border-radius: 12px; 
      padding: 20px;
    }
    .card h2 { font-size: 16px; color: #94a3b8; margin-bottom: 16px; }
    .item { 
      display: flex; 
      justify-content: space-between; 
      padding: 12px 0;
      border-bottom: 1px solid #2e2e3a;
    }
    .item:last-child { border-bottom: none; }
    .label { color: #94a3b8; }
    .value { font-weight: 600; }
    .up { color: #22c55e; }
    .down { color: #ef4444; }
    .time { color: #64748b; font-size: 12px; margin-top: 16px; }
  </style>
</head>
<body>
  <h1>📊 Signal Market Dashboard</h1>
  <div class="grid">
    <div class="card">
      <h2>📈 事件阶段</h2>
      <div id="events"></div>
    </div>
    <div class="card">
      <h2>🎯 预测市场</h2>
      <div id="predictions"></div>
    </div>
  </div>
  <div class="time" id="time"></div>
  <script>
    async function load() {
      const res = await fetch('/api/data');
      const data = await res.json();
      
      // Events
      const eventsDiv = document.getElementById('events');
      eventsDiv.innerHTML = data.events.map(e => \`
        <div class="item">
          <span class="label">\${e.topic}</span>
          <span class="value">\${e.stage}</span>
        </div>
      \`).join('');
      
      // Predictions
      const predDiv = document.getElementById('predictions');
      predDiv.innerHTML = data.predictions.map(p => \`
        <div class="item">
          <span class="label">\${p.topic}</span>
          <span class="value">\${p.probability_pct}</span>
        </div>
      \`).join('');
      
      document.getElementById('time').textContent = 'Updated: ' + data.timestamp;
    }
    load();
    setInterval(load, 30000);
  </script>
</body>
</html>
`;

// 简单静态服务器
function startDashboard() {
  const server = http.createServer((req, res) => {
    if (req.url === '/api/data') {
      const data = getLatestData();
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.end(dashboardHTML);
    }
  });
  
  server.listen(DASHBOARD_PORT, () => {
    console.log(`📊 Dashboard: http://localhost:\${DASHBOARD_PORT}`);
  });
}

if (require.main === module) {
  startDashboard();
}

module.exports = { startDashboard, getLatestData };
