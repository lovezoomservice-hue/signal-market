/**
 * Scheduler - Daily Pipeline Runner
 * 
 * 运行: node scheduler.js
 * 或使用 cron: 0 8 * * * node /path/to/scheduler.js
 */

const { runPipeline } = require('./run_pipeline');

// 检查是否到了运行时间
function shouldRun() {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  
  // 默认 08:30 运行
  return hour === 8 && minute >= 0 && minute < 10;
}

// 主循环
async function startScheduler() {
  console.log('📅 Signal Market Scheduler started');
  console.log('⏰ Checking every minute for scheduled run...');
  
  setInterval(() => {
    if (shouldRun()) {
      console.log('⏰ Scheduled time reached, running pipeline...');
      runPipeline();
    }
  }, 60000); // 每分钟检查一次
  
  // 立即运行一次（用于测试）
  if (process.argv.includes('--run-now')) {
    console.log('🔧 Running immediately (--run-now flag)');
    runPipeline();
  }
}

startScheduler();
