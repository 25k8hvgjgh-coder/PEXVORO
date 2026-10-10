const DEFAULT_SUPABASE_URL = "https://ojprsyvkzgyphpsvksgx.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_mhVX66Gl1F0x6WMgORilRw_QWjOrusW";

async function authenticatedUser(req) {
  const authorization = String(req.headers?.authorization || req.headers?.Authorization || "");
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const url = String(process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
  const key = String(process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY).trim();
  const response = await fetch(url + "/auth/v1/user", {
    method: "GET",
    headers: { apikey: key, Authorization: "Bearer " + match[1] }
  });
  if (!response.ok) return null;
  const user = await response.json();
  return user && typeof user.id === "string" ? user : null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  let user;
  try { user = await authenticatedUser(req); } catch { return res.status(503).json({ error: "Authentication service is temporarily unavailable." }); }
  if (!user) return res.status(401).json({ error: "Sign in to ReconFeed before checking AI generation status." });

  const token = String(process.env.REPLICATE_API_TOKEN || "").trim();
  const id = String(req.query?.id || "").trim();
  if (!token) return res.status(503).json({ error: "AI generation is not configured yet." });
  if (!/^[a-zA-Z0-9_-]{6,100}$/.test(id)) return res.status(400).json({ error: "A valid generation ID is required." });
  try {
    const response = await fetch("https://api.replicate.com/v1/predictions/" + encodeURIComponent(id), {
      headers: { Authorization: "Bearer " + token }
    });
    const data = await response.json();
    if (!response.ok) return res.status(502).json({ error: "Unable to retrieve generation status." });
    return res.status(200).json({
      id: data.id,
      status: data.status,
      output: data.output || null,
      error: data.status === "failed" ? "Generation failed. Try a different prompt." : null
    });
  } catch {
    return res.status(502).json({ error: "Could not reach the AI provider." });
  }
}