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
