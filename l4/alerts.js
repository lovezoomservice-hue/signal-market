/**
 * Signal Market - Alert System
 * 
 * 支持多种告警渠道
 */

const fs = require('fs');
const path = require('path');

// 告警渠道
const ALERT_CHANNELS = {
  // Telegram
  telegram: async (config, message) => {
    if (!config.botToken || !config.chatId) return;
    
    const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
    const body = JSON.stringify({
      chat_id: config.chatId,
      text: message,
      parse_mode: 'Markdown'
    });
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });
    
    return res.ok;
  },
  
  // Slack
  slack: async (config, message) => {
    if (!config.webhookUrl) return;
    
    await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message })
    });
  },
  
  // Console (开发用)
  console: async (config, message) => {
    console.log(`🔔 [ALERT] ${message}`);
  },
  
  // Email (需要配置 SMTP)
  email: async (config, message) => {
    // TODO: 实现邮件告警
    console.log(`📧 [EMAIL] ${message}`);
  }
};

// 告警规则
const ALERT_RULES = [
  {
    name: 'new_event',
    condition: (events, prevEvents) => {
      const prevIds = new Set(prevEvents.map(e => e.event_id));
      return events.filter(e => !prevIds.has(e.event_id));
    },
    message: (newEvents) => `🆕 *新事件发现*\n${newEvents.map(e => `• ${e.topic} (${e.stage})`).join('\n')}`
  },
  {
    name: 'stage_change',
    condition: (events, prevEvents) => {
      const prevMap = new Map(prevEvents.map(e => [e.topic, e.stage]));
      return events.filter(e => prevMap.get(e.topic) !== e.stage);
    },
    message: (changedEvents) => `🔄 *阶段变化*\n${changedEvents.map(e => `• ${e.topic}: ${e.stage}`).join('\n')}`
  },
  {
    name: 'high_probability',
    condition: (events) => events.filter(e => e.probability_pct > 0.7),
    message: (highProb) => `⚠️ *高概率事件*\n${highProb.map(e => `• ${e.topic}: ${Math.round(e.probability_pct * 100)}%`).join('\n')}`
  },
  {
    name: 'health_check',
    condition: (events, prevEvents, health) => health.status !== 'healthy',
    message: () => `🚨 *系统告警*\nStatus: ${health.status}`
  }
];

class AlertSystem {
  constructor(configPath = null) {
    this.config = this.loadConfig(configPath);
    this.prevEvents = [];
  }
  
  loadConfig(configPath) {
    const defaultConfig = {
      enabled: true,
      channels: ['console'],
      rules: ['new_event', 'stage_change', 'high_probability'],
      telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID
      },
      slack: {
        webhookUrl: process.env.SLACK_WEBHOOK_URL
      }
    };
    
    if (configPath && fs.existsSync(configPath)) {
      const custom = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return { ...defaultConfig, ...custom };
    }
    
    return defaultConfig;
  }
  
  async sendAlert(message) {
    if (!this.config.enabled) return;
    
    for (const channel of this.config.channels) {
      const handler = ALERT_CHANNELS[channel];
      if (handler) {
        try {
          await handler(this.config[channel] || {}, message);
        } catch(e) {
          console.error(`Alert failed (${channel}):`, e.message);
        }
      }
    }
  }
  
  async checkAndAlert(events, health) {
    for (const rule of ALERT_RULES) {
      if (!this.config.rules.includes(rule.name)) continue;
      
      try {
        const matches = rule.condition(events, this.prevEvents, health);
        if (matches && matches.length > 0) {
          const message = rule.message(matches);
          await this.sendAlert(message);
        }
      } catch(e) {
        console.error(`Rule ${rule.name} failed:`, e.message);
      }
    }
    
    this.prevEvents = events;
  }
  
  // 手动触发告警
  async notify(topic, message) {
    await this.sendAlert(`📢 *${topic}*\n${message}`);
  }
}

// 独立运行模式
if (require.main === module) {
  const args = process.argv.slice(2);
  const alertSystem = new AlertSystem();
  
  if (args[0] === 'test') {
    alertSystem.notify('Test Alert', 'This is a test message from Signal Market');
  } else if (args[0] === 'watch') {
    console.log('👀 Watching for alerts...');
    // 定期检查
    setInterval(async () => {
      // TODO: 集成到主pipeline
    }, 60000);
  }
}

module.exports = { AlertSystem, ALERT_RULES };
