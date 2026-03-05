/**
 * Health Check API
 * 
 * 系统健康检查和状态监控
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { performance } = require('perf_hooks');

const ROOT = '/home/nice005/.openclaw/workspace/signal-market';

// 健康检查配置
const CONFIG = {
  checks: {
    // 磁盘检查
    disk: {
      critical: 90, // 超过90%告警
      warning: 80
    },
    // 内存检查
    memory: {
      critical: 90,
      warning: 80
    },
    // CPU检查 (负载)
    cpu: {
      critical: 4, // 4核负载
      warning: 2
    },
    // 响应时间检查 (ms)
    responseTime: {
      critical: 5000,
      warning: 2000
    }
  }
};

/**
 * 检查磁盘空间
 */
function checkDisk() {
  try {
    const outputDir = path.join(ROOT, 'output');
    if (!fs.existsSync(outputDir)) {
      return { status: 'unknown', message: 'Output directory not found' };
    }
    
    // 使用 df 命令检查磁盘
    const { execSync } = require('child_process');
    let dfOutput;
    try {
      dfOutput = execSync('df -k /home/nice005/.openclaw/workspace', { encoding: 'utf8' });
    } catch (e) {
      // 尝试其他路径
      dfOutput = execSync('df -k .', { encoding: 'utf8' });
    }
    
    const lines = dfOutput.trim().split('\n');
    const parts = lines[1].split(/\s+/);
    const total = parseInt(parts[1]) * 1024;
    const used = parseInt(parts[2]) * 1024;
    const available = parseInt(parts[3]) * 1024;
    const percent = parseInt(parts[4]);
    
    let status = 'healthy';
    if (percent >= CONFIG.checks.disk.critical) status = 'critical';
    else if (percent >= CONFIG.checks.disk.warning) status = 'warning';
    
    return {
      status,
      total: formatBytes(total),
      used: formatBytes(used),
      available: formatBytes(available),
      percent,
      threshold: CONFIG.checks.disk
    };
  } catch (error) {
    return { status: 'unknown', error: error.message };
  }
}

/**
 * 检查内存使用
 */
function checkMemory() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const percent = Math.round((1 - freeMem / totalMem) * 100);
  
  let status = 'healthy';
  if (percent >= CONFIG.checks.memory.critical) status = 'critical';
  else if (percent >= CONFIG.checks.memory.warning) status = 'warning';
  
  return {
    status,
    total: formatBytes(totalMem),
    used: formatBytes(usedMem),
    free: formatBytes(freeMem),
    percent,
    threshold: CONFIG.checks.memory
  };
}

/**
 * 检查CPU负载
 */
function checkCPU() {
  const loadAvg = os.loadavg();
  const cpus = os.cpus().length;
  const load1m = loadAvg[0];
  const loadPerCpu = load1m / cpus;
  
  let status = 'healthy';
  if (load1m >= CONFIG.checks.cpu.critical * cpus) status = 'critical';
  else if (load1m >= CONFIG.checks.cpu.warning * cpus) status = 'warning';
  
  return {
    status,
    load: {
      '1m': Math.round(load1m * 100) / 100,
      '5m': Math.round(loadAvg[1] * 100) / 100,
      '15m': Math.round(loadAvg[2] * 100) / 100
    },
    cpus,
    load_per_cpu: Math.round(loadPerCpu * 100) / 100,
    threshold: CONFIG.checks.cpu
  };
}

/**
 * 检查关键文件
 */
function checkFiles() {
  const requiredFiles = [
    'package.json',
    'l4/api_server.js',
    'monitoring/performance.js'
  ];
  
  const results = {};
  let allHealthy = true;
  
  for (const file of requiredFiles) {
    const filePath = path.join(ROOT, file);
    const exists = fs.existsSync(filePath);
    results[file] = exists ? 'exists' : 'missing';
    if (!exists) allHealthy = false;
  }
  
  return {
    status: allHealthy ? 'healthy' : 'degraded',
    files: results
  };
}

/**
 * 检查数据目录
 */
function checkDataDirs() {
  const dirs = ['output', 'data', 'output/metrics', 'output/errors'];
  const results = {};
  let allHealthy = true;
  
  for (const dir of dirs) {
    const dirPath = path.join(ROOT, dir);
    const exists = fs.existsSync(dirPath);
    
    let stats = null;
    if (exists) {
      try {
        const files = fs.readdirSync(dirPath);
        stats = { file_count: files.length };
      } catch (e) {
        stats = { error: e.message };
      }
    }
    
    results[dir] = exists ? { status: 'exists', ...stats } : { status: 'missing' };
    if (!exists) allHealthy = false;
  }
  
  return {
    status: allHealthy ? 'healthy' : 'degraded',
    dirs: results
  };
}

