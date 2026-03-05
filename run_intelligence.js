/**
 * Signal Intelligence Pipeline - Complete v4
 * Scanner + Graph + Prediction
 */

const { collectAllData } = require('./l0/global_scanner');
const { processTrendGraph } = require('./l1/topic_discovery');
const { predictTrends } = require('./l1/prediction_engine');
const fs = require('fs');
const path = require('path');

async function runPipeline() {
  console.log('🚀 Signal Intelligence Pipeline v4\n');
  
  // Step 1: Collect
  console.log('📥 Step 1: Global Data Collection...');
  const rawData = await collectAllData();
  console.log(`   Total: ${rawData.length} items\n`);
  
  // Step 2: Trend Graph
  console.log('🧠 Step 2: Building Trend Graph...');
  const graphResult = processTrendGraph(rawData);
  console.log(`   Trends: ${graphResult.trends.length}`);
  console.log(`   Clusters: ${graphResult.clusters.length}\n`);
  
  // Step 3: Prediction
  console.log('🔮 Step 3: Predicting Future Trends...');
  const predictionResult = predictTrends(rawData);
  console.log(`   Predictions: ${predictionResult.predictions.length}`);
  console.log(`   Lifecycle: ${JSON.stringify(predictionResult.summary)}\n`);
  
  // Save
  const OUTPUT_DIR = './output/processed';
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, `complete_${date}.json`),
    JSON.stringify({ graph: graphResult, predictions: predictionResult }, null, 2)
  );
  
  // Output
  console.log('📊 Top Predicted Trends:');
  predictionResult.predictions.slice(0, 8).forEach((p, i) => {
    console.log(`   ${i+1}. ${p.topic} [${p.lifecycle}] score: ${p.prediction_score}`);
    console.log(`      growth: ${p.growth_acceleration}x dev: ${p.developer_activity} capital: ${p.capital_signal}`);
  });
  
  console.log('\n✅ Pipeline Complete!');
  
  return { graph: graphResult, predictions: predictionResult };
}

runPipeline().catch(console.error);
