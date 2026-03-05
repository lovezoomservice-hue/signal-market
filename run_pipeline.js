/**
 * Daily Pipeline Runner
 * 
 * 每天定时运行 L0 → L1 → L2 → L3
 * 支持 cron 调度
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PIPELINE_STEPS = [
  { name: 'L0: Ingest', script: './l0/ingest.js' },
  { name: 'L1: Denoise', script: './l1/denoise.js' },
  { name: 'L2: Event Graph', script: './l2/event_graph.js' },
  { name: 'L3: Probability', script: './l3/probability.js' }
];

const LOG_FILE = '/home/nice005/.openclaw/workspace/signal-market/output/pipeline.log';

function log(msg) {
  const timestamp = new Date().toISOString();
  const logMsg = `[${timestamp}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, logMsg);
  console.log(msg);
}

function runStep(step) {
  return new Promise((resolve, reject) => {
    log(`🔄 Running: ${step.name}`);
    
    const child = process.platform === 'win32' 
      ? spawn('cmd', ['/c', 'node', step.script], { cwd: '/home/nice005/.openclaw/workspace/signal-market' })
      : spawn('node', [step.script], { cwd: '/home/nice005/.openclaw/workspace/signal-market' });
    
    let output = '';
    child.stdout.on('data', (data) => { output += data; });
    child.stderr.on('data', (data) => { output += data; });
    
    child.on('close', (code) => {
      if (code === 0) {
        log(`✅ ${step.name} complete`);
        resolve();
      } else {
        log(`❌ ${step.name} failed: ${output}`);
        reject(new Error(`${step.name} failed`));
      }
    });
  });
}

async function runPipeline() {
  log('🚀 Starting Signal Market Pipeline');
  
  const startTime = Date.now();
  
  try {
    for (const step of PIPELINE_STEPS) {
      await runStep(step);
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`🎉 Pipeline complete in ${duration}s`);
    
    process.exit(0);
  } catch (e) {
    log(`❌ Pipeline failed: ${e.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runPipeline();
}

module.exports = { runPipeline };