/**
 * 检查进程状态
 */
function checkProcess() {
  const pid = process.pid;
  const uptime = process.uptime();
  const memory = process.memoryUsage();
  
  return {
    status: 'healthy',
    pid,
    uptime: Math.round(uptime),
    uptime_formatted: formatUptime(uptime),
    memory: {
      heap_used: formatBytes(memory.heapUsed),
      heap_total: formatBytes(memory.heapTotal),
      rss: formatBytes(memory.rss),
      external: formatBytes(memory.external)
    },
    node_version: process.version,
    platform: os.platform(),
    arch: os.arch()
  };
}

/**
 * 检查依赖服务 (模拟)
 */
function checkDependencies() {
  // 检查可能的依赖
  const deps = {
    // 文件系统 - 始终可用
    filesystem: { status: 'healthy', type: 'internal' },
  };
  
  // 检查是否配置了外部服务
  const envFile = path.join(ROOT, '.env');
  if (fs.existsSync(envFile)) {
    try {
      const envContent = fs.readFileSync(envFile, 'utf8');
      if (envContent.includes('DATABASE_URL')) {
        deps.database = { status: 'healthy', type: 'external', note: 'configured' };
      }
      if (envContent.includes('REDIS')) {
        deps.redis = { status: 'unknown', type: 'external', note: 'check connection' };
      }
    } catch (e) {
      // ignore
    }
  }
  
  let overallStatus = 'healthy';
  for (const [name, dep] of Object.entries(deps)) {
    if (dep.status === 'unhealthy') {
      overallStatus = 'degraded';
      break;
    }
  }
  
  return {
    status: overallStatus,
    dependencies: deps
  };
}

/**
 * 执行完整健康检查
 */
function fullHealthCheck() {
  const startTime = performance.now();
  
  const checks = {
    timestamp: new Date().toISOString(),
    disk: checkDisk(),
    memory: checkMemory(),
    cpu: checkCPU(),
    files: checkFiles(),
    dataDirs: checkDataDirs(),
    process: checkProcess(),
    dependencies: checkDependencies()
  };
  
  // 确定整体状态
  let overallStatus = 'healthy';
  const statuses = [
    checks.disk.status,
    checks.memory.status,
    checks.cpu.status,
    checks.files.status,
    checks.dataDirs.status,
    checks.process.status,
    checks.dependencies.status
  ];
  
  if (statuses.includes('critical')) overallStatus = 'critical';
  else if (statuses.includes('degraded')) overallStatus = 'degraded';
  else if (statuses.includes('warning')) overallStatus = 'warning';
  
  // 检查是否有错误严重级别
  const errorFile = path.join(ROOT, 'output/errors/errors.jsonl');
  if (fs.existsSync(errorFile)) {
    try {
      const content = fs.readFileSync(errorFile, 'utf8');
      const lines = content.split('\n').filter(l => l.trim()).slice(-100);
      const recentErrors = lines
        .map(l => { try { return JSON.parse(l); } catch(e) { return null; } })
        .filter(e => e && e.severity === 'critical');
      
      if (recentErrors.length > 0) {
        overallStatus = 'critical';
      }
    } catch (e) {
      // ignore
    }
  }
  
  const duration = Math.round(performance.now() - startTime);
  
  return {
    status: overallStatus,
    duration_ms: duration,
    checks
  };
}

/**
 * 简单的健康检查 (快速响应)
 */
function quickHealthCheck() {
  const memUsage = os.freemem() / os.totalmem();
  const status = memUsage > 0.1 ? 'healthy' : 'critical';
  
  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  };
}

// ========== 工具函数 ==========

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// ========== HTTP 处理器 ==========

function handleHealthCheck(req, res) {
  const type = req.query.type || 'full';
  
  if (type === 'quick') {
    return res.json(quickHealthCheck());
  }
  
  const health = fullHealthCheck();
  const statusCode = health.status === 'healthy' ? 200 : 
                     health.status === 'warning' ? 200 :
                     health.status === 'degraded' ? 503 : 503;
  
  res.status(statusCode).json(health);
}

// 导出
module.exports = {
  CONFIG,
  checkDisk,
  checkMemory,
  checkCPU,
  checkFiles,
  checkDataDirs,
  checkProcess,
  checkDependencies,
  fullHealthCheck,
  quickHealthCheck,
  handleHealthCheck
};

// 如果直接运行
if (require.main === module) {
  console.log('=== Health Check ===');
  console.log(JSON.stringify(fullHealthCheck(), null, 2));
}
