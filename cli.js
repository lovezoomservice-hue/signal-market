#!/usr/bin/env node

/**
 * Signal Market CLI
 * 
 * 命令行工具
 * 
 * 用法:
 *   node cli.js health
 *   node cli.js events
 *   node cli.js brief lens_a_stock
 *   node cli.js predictions
 */

const http = require('http');

const API_URL = process.env.SIGNAL_API_URL || 'http://localhost:3000';

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get(`${API_URL}${path}`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { resolve(data); }
      });
    }).on('error', reject);
  });
}

async function cmdHealth() {
  const data = await httpGet('/signals/health');
  console.log('=== System Health ===');
  console.log(JSON.stringify(data, null, 2));
}

async function cmdEvents() {
  const data = await httpGet('/events');
  console.log('=== Events ===');
  console.log(JSON.stringify(data, null, 2));
}

async function cmdBrief(lens) {
  const data = await httpGet(`/lenses/${lens}/daily-brief`);
  console.log(`=== Lens Brief: ${lens} ===`);
  console.log(JSON.stringify(data, null, 2));
}

async function cmdPredictions() {
  const data = await httpGet('/predictions');
  console.log('=== Predictions ===');
  console.log(JSON.stringify(data, null, 2));
}

async function cmdPrediction(id) {
  const data = await httpGet(`/predictions/${id}`);
  console.log(`=== Prediction: ${id} ===`);
  console.log(JSON.stringify(data, null, 2));
}

async function main() {
  const cmd = process.argv[2];
  const arg = process.argv[3];
  
  try {
    switch (cmd) {
      case 'health':
        await cmdHealth();
        break;
      case 'events':
        await cmdEvents();
        break;
      case 'brief':
        if (!arg) {
          console.error('Usage: node cli.js brief <lens_id>');
          process.exit(1);
        }
        await cmdBrief(arg);
        break;
      case 'predictions':
        await cmdPredictions();
        break;
      case 'prediction':
        if (!arg) {
          console.error('Usage: node cli.js prediction <event_id>');
          process.exit(1);
        }
        await cmdPrediction(arg);
        break;
      default:
        console.log(`
Signal Market CLI

Usage:
  node cli.js health              # Health check
  node cli.js events              # List events
  node cli.js brief <lens>         # Get lens brief
  node cli.js predictions         # List predictions
  node cli.js prediction <id>     # Get prediction curve
        `);
    }
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

main();
