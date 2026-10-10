const DEFAULT_SUPABASE_URL = "https://ojprsyvkzgyphpsvksgx.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_mhVX66Gl1F0x6WMgORilRw_QWjOrusW";

function supabaseConfig() {
  return {
    url: String(process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, ""),
    key: String(process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY).trim()
  };
}

function bearer(req) {
  const match = String(req.headers?.authorization || req.headers?.Authorization || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

async function authenticatedUser(req) {
  const token = bearer(req);
  if (!token) return null;
  const { url, key } = supabaseConfig();
  const response = await fetch(url + "/auth/v1/user", {
    headers: { apikey: key, Authorization: "Bearer " + token },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) return null;
  const user = await response.json();
  return user && typeof user.id === "string" ? user : null;
}

async function rpc(name, args, userToken) {
  const { url, key } = supabaseConfig();
  const response = await fetch(url + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: "Bearer " + userToken,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(10000)
  });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = raw; }
  return { ok: response.ok, status: response.status, data };
}

function providerStatus(status) {
  if (status === "succeeded") return "succeeded";
  if (status === "failed") return "failed";
  if (status === "canceled") return "canceled";
  if (status === "starting") return "starting";
  if (status === "processing") return "processing";
  return "queued";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const userToken = bearer(req);
  if (!userToken) return res.status(401).json({ error: "Sign in to ReconFeed before checking AI generation status." });
  let user;
  try { user = await authenticatedUser(req); }
  catch { return res.status(503).json({ error: "Authentication service is temporarily unavailable." }); }
  if (!user) return res.status(401).json({ error: "Your session is invalid or expired. Sign in again." });

  const id = String(req.query?.id || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: "A valid ReconFeed generation job ID is required." });
  const { url, key } = supabaseConfig();
  try {
    const response = await fetch(url + "/rest/v1/ai_generation_jobs?id=eq." + encodeURIComponent(id) + "&select=id,provider_prediction_id,workflow,status&limit=1", {
      headers: { apikey: key, Authorization: "Bearer " + userToken, Accept: "application/json" },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return res.status(503).json({ error: "Could not retrieve your generation job." });
    const jobs = await response.json();
    const job = Array.isArray(jobs) ? jobs[0] : null;
    // RLS means a job owned by another account is indistinguishable from a missing job.
    if (!job) return res.status(404).json({ error: "Generation job was not found for this account." });
    if (!job.provider_prediction_id) return res.status(200).json({ id: job.id, status: job.status, output: null });
    const token = String(process.env.REPLICATE_API_TOKEN || "").trim();
    if (!token) return res.status(503).json({ error: "AI generation is not configured yet." });

    const upstream = await fetch("https://api.replicate.com/v1/predictions/" + encodeURIComponent(job.provider_prediction_id), {
      headers: { Authorization: "Bearer " + token },
      signal: AbortSignal.timeout(15000)
    });
    if (!upstream.ok) return res.status(502).json({ error: "Unable to retrieve generation status." });
    const data = await upstream.json();
    const status = providerStatus(data.status);
    if (status !== job.status) {
      const updated = await rpc("finalize_ai_generation", {
        p_job_id: job.id,
        p_prediction_id: job.provider_prediction_id,
        p_status: status
      }, userToken);
      if (!updated.ok) console.warn("Could not update AI job status", updated.status);
    }
    return res.status(200).json({
      id: job.id,
      status,
      output: data.output || null,
      error: status === "failed" ? "Generation failed. Try a different prompt." : null
    });
  } catch (e) {
    console.error("AI status lookup failed", e?.message || "unknown");
    return res.status(502).json({ error: "Could not reach the AI provider." });
  }
}
