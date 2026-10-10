# ReconFeed: product direction, monetization research, and build plan

Last updated: 2026-10-10

## 1. Current database evidence (not market guesses)

A read-only query against the live Supabase project `ojprsyvkzgyphpsvksgx` returned:

| Live table | Rows |
|---|---:|
| profiles | 1 |
| posts | 0 |
| likes | 0 |
| comments | 0 |
| follows | 0 |
| saved_posts | 0 |
| marketplace_listings | 0 |
| marketplace_orders | 0 |
| marketplace_messages | 0 |
| marketplace_saved_listings | 0 |

Activity over the last 30 days: 1 profile created; 0 posts, likes, comments, or marketplace listings/orders.

**Interpretation:** the production database does not yet contain enough user behavior or purchasing activity to infer what ReconFeed users will pay for. Do not label a feature “validated” until real users choose it, pre-order it, or pay for it. Market reports inform hypotheses, not proof of our own customers' intent.

## 2. Strong market hypotheses to test

External creator-commerce research points to creator-led product discovery, video demonstrations, affiliate purchases, live shopping, fan memberships, and digital goods as promising areas. VTubing also has a sizable live audience. These are market signals, not guarantees of ReconFeed conversion.

Priority hypotheses:

1. **Creator memberships** — recurring monthly support for exclusive posts, badges, member-only lives, and community access.
2. **Virtual identity and avatar cosmetics** — avatar frames, outfits, emotes, animated profile effects, and creator-branded digital drops. Keep a free, useful avatar tier.
3. **Live rooms + tips** — viewers can react, ask questions, send transparent tips, and buy creator products during streams. Avoid pay-to-win mechanics.
4. **Creator marketplace / affiliate storefronts** — tagged products, creator links, verified seller pages, and clear commission disclosure.
5. **AI-assisted creator studio** — editing assistance, captions, background removal, avatar expression/scene tools, and content repurposing. Do not advertise generation until a real provider is configured and tested.
6. **Events and real-world connections** — opt-in meetups, local creator events, event tickets, and location-aware discovery with strict privacy controls.

## 3. Product thesis: one social identity, two realities

ReconFeed should not be a pile of copied features. The differentiator is a single identity that can move between real camera content and a virtual persona:

- **Reality mode:** photo/video posts, short clips, stories, profiles, comments, follows, saves, search, direct messages, and live video.
- **Avatar mode:** customizable 2D/3D persona, expression/emote controls, virtual background/scenes, avatar-led posts, and eventually live face/body tracking.
- **Mixed reality:** a creator can switch between camera and avatar, use picture-in-picture, co-host with an avatar, or present the same post in either style. Clearly label AI-generated and virtual media; never imply a virtual avatar is a real person.
- **Creator control:** chronological/following feed option, interest controls, muted topics, “why am I seeing this?”, export/delete tools, and meaningful privacy controls.
- **Community safety:** block/report, comment controls, rate limits, moderation queue, age-appropriate defaults, anti-spam, and seller/report workflows.
- **Commerce built into content:** creator product tags, memberships, digital items, live product demos, saved wishlists, and transparent receipts/refunds.

## 4. What should be built first

### P0 — trustworthy social foundation
- Verify sign-up, email confirmation, sign-in/out, profile creation, feed retrieval, post publishing, media upload, likes, comments, follows, saves, and RLS behavior using two separate test accounts.
- Fix privacy: live database currently exposes `birth_date` and `gender` to the anonymous API probe. Apply and verify the profile column-privilege migration before public growth.
- Remove unnecessary public execution rights from exposed SECURITY DEFINER functions after confirming they are not needed.
- Configure leaked-password protection and resolve the Supabase security advisor findings.
- Configure the server-side AI provider secret; do not embed it in the app.
- Add clear errors, loading/empty states, retries, and accessible touch targets.

