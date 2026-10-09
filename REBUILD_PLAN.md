# PEXVORO — AI Creative Studio Rebuild

Status: architecture and product specification; NOT deployed. The production main branch remains unchanged.

## Product direction
PEXVORO is a subscription-based creative platform for:
1. Text-to-video generation.
2. Image-to-video animation.
3. AI-assisted editing of uploaded videos (model availability dependent).
4. AI photo generation, retouching, and transformations.
5. Asset library, download history, and saved projects.

Do not advertise a feature as working until its API provider and integration have been tested.

## UX
- New responsive dark editorial design, cinematic previews, approachable creator workflow.
- Homepage: hero, before/after demos, workflow, capabilities, examples, pricing, FAQs.
- Authenticated workspace: projects, create video, animate photo, edit image, edit video, billing, usage, settings.
- Accessible UI, mobile-first upload and progress views.
- Clear ownership, acceptable-use and privacy messaging for customer uploads.

## Architecture
- Frontend: Next.js + TypeScript with server-side API routes.
- Identity and database: Supabase Auth + Postgres with RLS on user-owned data.
- Private media: Supabase Storage with signed URLs and lifecycle cleanup.
- Billing: Stripe subscriptions and verified webhooks; no client-side trust of payment status.
- AI inference: provider adapter interface (Runway/fal or other), asynchronous job queue, polling/webhook callbacks, retries and idempotency.
- Usage ledger: reserve credits atomically before submitting jobs, settle actual usage after success, release reservations on failures.
- Moderation and consent checks for face/likeness edits; block impersonation and nonconsensual sexual content.
- Protect provider keys and service-role secrets server-side only; strict upload size and MIME checks, rate limiting, spending ceilings.
- Observability: structured logs, error handling, cost per job, billing reconciliation.

## Proposed launch plans (draft, subject to live provider cost testing)
- Free preview: $0/mo, limited demo tools only; NO unbounded paid inference.
- Creator: $19/mo, 600 platform credits.
- Pro: $49/mo, 1,800 platform credits.
- Studio: $99/mo, 4,000 platform credits.
- Top-ups: only after per-model unit economics and Stripe billing are tested.
Credits are PLATFORM credits, not provider credits. Define conversion rates per model and generation settings using cost plus a margin and overhead reserve. Never promise unlimited video creation.

Illustrative costing rule:
retail credits charged = ceil((provider USD cost + expected storage/payment overhead) / target USD value per platform credit).
Keep per-model prices in a server-controlled rate table; reserve based on maximum possible cost, then reconcile.

## Rollout and validation
1. Build new app in this branch; keep existing main as rollback.
2. Implement authenticated UI and mock generation workflow without paid API calls.
3. Add migrations and RLS; test cross-user access and signed uploads.
4. Connect billing in Stripe test mode; verify webhook signature, subscription state, failed payments.
5. Connect inference provider only after credentials/billing approval; cap per-user and global spend.
6. Test mobile, upload validation, job failures, retries, accessibility and security.
7. Deploy preview; switch production only after acceptance and end-to-end verification.

## Known old-site issue
The old index.html invokes /api/lead-live but that endpoint was reverted on main. The replacement must not depend on this route; migrate lead capture to a tested, authenticated or rate-limited API.

## Constraints
No new purchases, subscriptions, paid API calls or production cutover without owner approval. Existing secrets must never be committed.
