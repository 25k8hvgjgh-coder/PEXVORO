export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
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