/**
 * Webhook Delivery System
 * 
 * 触发器监控和推送
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const CONFIG = {
  outputDir: '/home/nice005/.openclaw/workspace/signal-market/output',
  webhooksFile: '/home/nice005/.openclaw/workspace/signal-market/config/webhooks.json'
};

// 加载 webhook 配置
function loadWebhooks() {
  try {
    if (fs.existsSync(CONFIG.webhooksFile)) {
      return JSON.parse(fs.readFileSync(CONFIG.webhooksFile, 'utf8'));
    }
  } catch (e) {}
  return [];
}

// 保存 webhook 配置
function saveWebhooks(webhooks) {
  fs.mkdirSync(path.dirname(CONFIG.webhooksFile), { recursive: true });
  fs.writeFileSync(CONFIG.webhooksFile, JSON.stringify(webhooks, null, 2));
}

// 触发 webhook
async function triggerWebhook(webhook, payload) {
  console.log(`🔔 Triggering webhook: ${webhook.url}`);
  
  return new Promise((resolve) => {
    const data = JSON.stringify(payload);
    const url = new URL(webhook.url);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        console.log(`✅ Webhook triggered: ${res.statusCode}`);
        resolve({ success: true, statusCode: res.statusCode, body });
      });
    });
    
    req.on('error', (e) => {
      console.log(`❌ Webhook failed: ${e.message}`);
      resolve({ success: false, error: e.message });
    });
    
    req.write(data);
    req.end();
  });
}

// 检查触发条件
function checkTrigger(event, webhook) {
  if (webhook.topic && webhook.topic !== event.topic) {
    return false;
  }
  
  if (webhook.condition === 'stage_change') {
    return event.stage !== webhook.lastStage;
  }
  
  if (webhook.condition === 'probability_above' && webhook.threshold) {
    return event.probability >= webhook.threshold;
  }
  
  if (webhook.condition === 'probability_below' && webhook.threshold) {
    return event.probability <= webhook.threshold;
  }
  
  return false;
}

// 处理所有 webhooks
async function processWebhooks(events) {
  const webhooks = loadWebhooks();
  if (webhooks.length === 0) {
    console.log('📭 No webhooks configured');
    return;
  }
  
  console.log(`📋 Processing ${webhooks.length} webhooks...`);
  
  for (const webhook of webhooks) {
    for (const event of events) {
      if (checkTrigger(event, webhook)) {
        const payload = {
          webhook_id: webhook.id,
          event: {
            id: event.event_id,
            topic: event.topic,
            stage: event.stage,
            probability: event.probability
          },
          timestamp: new Date().toISOString()
        };
        
        await triggerWebhook(webhook, payload);
        
        // 更新 lastStage
        webhook.lastStage = event.stage;
      }
    }
  }
  
  saveWebhooks(webhooks);
}

// 创建 webhook
function createWebhook(config) {
  const webhooks = loadWebhooks();
  const webhook = {
    id: `wh_${Date.now()}`,
    url: config.url,
    topic: config.topic || null,
    condition: config.condition || 'stage_change',
    threshold: config.threshold || null,
    lastStage: null,
    created_at: new Date().toISOString()
  };
  
  webhooks.push(webhook);
  saveWebhooks(webhooks);
  
  return webhook;
}

module.exports = {
  loadWebhooks,
  saveWebhooks,
  createWebhook,
  processWebhooks,
  triggerWebhook
};

if (require.main === module) {
  // 测试 webhook
  const testWebhook = createWebhook({
    url: 'https://httpbin.org/post',
    topic: '商业航天',
    condition: 'stage_change'
  });
  
  console.log('Created webhook:', testWebhook.id);
}
