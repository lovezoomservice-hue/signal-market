const WATCHLIST = [];

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const alerts = WATCHLIST.map(w => ({
    id: 'alert_' + Date.now() + '_' + w.id,
    topic: w.topic,
    type: 'stage_change',
    message: w.topic + ' status updated',
    timestamp: new Date().toISOString(),
    read: false
  }));
  
  if (alerts.length === 0) {
    alerts.push(
      { id: 'alert_1', topic: 'AI Agents', type: 'stage_change', message: 'AI Agents entering acceleration phase', timestamp: new Date().toISOString(), read: false },
      { id: 'alert_2', topic: 'GPU Shortage', type: 'confidence_change', message: 'GPU Shortage confidence up to 94%', timestamp: new Date(Date.now() - 3600000).toISOString(), read: false }
    );
  }
  
  return res.status(200).json({ alerts, count: alerts.length });
}
