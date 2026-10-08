export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const name = String(body.name || "").trim();
    const business = String(body.business || "").trim();
    const email = String(body.email || "").trim();
    const contact = String(body.contact || "Email").trim();
    const description = String(body.description || "").trim();
    const estimate = body.estimate && typeof body.estimate === "object" ? body.estimate : null;

    if (!name || !email || !description) {
      return res.status(400).json({ error: "Name, email, and project description are required." });
    }
    if (name.length > 120 || business.length > 160 || email.length > 254 || description.length > 10000) {
      return res.status(400).json({ error: "One or more fields are too long." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Please provide a valid email address." });
    }

    const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
    const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
    if (!supabaseUrl || !serviceKey) {
      console.error("Lead database configuration missing.");
      return res.status(503).json({ error: "Project requests are temporarily unavailable. Please try again later." });
    }

    const response = await fetch(supabaseUrl + "/rest/v1/leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceKey,
        "Authorization": "Bearer " + serviceKey,
        "Prefer": "return=representation"
      },
      body: JSON.stringify({
        name,
        business,
        email,
        contact_method: contact,
        description,
        estimate
      })
    });

    const responseText = await response.text();
    if (!response.ok) {
      console.error("Supabase lead insert failed:", response.status, responseText.slice(0, 1000));
      return res.status(502).json({ error: "We couldn't save your request right now. Please try again later." });
    }

    let rows = [];
    try { rows = JSON.parse(responseText); } catch {}
    const lead = Array.isArray(rows) ? (rows[0] || {}) : {};

    if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM && process.env.OWNER_EMAIL) {
      const html = [
        "<h2>New PEXVORO Project Request</h2>",
        "<p><b>Name:</b> " + escapeHtml(name) + "</p>",
        "<p><b>Business:</b> " + escapeHtml(business || "Not provided") + "</p>",
        "<p><b>Email:</b> " + escapeHtml(email) + "</p>",
        "<p><b>Preferred contact:</b> " + escapeHtml(contact) + "</p>",
        "<p><b>Request:</b><br>" + escapeHtml(description).replace(/\n/g, "<br>") + "</p>",
        "<p><b>Estimate:</b> " + escapeHtml(JSON.stringify(estimate || {})) + "</p>"
      ].join("");
      try {
        const mail = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + process.env.RESEND_API_KEY
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM,
            to: [process.env.OWNER_EMAIL],
            subject: "New PEXVORO lead: " + (business || name),
            html
          })
        });
        if (!mail.ok) console.error("Resend notification failed:", mail.status, (await mail.text()).slice(0, 500));
      } catch (mailError) {
        console.error("Resend notification error:", mailError);
      }
    }

    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_FROM_NUMBER && process.env.OWNER_PHONE) {
      try {
        const params = new URLSearchParams({
          To: process.env.OWNER_PHONE,
          From: process.env.TWILIO_FROM_NUMBER,
          Body: "New PEXVORO lead: " + (business || name) + " — " + email
        });
        const auth = Buffer.from(process.env.TWILIO_ACCOUNT_SID + ":" + process.env.TWILIO_AUTH_TOKEN).toString("base64");
        const sms = await fetch("https://api.twilio.com/2010-04-01/Accounts/" + process.env.TWILIO_ACCOUNT_SID + "/Messages.json", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": "Basic " + auth
          },
          body: params.toString()
        });
        if (!sms.ok) console.error("Twilio notification failed:", sms.status, (await sms.text()).slice(0, 500));
      } catch (smsError) {
        console.error("Twilio notification error:", smsError);
      }
    }

    return res.status(200).json({ ok: true, lead_id: lead.id || null });
  } catch (error) {
    console.error("Lead handler error:", error);
    return res.status(500).json({ error: "Unable to process your request. Please try again later." });
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[character]));
}
