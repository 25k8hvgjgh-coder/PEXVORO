export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const description = String(body.description || "").trim();

    if (description.length < 20) {
      return res.status(400).json({
        error: "Please provide at least 20 characters describing the project."
      });
    }

    const key = String(process.env.OPENAI_API_KEY || "").trim();
    const model = String(process.env.OPENAI_MODEL || "").trim();
    const missing = [];
    if (!key) missing.push("OPENAI_API_KEY");
    if (!model) missing.push("OPENAI_MODEL");

    if (missing.length) {
      console.error("Missing required environment variables:", missing.join(", "));
      return res.status(503).json({
        error: "Server configuration is missing: " + missing.join(", ")
      });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + key
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: "You are PEXVORO's business automation estimator. Return ONLY valid JSON with keys: summary, package, price_low, price_high, timeline, systems, integrations, workflow, assumptions. price_low and price_high are USD numbers. Arrays contain short strings. Estimates are preliminary and non-binding."
          },
          { role: "user", content: description }
        ]
      })
    });

    if (!response.ok) {
      const upstreamError = await response.text();
      console.error("OpenAI API error status:", response.status, "body:", upstreamError);

      let message = "OpenAI request failed (HTTP " + response.status + ").";
      if (response.status === 401 || response.status === 403) {
        message += " Check that the API key is valid and has API access.";
      } else if (response.status === 404) {
        message += " Check that OPENAI_MODEL is an available model for this API key.";
      } else if (response.status === 429) {
        message += " Check API billing, quota, or rate limits.";
      }
      return res.status(502).json({ error: message });
    }

    const data = await response.json();
    const raw = String(data.output_text || "");
    const cleaned = raw
      .replace(/^\s*\x60{3}json\s*/i, "")
      .replace(/\s*\x60{3}\s*$/i, "")
      .trim();

    let estimate;
    try {
      estimate = JSON.parse(cleaned);
    } catch {
      console.error("OpenAI returned content that was not valid JSON.");
      return res.status(502).json({
        error: "AI returned an invalid estimate format. Please retry."
      });
    }

    return res.status(200).json({
      summary: String(estimate.summary || ""),
      package: String(estimate.package || "Custom Automation"),
      price_low: Number(estimate.price_low || 0),
      price_high: Number(estimate.price_high || 0),
      timeline: String(estimate.timeline || "To be scoped"),
      systems: Array.isArray(estimate.systems) ? estimate.systems : [],
      integrations: Array.isArray(estimate.integrations) ? estimate.integrations : [],
      workflow: Array.isArray(estimate.workflow) ? estimate.workflow : [],
      assumptions: Array.isArray(estimate.assumptions) ? estimate.assumptions : []
    });
  } catch (error) {
    console.error("Estimate handler error:", error);
    return res.status(500).json({
      error: "Unable to create estimate. Check the Vercel function logs."
    });
  }
}
