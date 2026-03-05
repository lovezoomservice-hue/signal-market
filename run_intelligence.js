/**
 * Signal Intelligence Pipeline
 * End-to-end signal processing
 */

const { fetchGitHubTrending, fetchHackerNews, fetchArxivPapers } = require('./l0/data_sources');
const { processSignals } = require('./l1/topic_discovery');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = './output/processed';

async function runPipeline() {
  console.log('🔄 Running Signal Intelligence Pipeline...');
  
  // Step 1: Collect raw data
  console.log('📥 Collecting data from sources...');
  const [github, hn, arxiv] = await Promise.all([
    fetchGitHubTrending(),
    fetchHackerNews(),
    fetchArxivPapers()
  ]);
  
  const rawData = [...github, ...hn, ...arxiv];
  console.log(`   Collected ${rawData.length} raw items`);
  
  // Step 2: Process into signals
  console.log('🧠 Processing signals...');
  const signals = processSignals(rawData);
  console.log(`   Generated ${signals.length} signals`);
  
  // Step 3: Save results
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Save processed signals
  fs.writeFileSync(
    path.join(OUTPUT_DIR, `signals_${date}.json`),
    JSON.stringify({
      timestamp: new Date().toISOString(),
      count: signals.length,
      signals
    }, null, 2)
  );
  
  console.log(`✅ Pipeline complete! ${signals.length} signals generated`);
  
  // Show top signals
  console.log('\n📊 Top Signals:');
  signals.slice(0, 5).forEach((s, i) => {
    console.log(`   ${i+1}. ${s.topic} [${s.stage}] priority: ${s.priority}`);
  });
  
  return signals;
}

// Run if called directly
if (require.main === module) {
  runPipeline().catch(console.error);
}

module.exports = { runPipeline };
