# PEXVORO customer-readiness checklist

This branch contains a proposed website intake and usability update. It is not a statement that the site is already production-ready.

## Included in this branch

- Mobile navigation, keyboard focus styles, skip link, reduced-motion preference, and responsive layout improvements.
- More explicit project-intake consent and privacy/terms links.
- A server-side `/api/lead-live` endpoint that validates and stores inquiries in Supabase.
- A minimal `supabase/leads-schema.sql` for the endpoint's `public.leads` table.
- Starter privacy and terms pages. They must be reviewed and completed before public launch.

## Required setup before testing live requests

1. Review `supabase/leads-schema.sql` and run it in the correct Supabase project's SQL Editor.
2. In Vercel, configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as server-only environment variables for the deployment environments you intend to test. Never put the service-role key in browser code.
3. Redeploy after changing environment variables.
4. Submit a test request using an internal test email; verify one row is saved in `public.leads`.
5. Verify invalid emails and missing consent are rejected, and that no public/anonymous table policy allows reading leads.
6. Review Supabase logs and Vercel function logs; do not log customer message bodies or credentials.
7. Add a real monitored privacy contact, confirm data retention/deletion process, and have the privacy policy and terms reviewed for the actual business and applicable law.
8. Verify the AI estimator independently. A previously observed HTTP 401 means the OpenAI credential/access must be fixed and tested before calling the estimator live.
9. Stripe checkout and webhook functionality are not certified by this branch. Do not advertise payments as enabled until end-to-end test-mode payment and webhook verification succeed.
10. Run mobile/desktop, form, accessibility, and production smoke tests after deploying to a staging or preview URL.

## Known boundaries

- No email/SMS notification delivery is implemented in this endpoint; successful storage is the only success condition.
- The API returns a generic service-unavailable message if Supabase configuration is absent.
- Privacy and terms are starter drafts, not legal advice or a substitute for business-specific review.
- This change is isolated on the `customer-readiness` branch for review; it does not modify `main` unless merged.
