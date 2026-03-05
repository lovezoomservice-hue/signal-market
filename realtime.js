/**
 * Real-time Data Refresh
 * 
 * 定时刷新数据，保持实时性
 */

const { runPipeline } = require('./run_pipeline');
const { processWebhooks } = require('./l4/webhook');

// 读取最新事件
function getLatestEvents() {
  const fs = require('fs');
  const path = require('path');
  
  const eventsDir = '/home/nice005/.openclaw/workspace/signal-market/output/events';
  const dates = fs.readdirSync(eventsDir).sort();
  const latestDate = dates[dates.length - 1];
  
  const registryPath = path.join(eventsDir, latestDate, 'event_registry.json');
  if (!fs.existsSync(registryPath)) return [];
  
  return JSON.parse(fs.readFileSync(registryPath, 'utf8')).events || [];
}

// 主循环
async function startRealTime() {
  console.log('⏰ Signal Market Real-time Mode');
  console.log('🔄 Updating every 5 minutes...\n');
  
  // 立即运行一次
  console.log('🚀 Initial run...');
  await runPipeline();
  
  // 处理 webhooks
  const events = getLatestEvents();
  if (events.length > 0) {
    await processWebhooks(events);
  }
  
  // 每5分钟运行一次
  setInterval(async () => {
    console.log('🔄 Running pipeline...');
    await runPipeline();
    
    const events = getLatestEvents();
    if (events.length > 0) {
      await processWebhooks(events);
    }
  }, 5 * 60 * 1000);
}

if (require.main === module) {
  startRealTime();
}

module.exports = { startRealTime };
