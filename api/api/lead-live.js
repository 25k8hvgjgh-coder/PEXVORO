export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body || {};

    const name = String(body.name || "").trim();
    const business = String(body.business || "").trim();
    const email = String(body.email || "").trim();
    const contact = String(body.contact || "Email").trim();
    const description = String(body.description || "").trim();
    const estimate = body.estimate || null;

    if (!name || !email || !description) {
      return res.status(400).json({
        error: "Name, email, and project description are required."
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return res.status(503).json({
        error: "Lead database is not configured yet."
      });
    }

    const response = await fetch(
      `${supabaseUrl.replace(/\/$/, "")}/rest/v1/leads`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
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
      }
    );

    const responseText = await response.text();

    if (!response.ok) {
      console.error("Supabase error:", responseText);

      return res.status(502).json({
        error: "Lead could not be saved."
      });
    }

    let rows = [];

    try {
      rows = JSON.parse(responseText);
    } catch {}

    const lead = rows[0] || {};

    if (
      process.env.RESEND_API_KEY &&
      process.env.EMAIL_FROM &&
      process.env.OWNER_EMAIL
    ) {
      const html = `
        <h2>New PEXVORO Project Request</h2>
        <p><b>Name:</b> ${escapeHtml(name)}</p>
        <p><b>Business:</b> ${escapeHtml(business)}</p>
        <p><b>Email:</b> ${escapeHtml(email)}</p>
        <p><b>Contact preference:</b> ${escapeHtml(contact)}</p>
        <p><b>Request:</b><br>
        ${escapeHtml(description).replace(/\n/g, "<br>")}</p>
        <p><b>Estimate:</b>
        ${escapeHtml(JSON.stringify(estimate || {}))}</p>
      `;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.RESEND_API_KEY}`
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM,
          to: [process.env.OWNER_EMAIL],
          subject: `New PEXVORO lead: ${business || name}`,
          html
        })
      });
    }

    if (
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER &&
      process.env.OWNER_PHONE
    ) {
      const params = new URLSearchParams({
        To: process.env.OWNER_PHONE,
        From: process.env.TWILIO_FROM_NUMBER,
        Body: `New PEXVORO lead: ${business || name} — ${email}`
      });

      const auth = Buffer
        .from(
          `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
        )
        .toString("base64");

      await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${auth}`
          },
          body: params.toString()
        }
      );
    }

    return res.status(200).json({
      ok: true,
      lead_id: lead.id || null
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Unable to process project request."
    });
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}
