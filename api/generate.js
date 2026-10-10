const allowed = new Set(["text-video", "image"]);
const send = (res, status, body) => res.status(status).json(body);
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

async function rpc(name, args) {
  const { url } = supabaseConfig();
  const serverKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!serverKey) return { ok: false, status: 503, data: { message: "SUPABASE_SERVICE_ROLE_KEY is not configured." } };
  const response = await fetch(url + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: {
      apikey: serverKey,
      Authorization: "Bearer " + serverKey,
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
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Method not allowed" });
  }

  const userToken = bearer(req);
  if (!userToken) return send(res, 401, { error: "Sign in to ReconFeed before using AI Studio." });
  let user;
  try { user = await authenticatedUser(req); }
  catch { return send(res, 503, { error: "Authentication service is temporarily unavailable." }); }
  if (!user) return send(res, 401, { error: "Your session is invalid or expired. Sign in again." });

  const token = String(process.env.REPLICATE_API_TOKEN || "").trim();
  const serverKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const missing = [];
  if (!token) missing.push("REPLICATE_API_TOKEN");
  if (!serverKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length) return send(res, 503, {
    error: "AI Studio server configuration is incomplete.",
    missing
  });

  let body = req.body;
  try { if (typeof body === "string") body = JSON.parse(body); }
  catch { return send(res, 400, { error: "Request body must be valid JSON." }); }
  body = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const workflow = String(body.workflow || "text-video");
  const prompt = String(body.prompt || "").trim();
  if (!allowed.has(workflow)) return send(res, 400, { error: "Unsupported workflow." });
  if (prompt.length < 8 || prompt.length > 1500) return send(res, 400, { error: "Prompt must be between 8 and 1,500 characters." });

  const imageOnly = workflow === "image";
  const model = String(imageOnly
    ? (process.env.REPLICATE_IMAGE_MODEL || "black-forest-labs/flux-schnell")
    : (process.env.REPLICATE_VIDEO_MODEL || "runwayml/gen4-turbo")).trim();
  if (!/^[a-z0-9_-]+\/[a-z0-9_.-]+$/i.test(model)) {
    return send(res, 503, { error: "The configured generation model identifier is invalid." });
  }
  const duration = Number(body.duration || 5);
  if (!imageOnly && ![5, 10].includes(duration)) return send(res, 400, { error: "Duration must be 5 or 10 seconds for the current video model." });
  const aspect = ["9:16", "16:9", "1:1"].includes(body.aspectRatio) ? body.aspectRatio : "9:16";
  const input = { prompt, aspect_ratio: aspect };
  if (!imageOnly) input.duration = duration;

  // Reserve a per-user job before calling the paid provider; this also applies hourly/daily quotas.
  let reservation;
  try { reservation = await rpc("reserve_ai_generation", { p_user_id: user.id, p_workflow: workflow }); }
  catch { return send(res, 503, { error: "Could not reserve an AI generation. Try again shortly." }); }
  if (!reservation.ok) {
    const message = String(reservation.data?.message || reservation.data?.details || "");
    if (/AI_RATE_LIMIT/.test(message)) return send(res, 429, { error: "You have reached the AI generation limit. Try again later." });
    console.error("AI job reservation failed", reservation.status, message.slice(0, 180));
    return send(res, 503, { error: "AI generation is temporarily unavailable. Please try again." });
  }
  const jobId = String(reservation.data || "").replace(/^"|"$/g, "");
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return send(res, 503, { error: "AI generation reservation returned an invalid job ID." });

  try {
    const upstream = await fetch("https://api.replicate.com/v1/models/" + model + "/predictions", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", Prefer: "wait=1" },
      body: JSON.stringify({ input }),
      signal: AbortSignal.timeout(90000)
    });
    const raw = await upstream.text();
    let data = {};
    try { data = JSON.parse(raw); } catch {}
    if (!upstream.ok || !data.id) {
      await rpc("finalize_ai_generation", { p_user_id: user.id, p_job_id: jobId, p_prediction_id: null, p_status: "failed" }).catch(() => {});
      if (!upstream.ok) {
        console.error("Replicate generation error", upstream.status, String(data.detail || data.title || "provider error").slice(0, 180));
        return send(res, upstream.status === 429 ? 429 : 502, { error: upstream.status === 429 ? "AI provider rate limit reached. Try again later." : "The AI provider rejected this request. Check the configured model and its input schema." });
      }
      return send(res, 502, { error: "The AI provider returned an incomplete generation response." });
    }
    const status = providerStatus(data.status);
    const saved = await rpc("finalize_ai_generation", {
      p_user_id: user.id,
      p_job_id: jobId,
      p_prediction_id: String(data.id),
      p_status: status
    });
    if (!saved.ok || saved.data !== true) {
      console.error("AI job finalization failed", saved.status, String(saved.data?.message || "").slice(0, 180));
      return send(res, 503, { error: "The provider accepted the request but the job could not be saved. Contact support with job ID " + jobId + "." });
    }
    return send(res, 202, { id: jobId, status, output: data.output || null, workflow });
  } catch (e) {
    await rpc("finalize_ai_generation", { p_user_id: user.id, p_job_id: jobId, p_prediction_id: null, p_status: "failed" }).catch(() => {});
    console.error("Replicate connection error", e?.message || "unknown");
    return send(res, 502, { error: "Could not complete the AI provider request. Try again later." });
  }
}
