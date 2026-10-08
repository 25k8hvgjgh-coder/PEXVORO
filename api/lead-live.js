export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin && host) {
    try {
      const parsedOrigin = new URL(origin);
      if (parsedOrigin.host !== host) {
        return res.status(403).json({ error: "Request origin not allowed." });
      }
    } catch {
      return res.status(403).json({ error: "Request origin not allowed." });
    }
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const field = (name, max = 2000) => String(body[name] ?? "").trim().slice(0, max);
    const name = field("name", 120);
    const business = field("business", 160);
    const email = field("email", 254).toLowerCase();
    const problem = field("problem", 4000) || field("description", 4000);
    const automation = field("automation", 4000) || field("notes", 4000);
    const description = [problem, automation]
      .filter(Boolean).join("\n\nAdditional details: ");
    const consent = body.consent === true;

    if (!name || !business || !email || !description) {
      return res.status(400).json({ error: "Please complete your name, business, email, and project details." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }
    if (!consent) {
      return res.status(400).json({ error: "Please agree to the Privacy Policy before submitting." });
    }

    const supabaseUrl = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
    const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    if (!supabaseUrl || !serviceKey) {
      console.error("Project intake unavailable: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.");
      return res.status(503).json({ error: "Project requests are not available yet. Please try again later." });
    }

    const record = {
      name,
      business,
      email,
      business_type: field("business_type", 160),
      problem: field("problem", 4000) || field("description", 4000),
      current_software: field("current_software", 500),
      contact: ["Email", "Website message", "Either"].includes(field("contact", 40)) ? field("contact", 40) : "Email",
      automation: field("automation", 4000) || field("notes", 4000),
      budget: field("budget", 80),
      package: field("package", 120),
      description,
      consent,
      status: "new"
    };

    const response = await fetch(supabaseUrl + "/rest/v1/leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceKey,
        "Authorization": "Bearer " + serviceKey,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(record)
    });

    if (!response.ok) {
      const details = await response.text();
      console.error("Project intake database insert failed:", response.status, details);
      return res.status(502).json({ error: "We could not save your request right now. Please try again later." });
    }

    return res.status(201).json({ ok: true, message: "Project request received." });
  } catch (error) {
    console.error("Project intake handler error:", error);
    return res.status(400).json({ error: "We could not process that request. Please check the fields and try again." });
  }
}
