# PEXVORO Morning Brief and Marketplace Requirements

## Morning news videos
- Every morning, prepare a short news-video collection for each user's feed.
- Insert news videos naturally among regular posts; never force autoplay, interrupt a post, or block scrolling.
- Show a clear News label, publication time, publisher/source, and links to original reporting.
- Use a scheduled backend job to gather trusted sources, summarize verified stories, and generate a short narrated video only when the news-generation provider is configured.
- Avoid fabricated footage or quotes. Label AI narration/visuals, preserve source attribution, and include correction handling.
- Deduplicate stories, respect rights and source terms, and use a configurable local timezone and delivery window.
- News content is not implemented merely by documenting this requirement; a scheduler, source integration, generation provider, database storage, and feed insertion are needed.

## Marketplace seller flow
- Keep seller onboarding short: item name, category, condition, price, photos, shipping/pickup, and item details.
- Offer AI-assisted title, description, category suggestions, and checklist completion; the seller must review and approve all generated details before publishing.
- Before a seller publishes, show this disclosure: PEXVORO retains a 10% platform fee on each completed sale; the seller receives the remaining 90% before payment-provider fees, taxes, refunds, chargebacks, or other disclosed adjustments.
- Show a price breakdown before confirmation, for example a 100-dollar sale yields a 10-dollar platform fee and 90 dollars before other costs.
- Collect fees through server-side payment processing and verified payment webhooks. Never trust a client-side fee calculation as the source of truth.
- Support listing moderation, prohibited items, seller support, order status, refunds/disputes, and seller payout onboarding.
- Do not claim automatic fee collection or AI generation is live until integrations are implemented and tested.

## Acceptance criteria
- Morning news appears as optional feed items, not a forced interstitial, and can be muted.
- News has provenance and no unverified story is presented as fact.
- A seller can generate, edit, preview, and publish a listing; AI output is always editable.
- The 10% fee is visible before publication and checkout, calculated server-side, recorded per order, and reconciled against payment-provider webhooks.
- Test successful, failed, refunded, and disputed orders before launch.
