/**
 * Signal Market — API Client
 * Shared fetch utilities for frontend pages
 */

const BASE = '';  // same origin

export async function fetchSignals({ limit = 8 } = {}) {
  const r = await fetch(`${BASE}/api/signals`);
  if (!r.ok) throw new Error(`signals ${r.status}`);
  const d = await r.json();
  return (d.signals || []).slice(0, limit);
}

export async function fetchGraph() {
  const r = await fetch(`${BASE}/api/graph`);
  if (!r.ok) throw new Error(`graph ${r.status}`);
  return r.json();
}

export async function fetchSignalById(id) {
  const r = await fetch(`${BASE}/api/signals/${id}`);
  if (!r.ok) throw new Error(`signal ${r.status}`);
  return r.json();
}

export function stageColor(stage) {
  const map = {
    weak:          'var(--stage-weak-text)',
    emerging:      'var(--stage-emerging-text)',
    forming:       'var(--stage-forming-text)',
    accelerating:  'var(--stage-accel-text)',
    peak:          'var(--stage-peak-text)',
    fading:        'var(--stage-fading-text)',
    dead:          'var(--stage-dead-text)',
  };
  return map[stage] || 'var(--text-muted)';
}

export function stageHex(stage) {
  const map = {
    weak:          '#6B7280',
    emerging:      '#F59E0B',
    forming:       '#60A5FA',
    accelerating:  '#10B981',
    peak:          '#A78BFA',
    fading:        '#9CA3AF',
    dead:          '#4B5563',
  };
  return map[stage] || '#6B7280';
}

export function formatConf(v) {
  return (Math.round(v * 100) / 100).toFixed(2);
}

export function formatSource(src) {
  if (!src) return '';
  return src.replace('arxiv:', '').replace('arxiv_', '').replace('github:', '').replace('_', ' ');
}

export function timeSince(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 3600)  return `${Math.round(diff/60)}m ago`;
  if (diff < 86400) return `${Math.round(diff/3600)}h ago`;
  return `${Math.round(diff/86400)}d ago`;
}