### P1 — retention and creator identity
- Stories/temporary posts and vertical short-video feed.
- Search/discovery with followed/chronological and personalized controls.
- Direct messaging and notifications with abuse controls.
- Avatar profile editor, emotes, expression presets, and a simple virtual scene.
- “Reality / Avatar / Mixed” creation mode. Start with static/animated avatar media before real-time 3D tracking.

### P2 — monetization experiments
- Membership waitlist / pricing choice.
- Non-binding interest survey and feature votes.
- Avatar cosmetics preview with explicit “would you buy?” and price sensitivity.
- Creator storefronts and affiliate tracking.
- Live-room tipping and memberships only after trust/safety and payment/receipt/refund flows are implemented.

### P3 — advanced virtual production
- Real-time face tracking and avatar animation.
- Collaborative avatar rooms, co-streaming, virtual stages, scene assets, and creator-owned digital drops.
- Real-time voice/face effects only with clear disclosure and consent.

## 5. How we will discover what users will actually spend money on

Do not infer willingness to pay from likes or survey clicks alone. Record a staged funnel:

1. **Discovery:** user sees a feature card or demo.
2. **Intent:** user taps “Notify me”, selects a feature, or chooses a displayed price.
3. **Commitment:** user joins a waitlist or requests early access.
4. **Purchase:** user completes a real checkout, refund/cancel is tracked, and repeat purchase is measured.

Recommended test groups:
- Memberships: $2.99, $5.99, $9.99 per month.
- Avatar cosmetics: $0.99, $2.99, $5.99 per item/bundle.
- Creator tips: preset $1, $3, $5, plus custom amount.
- Pro creator tools: $4.99, $9.99, $19.99 per month.
- Events: compare free RSVP against paid ticket interest.

These are experimental price points to test, not current product prices or promises. Randomize price presentation where appropriate, keep tests transparent, and measure completed purchases rather than stated preference alone. Never sell sensitive profile data or use birth date/gender for ad targeting.

## 6. Analytics needed

Track only what is needed, with a documented retention policy and no message bodies, passwords, exact location, or sensitive profile values:

- `feed_item_impression`, `video_3s_view`, `video_complete`
- `follow_created`, `post_created`, `comment_created`, `share_created`, `save_created`
- `avatar_editor_opened`, `avatar_preset_selected`, `avatar_exported`
- `feature_interest_selected`, `price_option_selected`, `waitlist_joined`
- `checkout_started`, `purchase_completed`, `refund_completed`, `subscription_cancelled`

Include event time, pseudonymous user ID where signed in, feature/experiment ID, platform, and consent state. Do not collect sensitive values in event properties. Add rate limits and avoid recording analytics until the privacy notice and consent behavior are appropriate.

## 7. Go/no-go gates

- No public launch until profile privacy is verified with anonymous and authenticated API tests.
- No “AI Studio” launch claim until a real provider/model works end to end.
- No payments until server-side verification, webhook idempotency, refund/cancellation, seller identity, and store/platform rules are handled.
- No real-time avatar claims until frame rate, battery, latency, device compatibility, and consent have been tested.
- Do not claim “users want this” until enough users have been exposed to a controlled test and actual conversion is observed.

## Research sources

- [IAB — 2025 Creator Economy Ad Spend & Strategy Report](https://www.iab.com/insights/2025-creator-economy-ad-spend-strategy-report/)
- [Shopify — Social Commerce Trends for 2026](https://www.shopify.com/enterprise/blog/social-commerce-trends)
- [Ogilvy — 2026 Social Trends Report](https://www.ogilvy.com/sites/g/files/dhpsjz106/files/pdfdocuments/2026_Social_Trends_Report.pdf)
- [Deloitte — 2026 Digital Media Trends](https://www.deloitte.com/us/en/insights/industry/technology/digital-media-trends-consumption-habits-survey.html)
- [Streams Charts — VTuber Q1 2026 watch-time report](https://streamscharts.com/news/vtubers-q1-2026-report)
