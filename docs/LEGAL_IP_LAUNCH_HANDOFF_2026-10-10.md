# ReconFeed — final legal and IP launch handoff
Updated: October 10, 2026

This is an engineering risk assessment and operational checklist, not a legal opinion or worldwide trademark/patent clearance certificate.

## Completed in repository or live settings
- Public privacy, terms, copyright/IP complaints, guidelines, account deletion and legal/IP pages, linked from the website and app.
- Legal acknowledgment in beta signup, media-rights confirmation in creator upload flow, and sponsorship labels.
- First-party olive-green placeholders in default app screens instead of hard-coded Unsplash/Pexels stock imagery.
- New signups no longer persist beta political-party selection in Auth metadata. Temporary browser session state and previously stored metadata require separate review.
- Browser security headers, including a Permissions-Policy that permits first-party camera/microphone while restricting unused geolocation.
- Regression tests for legal page visibility, sensitive-party metadata retention and stock-image dependencies.

## Last remaining approvals and operator work
Keep these until after engineering changes. **Do not publish invented names, addresses or registration statuses.**

1. **Verified business/operator identity** — insert confirmed contracting legal entity, accurate privacy controller and business contact information into policies where applicable. Verify that `reconfeed@reconfeed.com` is monitored. A generic inbox is not the same as a registered DMCA designated agent.
2. **DMCA designated agent** — register actual organization, address, agent name, phone and email at https://www.copyright.gov/dmca-directory/ and publish the details. Operationally log and act on takedown notices/counter-notices and enforce a repeat-infringer policy. The public IP contact page expressly disclaims completed designation.
3. **Comprehensive trademark clearance** — search RECONFEED, RECON FEED, PEXVORO, the emblem and slogans, plus confusingly similar marks, for social-networking software, media/entertainment and relevant services. Check federal, state, common-law, and each proposed international jurisdiction. The USPTO specifically warns that exact-name-only searching is not enough: https://www.uspto.gov/trademarks/search/comprehensive-clearance-search-similar-trademarks; https://www.wipo.int/en/web/global-brand-database/index.
4. **Patent freedom to operate** — retain patent counsel to map *specific live claims* to ReconFeed's actual implementation and jurisdictions for feed ranking, video preload, editing, messaging and AI tools. Similarity of an idea to a patent abstract is not proof of infringement. https://patents.google.com/.
5. **Sensitive political beta eligibility** — seek privacy, store-policy and local-law review of the existing political-party question and eligibility restriction. Political-opinion data is specially protected in several jurisdictions. The new metadata minimization does not legalize the underlying selection practice; legacy metadata also requires an authorized minimization/deletion decision.
6. **Private media** — currently certain post files use public URLs, so "followers/private in app" does not make raw files confidential. Migrate to private storage/signed URLs before representing follower-only post media as secure. Do not flip the existing bucket private without rewriting clients and migrating data.
7. **Account-deletion fulfillment** — regularly process `public.account_deletion_requests`, remove related Auth and Storage data, confirm deletion to the verified user, and log exceptions. See `docs/ACCOUNT_DELETION_OPERATIONS.md`. Apple requires an actual process, not merely a form: https://developer.apple.com/support/offering-account-deletion-in-your-app/.
8. **Owned-media evidence** — verify assignments and commercial-use rights for the ReconFeed emblem, promo song/audio, fonts, effects, AI-generated content and third-party footage. Hold a rights ledger with sources, author/rights owner, license, permitted uses and proof of purchase/permission.
9. **Global expansion** — review international privacy-controller requirements, sensitive data, local representatives, data transfers, content moderation, consumer terms, accessibility, sanctions, age assurance, export/payment/tax requirements before targeting those markets.

## Engineering verification for this handoff
Confirm production build/CI tests pass on the final commit. Check live legal page links, app Settings legal links, responsive pages, Supabase RLS and storage visibility, and registration/deletion operations with consenting testers. None of this alone establishes jurisdiction-wide legal compliance.

**Risk treatment rule:** avoid renaming the ReconFeed brand or rewriting algorithmic features until a verified confusing mark or asserted patent claim and a qualified review establish a concrete reason.
