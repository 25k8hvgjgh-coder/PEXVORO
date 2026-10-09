# PEXVORO

Responsive app-style AI video and image creation prototype: creator feed, AI Studio, editor concept, templates, drafts, profile, inbox, and proposed memberships.

## Current status
- Front-end interactions and local media preview run in the browser.
- Server-side AI endpoint foundation is present but requires a compatible Replicate model and secret token.
- Authentication, cloud storage, public publishing, durable credit ledger, and payment checkout are not enabled.
- Membership prices and credits are proposals, not active offers.

## Configure AI generation
In Vercel Project Settings → Environment Variables, add:
- `REPLICATE_API_TOKEN`: secret token, server-side only.
- `REPLICATE_VIDEO_MODEL`: a compatible Replicate model in `owner/model-name` format.
- `REPLICATE_IMAGE_MODEL`: optional image model in the same format.

The initial adapter passes `prompt`, `aspect_ratio`, and video `duration`; Replicate models have different input schemas, so choose compatible models and test privately before opening the feature to customers. Do not advertise paid generation yet: authentication, per-user rate limits, credit debit/refunds, upload handling, content moderation, and cost controls are still required.

## Endpoints
- `GET /api/health`: shows whether service environment variables are present. Does not test a real generation.
- `POST /api/generate`: starts a generation.
- `GET /api/generation-status?id=...`: returns provider status/output.

## Security
Never commit API tokens to GitHub or expose them in browser code. Do not use a Supabase service-role key in a browser. Stripe checkout should remain disabled until signed webhook verification, server-side product/price mapping, subscription lifecycle handling, and a durable credit ledger are implemented.
