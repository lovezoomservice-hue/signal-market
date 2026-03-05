/**
 * Signal Intelligence Pipeline - Global Scanner v3
 */

const { collectAllData } = require('./l0/global_scanner');
const { processTrendGraph } = require('./l1/topic_discovery');
const fs = require('fs');
const path = require('path');

async function runPipeline() {
  console.log('🌍 Running Global Signal Scanner Pipeline...\n');
  
  // Step 1: Collect all data
  console.log('📥 Step 1: Collecting global data...');
  const rawData = await collectAllData();
  console.log(`   Total items: ${rawData.length}\n`);
  
  // Step 2: Build trend graph
  console.log('🧠 Step 2: Building trend graph...');
  const result = processTrendGraph(rawData);
  console.log(`   Trends: ${result.trends.length}`);
  console.log(`   Clusters: ${result.clusters.length}`);
  console.log(`   Connections: ${result.edges.length}\n`);
  
  // Step 3: Save results
  const OUTPUT_DIR = './output/processed';
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, `global_signals_${date}.json`),
    JSON.stringify(result, null, 2)
  );
  
  console.log('📊 Top Trends:');
  result.trends.slice(0, 8).forEach((t, i) => {
    console.log(`   ${i+1}. ${t.topic} [${t.stage}] score: ${t.trend_score} conn: ${t.connectivity}`);
  });
  
  console.log('\n🔗 Top Clusters:');
  result.clusters.slice(0, 5).forEach((c, i) => {
    console.log(`   ${i+1}. ${c.name}: ${c.nodes.length} topics, ${c.totalEvidence} evidence`);
  });
  
  console.log('\n✅ Pipeline complete!');
  
  return result;
}

runPipeline().catch(console.error);
