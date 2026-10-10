# ReconFeed real-user research & validation plan

## Status and integrity
The previously supplied profile ("feature interests: none selected; acceptable monthly premium: free only; preferred identity: both") is a **proposed research result / test fixture**, not customer evidence. It must never be included in live response counts. The live database audit found one profile and no posts, likes, comments, follows, or marketplace orders at the time of the audit. No behavioral data currently supports a claim about what ReconFeed users will pay for.

## Survey implementation
- In-app, signed-in tester survey stored in `public.reconfeed_research_responses`.
- One response per authenticated user; they can revise their own response.
- Fields: selected feature interests, acceptable monthly price, preferred identity mode, biggest unmet need, and willingness to test a prototype.
- Choices: avatar cosmetics, creator memberships, live tips/events, AI creator tools, creator marketplace, or "none yet"; monthly price: free, $2.99, $5.99, $9.99; identity: real, avatar, or both.
- No email, date of birth, or profile information is copied into the survey table.
- Row-level security allows each signed-in tester to read, insert, and update only their own response. Anonymous reads/inserts are denied.
- The migration is `supabase/migrations/20261010030000_reconfeed_research_survey.sql`.

## Validation experiment (first 2 weeks)
1. Recruit 30–50 real testers who are not all friends of the founders. Label recruitment source (manual cohort notes, not personal survey fields).
2. Ask testers to use the feed and profile for at least 3 sessions; then complete the survey. Avoid leading language and tell them prices are hypothetical.
3. Run a willingness-to-pay test with a clear feature concept and randomized price exposure across comparable tester groups: Free / $2.99 / $5.99 / $9.99 per month. Do not charge anyone in this experiment.
4. Validate behavior separately from stated preference: measure survey completion, week-one return, creator follows, posts published, and explicit "notify me about this paid beta" opt-ins. Do not treat clicks as purchases.
5. Offer a clearly disclosed, optional paid pilot only after the free survey; record actual checkout conversion separately from survey responses.
6. Interview 5–8 testers across different identity preferences and ask what they would stop using to use ReconFeed instead.

## Decision gates (directional, not statistical proof)
- Minimum useful signal: 30 completed surveys, with recruitment source and tester cohort noted.
- Continue building a paid feature only if at least 20% of respondents select it AND at least 10 testers explicitly opt into a follow-up paid pilot; revisit thresholds after the first cohort.
- Keep core social features free. If "free only" remains the dominant price response, prioritize retention and optional creator monetization over a consumer paywall.
- Prioritize a real/avatar hybrid identity if "both" is the leading response, but validate an avatar-mode prototype with actual use rather than relying on stated preference alone.
- Report sample size, recruitment bias, missing answers, and confidence limits; do not extrapolate a small convenience sample to all social-media users.

## Instrumentation to add next
Record product events without collecting message bodies or sensitive data: `survey_viewed`, `survey_submitted`, `avatar_mode_enabled`, `avatar_post_published`, `creator_followed`, `creator_tool_used`, `pricing_interest_selected`, `paid_pilot_opt_in`. Store event timestamps, user ID, event name, and limited non-sensitive properties under RLS. Keep research responses separate from analytics events and payment records.

## Rollout checklist
- [ ] Apply migration to Supabase production.
- [ ] Deploy updated app build / OTA update and verify a tester can save and edit a response.
- [ ] Verify user A cannot read or modify user B's response and anonymous API access is denied.
- [ ] Recruit first cohort; don't publish conclusions until responses are collected.
- [ ] Review aggregate results weekly and document the decision made from evidence.
