/**
 * /api/graph — Signal Graph v1 (P2-1)
 *
 * Returns topic relationship graph:
 *   nodes = signal topics (with metadata)
 *   edges = co-source / co-category / evidence overlap relationships
 *
 * Routes:
 *   GET /api/graph                → full graph
 *   GET /api/graph?topic=xxx      → ego-graph for one topic
 *   GET /api/graph/stats          → graph statistics
 */

import { getUnifiedSignals } from './_unified.js';
import { getEvidence, getLifecycle } from './_store.js';

function buildGraph(signals, filter_topic = null) {
  // ── Build nodes ────────────────────────────────────────────────
  const nodes = signals.map((s, i) => {
    const sig_id = `evt_${String(i + 1).padStart(3, '0')}`;
        const ev = getEvidence(sig_id);
    return {
      id:             sig_id,
      label:          s.topic,
      category:       s.category || 'Unknown',
      stage:          s.stage || 'unknown',
      lifecycle_state: s.lifecycle_state || null,
      confidence:     s.confidence || 0,
      impact_score:   s.impact_score || 0,
      evidence_count: ev?.length || s.evidenceCount || 0,
      sources:        s.sources || [],
      first_seen:     s.first_seen || null,
      // Graph-specific metrics (computed below)
      degree:         0,
      centrality:     0,
    };
  });

  const nodeMap = {};
  nodes.forEach(n => { nodeMap[n.id] = n; });

  // ── Build edges (3 relationship types) ─────────────────────────
  const edges = [];
  const edgeSet = new Set();

  for (let i = 0; i < signals.length; i++) {
    for (let j = i + 1; j < signals.length; j++) {
      const a = nodes[i];
      const b = nodes[j];

      const relationships = [];
      let weight = 0;

      // 1. Shared sources
      const sharedSources = a.sources.filter(s => b.sources.includes(s));
      if (sharedSources.length > 0) {
        relationships.push('shared_source');
        weight += 0.4 * sharedSources.length;
      }

      // 2. Same category
      if (a.category === b.category && a.category !== 'Unknown') {
        relationships.push('same_category');
        weight += 0.3;
      }

      // 3. Similar confidence / co-emerging (both > 0.6 same stage)
      if (Math.abs(a.confidence - b.confidence) < 0.15 &&
          a.stage === b.stage && a.stage !== 'unknown') {
        relationships.push('co_stage');
        weight += 0.2;
      }

      // 4. Same first_seen date (co-appearing signals)
      if (a.first_seen && b.first_seen && a.first_seen === b.first_seen) {
        relationships.push('co_appearing');
        weight += 0.1;
      }

      if (relationships.length === 0) continue;

      const edge_id = `${a.id}-${b.id}`;
      if (edgeSet.has(edge_id)) continue;
      edgeSet.add(edge_id);

      edges.push({
        edge_id,
        source:        a.id,
        target:        b.id,
        source_label:  a.label,
        target_label:  b.label,
        relationships,
        weight:        parseFloat(Math.min(weight, 1.0).toFixed(2)),
        shared_sources: sharedSources,
      });

      // Increment degree
      nodeMap[a.id].degree++;
      nodeMap[b.id].degree++;
    }
  }

  // ── Compute centrality (degree-normalized) ─────────────────────
  const maxDeg = Math.max(...nodes.map(n => n.degree), 1);
  nodes.forEach(n => {
    n.centrality = parseFloat((n.degree / maxDeg).toFixed(2));
  });

  // ── Ego-graph filter ───────────────────────────────────────────
  let filteredNodes = nodes;
  let filteredEdges = edges;

  if (filter_topic) {
    const ego = nodes.find(n => n.label.toLowerCase().includes(filter_topic.toLowerCase()) ||
                                n.id === filter_topic);
    if (ego) {
      const neighborIds = new Set([ego.id]);
      filteredEdges = edges.filter(e => e.source === ego.id || e.target === ego.id);
      filteredEdges.forEach(e => { neighborIds.add(e.source); neighborIds.add(e.target); });
      filteredNodes = nodes.filter(n => neighborIds.has(n.id));
    }
  }

  return { nodes: filteredNodes, edges: filteredEdges };
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id, topic } = req.query || {};

  const signals = getUnifiedSignals();

  // ── GET /api/graph/stats ─────────────────────────────────────
  if (id === 'stats') {
    const { nodes, edges } = buildGraph(signals);
    const degrees = nodes.map(n => n.degree);
    const avgDeg  = degrees.reduce((a, b) => a + b, 0) / (nodes.length || 1);
    const density = nodes.length > 1
      ? (2 * edges.length) / (nodes.length * (nodes.length - 1))
      : 0;

    const relTypes = {};
    edges.forEach(e => e.relationships.forEach(r => {
      relTypes[r] = (relTypes[r] || 0) + 1;
    }));

    return res.status(200).json({
      node_count:    nodes.length,
      edge_count:    edges.length,
      avg_degree:    parseFloat(avgDeg.toFixed(2)),
      density:       parseFloat(density.toFixed(3)),
      top_by_centrality: [...nodes].sort((a, b) => b.centrality - a.centrality).slice(0, 5)
        .map(n => ({ id: n.id, label: n.label, centrality: n.centrality, degree: n.degree })),
      relationship_type_counts: relTypes,
      generated_at:  new Date().toISOString(),
    });
  }

  // ── GET /api/graph?topic=xxx (ego-graph) ─────────────────────
  if (topic) {
    const { nodes, edges } = buildGraph(signals, topic);
    if (nodes.length === 0) return res.status(404).json({ error: 'Topic not found', topic });
    return res.status(200).json({
      ego_topic: topic,
      nodes,
      edges,
      node_count: nodes.length,
      edge_count: edges.length,
      generated_at: new Date().toISOString(),
    });
  }

  // ── GET /api/graph ────────────────────────────────────────────
  const { nodes, edges } = buildGraph(signals);
  return res.status(200).json({
    nodes,
    edges,
    node_count:   nodes.length,
    edge_count:   edges.length,
    graph_version: 'v1',
    algorithm:    'co_source + co_category + co_stage + co_appearing',
    generated_at: new Date().toISOString(),
  });
}
