export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  return res.status(200).json({
    app: "PEXVORO",
    status: "online",
    configured: {
      replicate: Boolean(process.env.REPLICATE_API_TOKEN && (process.env.REPLICATE_VIDEO_MODEL || process.env.REPLICATE_IMAGE_MODEL)),
      supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
      stripe: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET)
    },
    note: "Configuration presence only; no generation or payment has been tested."
  });
}