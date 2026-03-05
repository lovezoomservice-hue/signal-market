/**
 * Performance Monitoring
 * 
 * 性能监控、错误追踪和指标收集
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG = {
  metricsDir: '/home/nice005/.openclaw/workspace/signal-market/output/metrics',
  errorsDir: '/home/nice005/.openclaw/workspace/signal-market/output/errors'
};

function getTimestamp() {
  return new Date().toISOString();
}

// 记录指标
function recordMetric(name, value, tags = {}) {
  const timestamp = getTimestamp();
  const metric = {
    name,
    value,
    tags,
    timestamp
  };
  
  const dir = CONFIG.metricsDir;
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name + '.jsonl');
  fs.appendFileSync(file, JSON.stringify(metric) + '\n');
  
  return metric;
}

// 记录延迟
function recordLatency(endpoint, ms) {
  return recordMetric('latency', ms, { endpoint });
}

// 记录请求
function recordRequest(endpoint, status, method = 'GET') {
  return recordMetric('request', 1, { endpoint, status: status.toString(), method });
}

// ========== 错误追踪功能 ==========

// 记录错误
function recordError(error, context = {}) {
  const timestamp = getTimestamp();
  const errorRecord = {
    id: generateErrorId(),
    message: error.message || String(error),
    stack: error.stack || '',
    type: error.name || 'Error',
    context,
    timestamp,
    severity: calculateSeverity(error)
  };
  
  fs.mkdirSync(CONFIG.errorsDir, { recursive: true });
  const file = path.join(CONFIG.errorsDir, 'errors.jsonl');
  fs.appendFileSync(file, JSON.stringify(errorRecord) + '\n');
  
  // 同时记录到错误计数指标
  recordMetric('error', 1, { 
    type: errorRecord.type, 
    severity: errorRecord.severity 
  });
  
  return errorRecord;
}

// 生成错误ID
function generateErrorId() {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 计算错误严重程度
function calculateSeverity(error) {
  const message = (error.message || '').toLowerCase();
  const name = (error.name || '').toLowerCase();
  
  // 严重错误
  if (name.includes('fatal') || name.includes('crash') || 
      message.includes('out of memory') || message.includes('database connection failed')) {
    return 'critical';
  }
  // 高优先级错误
  if (name.includes('timeout') || name.includes('econnrefused') || 
      message.includes('unauthorized') || message.includes('permission denied')) {
    return 'high';
  }
  // 中等错误
  if (name.includes('validation') || name.includes('invalid') || 
      message.includes('not found')) {
    return 'medium';
  }
  // 低优先级错误
  return 'low';
}

// 读取错误记录
function readErrors(hours = 24, severity = null) {
  const file = path.join(CONFIG.errorsDir, 'errors.jsonl');
  if (!fs.existsSync(file)) return [];
  
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  
  return lines
    .map(l => {
      try { return JSON.parse(l); } catch(e) { return null; }
    })
    .filter(e => e && new Date(e.timestamp).getTime() > cutoff)
    .filter(e => !severity || e.severity === severity);
}

// 获取错误统计
function getErrorStats(hours = 24) {
  const errors = readErrors(hours);
  
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  const byType = {};
  
  for (const err of errors) {
    bySeverity[err.severity] = (bySeverity[err.severity] || 0) + 1;
    byType[err.type] = (byType[err.type] || 0) + 1;
  }
  
  return {
    total: errors.length,
    bySeverity,
    byType,
    recent: errors.slice(-10)
  };
}

// ========== 性能指标功能 ==========

// 记录系统指标
function recordSystemMetrics() {
  const cpuLoad = os.loadavg();
  const memUsage = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  
  const metrics = {
    cpu_1m: cpuLoad[0],
    cpu_5m: cpuLoad[1],
    cpu_15m: cpuLoad[2],
    memory_used: totalMem - freeMem,
    memory_total: totalMem,
    memory_percent: Math.round((1 - freeMem / totalMem) * 10000) / 100,
    heap_used: memUsage.heapUsed,
    heap_total: memUsage.heapTotal,
    rss: memUsage.rss
  };
  
  for (const [key, value] of Object.entries(metrics)) {
    recordMetric('system', value, { type: key });
  }
  
  return metrics;
}

// 记录API性能指标
function recordAPIMetrics(endpoint, durationMs, statusCode, method = 'GET') {
  const tags = { endpoint, method, status: statusCode.toString() };
  recordMetric('api_duration', durationMs, tags);
  
  // 记录成功/失败
  if (statusCode >= 200 && statusCode < 300) {
    recordMetric('api_success', 1, tags);
  } else if (statusCode >= 400) {
    recordMetric('api_error', 1, tags);
  }
}

// 记录数据库性能
function recordDatabaseMetrics(operation, durationMs, success = true) {
  recordMetric('db_duration', durationMs, { operation, success: success.toString() });
}

// ========== 读取指标功能 ==========

// 读取指标
function readMetrics(name, hours = 24) {
  const file = path.join(CONFIG.metricsDir, name + '.jsonl');
  if (!fs.existsSync(file)) return [];
  
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  
  return lines
    .map(l => {
      try { return JSON.parse(l); } catch(e) { return null; }
    })
    .filter(m => m && new Date(m.timestamp).getTime() > cutoff);
}

// 计算统计数据
function calculateStats(metrics) {
  if (metrics.length === 0) return null;
  
  const values = metrics.map(m => m.value).sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;
  
  return {
    count: values.length,
    min: values[0],
    max: values[values.length - 1],
    avg: Math.round(avg * 100) / 100,
    p50: values[Math.floor(values.length * 0.5)],
    p95: values[Math.floor(values.length * 0.95)],
    p99: values[Math.floor(values.length * 0.99)]
  };
}

// ========== 报告生成 ==========

// 生成完整报告
function generateReport() {
  const latencyMetrics = readMetrics('latency', 24);
  const requestMetrics = readMetrics('request', 24);
  const apiMetrics = readMetrics('api_duration', 24);
  const systemMetrics = readMetrics('system', 1); // 最近1小时
  
  const latencyStats = calculateStats(latencyMetrics);
  const apiStats = calculateStats(apiMetrics);
  
  const requestsByEndpoint = {};
  const requestsByStatus = {};
  for (const m of requestMetrics) {
    const ep = m.tags.endpoint || 'unknown';
    const status = m.tags.status || 'unknown';
    requestsByEndpoint[ep] = (requestsByEndpoint[ep] || 0) + 1;
    requestsByStatus[status] = (requestsByStatus[status] || 0) + 1;
  }
  
  const errorStats = getErrorStats(24);
  
  // 计算系统指标平均值
  const latestSystem = readMetrics('system', 1).slice(-10);
  const systemAvg = {};
  if (latestSystem.length > 0) {
    for (const m of latestSystem) {
      const type = m.tags.type;
      if (!systemAvg[type]) systemAvg[type] = [];
      systemAvg[type].push(m.value);
    }
    for (const key of Object.keys(systemAvg)) {
      const arr = systemAvg[key];
      systemAvg[key] = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 100) / 100;
    }
  }
  
  return {
    timestamp: getTimestamp(),
    uptime: process.uptime(),
    latency: latencyStats,
    api: apiStats,
    requests: {
      by_endpoint: requestsByEndpoint,
      by_status: requestsByStatus,
      total: requestMetrics.length
    },
    errors: errorStats,
    system: systemAvg
  };
}

// 清理旧指标
function cleanupOldMetrics(days = 7) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  
  // 清理metrics
  const metricsDir = CONFIG.metricsDir;
  if (fs.existsSync(metricsDir)) {
    const metricFiles = fs.readdirSync(metricsDir);
    for (const file of metricFiles) {
      const filePath = path.join(metricsDir, file);
      cleanFile(filePath, cutoff);
    }
  }
  
  // 清理errors
  const errorsDir = CONFIG.errorsDir;
  if (fs.existsSync(errorsDir)) {
    const errorFile = path.join(errorsDir, 'errors.jsonl');
    if (fs.existsSync(errorFile)) {
      cleanFile(errorFile, cutoff);
    }
  }
}

function cleanFile(filePath, cutoff) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  
  const filtered = lines.filter(l => {
    try {
      const m = JSON.parse(l);
      return new Date(m.timestamp).getTime() > cutoff;
    } catch(e) { return false; }
  });
  
  fs.writeFileSync(filePath, filtered.join('\n') + '\n');
}

module.exports = {
  // 基础指标
  recordMetric,
  recordLatency,
  recordRequest,
  readMetrics,
  calculateStats,
  generateReport,
  cleanupOldMetrics,
  
  // 错误追踪
  recordError,
  readErrors,
  getErrorStats,
  
  // 性能指标
  recordSystemMetrics,
  recordAPIMetrics,
  recordDatabaseMetrics,
  
  // 配置
  CONFIG
};

if (require.main === module) {
  console.log('=== Performance Report ===');
  console.log(JSON.stringify(generateReport(), null, 2));
}
