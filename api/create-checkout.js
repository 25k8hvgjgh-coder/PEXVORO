// Fail closed until checkout, seller payouts and verified webhooks are implemented.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return res.status(503).json({ error: 'In-app checkout is not available yet. Contact the seller to discuss transaction arrangements.' });
}
