export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body || {};

    const description = String(body.description || "").trim();

    if (description.length < 20) {
      return res.status(400).json({
        error: "Please provide at least 20 characters describing the project."
      });
    }

    const key = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL;

    if (!key || !model) {
      return res.status(503).json({
        error: "AI estimation is not configured yet."
      });
    }

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`
        },
        body: JSON.stringify({
          model,
          input: [
            {
              role: "system",
              content:
                "You are PEXVORO's business automation estimator. Return ONLY valid JSON with keys: summary, package, price_low, price_high, timeline, systems, integrations, workflow, assumptions. price_low and price_high are USD numbers. Arrays contain short strings. Estimates are preliminary and non-binding."
            },
            {
              role: "user",
              content: description
            }
          ]
        })
      }
    );

    if (!response.ok) {
      console.error("OpenAI error:", await response.text());

      return res.status(502).json({
        error: "AI estimation service returned an error."
      });
    }

    const data = await response.json();

    const raw = data.output_text || "";

    const cleaned = raw
      .replace(/^\s*```json\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    let estimate;

    try {
      estimate = JSON.parse(cleaned);
    } catch {
      return res.status(502).json({
        error: "AI returned an invalid estimate format."
      });
    }

    return res.status(200).json({
      summary: String(estimate.summary || ""),
      package: String(
        estimate.package || "Custom Automation"
      ),
      price_low: Number(estimate.price_low || 0),
      price_high: Number(estimate.price_high || 0),
      timeline: String(
        estimate.timeline || "To be scoped"
      ),
      systems: Array.isArray(estimate.systems)
        ? estimate.systems
        : [],
      integrations: Array.isArray(estimate.integrations)
        ? estimate.integrations
        : [],
      workflow: Array.isArray(estimate.workflow)
        ? estimate.workflow
        : [],
      assumptions: Array.isArray(estimate.assumptions)
        ? estimate.assumptions
        : []
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Unable to create estimate."
    });
  }
}
