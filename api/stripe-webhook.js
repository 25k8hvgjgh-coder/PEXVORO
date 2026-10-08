export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({
      error: "Stripe webhook is not configured yet."
    });
  }

  return res.status(501).json({
    error: "Stripe webhook foundation installed.",
    message:
      "Stripe payment-event verification must be enabled before production payment events are processed."
  });
}
