const allowed = new Set(["text-video", "image-video", "image", "video-transform"]);
const send = (res, status, body) => res.status(status).json(body);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Method not allowed" });
  }
  const token = String(process.env.REPLICATE_API_TOKEN || "").trim();
  if (!token) return send(res, 503, { error: "AI generation is not configured yet.", missing: ["REPLICATE_API_TOKEN", "REPLICATE_VIDEO_MODEL and/or REPLICATE_IMAGE_MODEL"] });

  let body = req.body;
  try { if (typeof body === "string") body = JSON.parse(body); } catch { return send(res, 400, { error: "Request body must be valid JSON." }); }
  body = body && typeof body === "object" ? body : {};
  const workflow = String(body.workflow || "text-video");
  const prompt = String(body.prompt || "").trim();
  if (!allowed.has(workflow)) return send(res, 400, { error: "Unsupported workflow." });
  if (prompt.length < 8 || prompt.length > 1500) return send(res, 400, { error: "Prompt must be between 8 and 1,500 characters." });

  const imageOnly = workflow === "image";
  const model = String((imageOnly ? process.env.REPLICATE_IMAGE_MODEL : process.env.REPLICATE_VIDEO_MODEL) || "").trim();
  if (!/^[a-z0-9_-]+\/[a-z0-9_.-]+$/i.test(model)) return send(res, 503, { error: "A compatible generation model is not configured for this workflow." });
  const duration = Number(body.duration || 5);
  if (![5, 10, 15].includes(duration)) return send(res, 400, { error: "Duration must be 5, 10, or 15 seconds." });
  const aspect = ["9:16", "16:9", "1:1"].includes(body.aspectRatio) ? body.aspectRatio : "9:16";
  // Replicate model input schemas differ. Configure a model compatible with these generic inputs,
  // and validate with private tests before opening generation to customers.
  const input = { prompt, aspect_ratio: aspect };
  if (!imageOnly) input.duration = duration;
  try {
    const upstream = await fetch("https://api.replicate.com/v1/models/" + model + "/predictions", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", Prefer: "wait=1" },
      body: JSON.stringify({ input })
    });
    const raw = await upstream.text();
    let data = {};
    try { data = JSON.parse(raw); } catch {}
    if (!upstream.ok) {
      console.error("Replicate generation error", upstream.status, String(data.detail || data.title || "provider error"));
      return send(res, upstream.status === 429 ? 429 : 502, { error: upstream.status === 429 ? "AI provider rate limit reached. Try again later." : "The AI provider rejected this request. Check the configured model and its input schema." });
    }
    return send(res, 202, { id: data.id, status: data.status || "starting", output: data.output || null, statusUrl: data.urls?.get || null, workflow });
  } catch (e) {
    console.error("Replicate connection error", e?.message || "unknown");
    return send(res, 502, { error: "Could not reach the AI provider." });
  }
}