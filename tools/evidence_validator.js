#!/usr/bin/env node
import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node tools/evidence_validator.js <evidence.json>');
  process.exit(2);
}
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
const has = (k) => pkg[k] && ((Array.isArray(pkg[k]) && pkg[k].length > 0) || (typeof pkg[k] === 'object' && Object.keys(pkg[k]).length > 0));
const missing = ['EVIDENCE_PATHS', 'RUNTIME_EVIDENCE', 'SUCCESS_CRITERIA_ATTAINMENT'].filter(k => !has(k));
if (missing.length) {
  console.error('FAIL', { missing });
  process.exit(1);
}
console.log('PASS', { project_id: pkg.project_id, evidence_package_id: pkg.evidence_package_id });
