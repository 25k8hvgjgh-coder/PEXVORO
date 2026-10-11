# ReconFeed legal exposure register — 2026-10-10

This is an engineering and public-record risk register, **not an attorney opinion** or worldwide freedom-to-operate clearance.

## Changes implemented
- Public Privacy, Terms of Service, Copyright/IP Complaint, and Community Guideline pages; visible links from main site, beta, marketplace and in-app settings.
- Explicit beta-form terms/privacy acknowledgment and app account-creation checkbox; new account metadata notes policy version and timestamp (technical logging, not a tamper-proof legal ledger).
- Changed video badge from “RECONFEED ORIGINAL” to “RECONFEED COMMUNITY” so user-generated content is not falsely branded as ReconFeed-owned.
- No sweeping trademark renames or feed rewrites based only on superficial web searches.

## Beta terms audit trail
- New beta signups require backend-verified legal acknowledgement; the database records version 2026-10-10 and its acceptance timestamp. Historical beta signups have null terms fields, not retroactive agreement.
- The old anonymous beta RPC was revoked after the new public signup API became live. The replacement terms-audited RPC remains accessible to anonymous beta applicants. Confirmed with Supabase privilege checks; existing tester records were retained.

## Account deletion request feature and operator obligation
- Public /delete-account.html page provides an email-based deletion request path without reinstalling the app; link is in footer/legal navigation.
- In-app Settings > Account > Delete account creates one account-owned deletion request with RLS and a deliberate confirmation. It is NOT automated deletion of the auth user or files.
- Operator must monitor public.account_deletion_requests, verify users, remove content/media and account records appropriately, handle legal holds, and confirm completion. Claims of fully automated deletion or guaranteed store compliance would be premature.
- Apple App Review 5.1.1(v) and Google Play account-deletion policy require working in-app and web paths; their operational fulfillment remains an ongoing responsibility.

## Relevant public-record name and patent screening (not clearance)
- An App Store listing for **Recon: Food, Friends, Fun** (developer Recon Technologies Inc.) describes a social networking experience. Its similar RECON name and related market warrant formal trademark comparison with RECONFEED. https://apps.apple.com/us/app/recon-food-friends-fun/id1554505144 . This is NOT proof of a trademark registration or infringement.
- U.S. Patent 12,563,261 addresses certain threshold-based video-preloading techniques: https://patents.justia.com/patent/12563261 . A technical topic overlap is not infringement; a patent attorney must review independent claims, term/status, jurisdictions and ReconFeed's actual code.
- U.S. Patent 12,489,949 B2 describes video-recommendation information and particular recommendation/comment panels: https://patentsgazette.uspto.gov/week48/OG/html/1541-1/US12489949-20251202.html . A feature resemblance alone does not identify a claim overlap.
- Unsplash and Pexels generally license commercial use of their photos, but releases and third-party rights for people, brands and implied endorsements can require separate consent. Homepage and beta promotional pages now identify stock media as illustrative, and creators confirm rights before post and Story uploads.
- No systematic global trademark register search or complete patent claim chart was completed. There is no basis to claim worldwide clearance or automatically rename the ReconFeed brand.

## Open steps requiring the operator and qualified lawyers
1. Identify exact contracting legal entity, business address, jurisdiction, privacy-controller and authorized point of contact. **Never invent them in published documents**. Confirm support mailbox monitored.
2. Copyright Office DMCA §512(c) agent: register required legal entity, physical address, designated-agent name, street address, phone and email with U.S. Copyright Office. Public-facing agent information must match. Implement operational, logged notices and counter-notices, repeat infringer policy enforcement. Current public contact is not a designated-agent representation.
3. Conduct professional trademark clearance in USPTO federal and U.S. state records, WIPO participating registers, and direct national searches: RECONFEED, RECON FEED, PEXVORO, logos, "More Than a Scroll. It's a Brotherhood" and aliases in relevant classes, with confusion analysis. Do not falsely claim cleared or registered. WIPO forbids automated querying of its Global Brand Database.
4. Patent FTO search, claim chart, assignee and expiry checks by jurisdiction for video recommendation, scroll snap, selective prebuffering, social features and AI generation. Not every short-video implementation infringes a patent. Example patent application US20260006297A1 concerns selective buffering of short-video segments, but pending publication alone does not mean infringement. Counsel must compare specific claims to actual ReconFeed architecture.
5. Confirm all third-party media licences, model terms, sound effects, stock-photo rights, celebrity/appearance releases and music rights. Unsplash/Pexels licensing may permit commercial use, but recognisable brands/persons can impose independent constraints. Add license ledger and takedown response.
6. Finalize national privacy law assessments, political affiliation sensitive-data handling, minimization and genuine disclosure, controller identity, retention windows, deletion fulfillment and legal basis before EU/UK expansion. The beta gate explicitly restricts eligibility by political-party selection, raising consumer/store-policy and potential local law concerns requiring independent review.
7. Implement internal complaint queue and measurable moderation deadlines; make real-world safety enforcement operational, not just policies.
8. Verify app store privacy labels, Apple/Google requirements, consumer terms, accessibility, export, sanctions and tax obligations prior to formal global launch.
9. Legal review and approve published provisional policies. Wording intentionally avoids unverified DMCA safe-harbor status and promises of legal compliance.

## Official references
- USPTO clearance: https://www.uspto.gov/trademarks/search/comprehensive-clearance-search-similar-trademarks
- WIPO Global Brand Database: https://www.wipo.int/en/web/global-brand-database/index
- U.S. Copyright Office agent registration: https://www.copyright.gov/dmca-directory/faq.html
- U.S. patent search: https://patents.google.com/


## Additional disclosure safeguards
- The public Legal/IP Center is now linked from marketing, beta, marketplace and native app Settings.
- Independent veteran ownership does not imply affiliation with federal agencies, military branches or other platforms.
- New post labels say Followers/Only me **in app**, with a clear warning that files still use publicly reachable URLs. This is truthful disclosure, NOT a fix for protected file access. Prioritize private buckets and signed URLs before offering confidential sharing.
- Still outstanding: real operator legal-entity details; DMCA registration; country-specific mark clearance, patent freedom-to-operate review; stock media identity/release ledger; sensitive political-affiliation signup data review.

## FTC creator material-connection safeguard (implemented)
- Added creator-declared `is_promotional` labels to posts and follower Stories without modifying previously published content. Old content defaults to unlabeled; the operator must manually review preexisting promotional material.
- Creator publish forms now ask about sponsorships, free products and affiliate payments, and affected viewers see an explicit "PAID PROMOTION / GIFTED PRODUCT" badge.
- Terms and community rules require meaningful visible disclosure beyond a hidden profile, tag or caption. These flags do not verify the truthfulness of creator statements or replace legal compliance with local ad regulations.
- Reference: https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers

## Marketing-photo rights reduction (October 10, 2026)
- Replaced all direct Unsplash/Pexels stock-image references on `index.html` and `beta.html` with authored CSS olive-and-gold gradient illustrations. This removes reliance on third-party photo/likeness releases for those pages without changing ReconFeed's brand name or the layout.
- Automated legal disclosure tests now reject new external Unsplash/Pexels stock-image URLs on these marketing pages.
- This does **not** certify rights in all existing logo assets, user-uploaded footage, music, imagery used elsewhere in the app, or patent/trademark clearance; those require separate records and review.
