const { fetchGitHubTrending, fetchHackerNews, fetchArxivPapers } = require('./l0/data_sources');
const { processTrendGraph } = require('./l1/topic_discovery');
const fs = require('fs');
const path = require('path');

async function runPipeline() {
  console.log('🔄 Running Signal Intelligence Pipeline v3...');
  
  console.log('📥 Collecting data...');
  const [github, hn, arxiv] = await Promise.all([
    fetchGitHubTrending(),
    fetchHackerNews(),
    fetchArxivPapers()
  ]);
  
  const rawData = [...github, ...hn, ...arxiv];
  console.log(`   Collected ${rawData.length} items`);
  
  console.log('🧠 Building trend graph...');
  const result = processTrendGraph(rawData);
  console.log(`   Generated ${result.trends.length} trends`);
  
  // Save
  const OUTPUT_DIR = './output/processed';
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  fs.writeFileSync(
    path.join(OUTPUT_DIR, `trends_${date}.json`),
    JSON.stringify(result, null, 2)
  );
  
  console.log(`\n✅ Pipeline complete!`);
  console.log('\n📊 Top Trends:');
  result.trends.slice(0, 5).forEach((t, i) => {
    console.log(`   ${i+1}. ${t.topic} [${t.stage}] score: ${t.trend_score} connections: ${t.connectivity}`);
  });
  
  console.log('\n🔗 Trend Clusters:');
  result.clusters.slice(0, 3).forEach((c, i) => {
    console.log(`   ${i+1}. ${c.name}: ${c.nodes.length} topics`);
  });
  
  return result;
}

runPipeline().catch(console.error);
