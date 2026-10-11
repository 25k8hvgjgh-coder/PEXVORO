# ReconFeed account deletion — operator playbook (manual beta workflow)

The account-deletion intake is now in-app and published on the website, but **no automatic data erasure runs** merely because someone clicks the button. Apple and Google require an active process that leads to deletion of the account and associated personal data, not just deactivation.

## Regular queue review
1. Every business day review pending requests in Supabase SQL Editor:
   \`SELECT id,user_id,requested_at,status FROM public.account_deletion_requests WHERE status IN ('pending','in_review') ORDER BY requested_at ASC;\`
2. Compare the request user ID against Supabase Authentication users; use the account's verified email to confirm identity and request scope. **Never ask for their password.**
3. Mark \`in_review\` via authorized operator access, not by changing row-level security to allow users to modify requests.
4. Identify uploads and account records associated with the user. Check auth.users, profiles, posts, post-media Storage files, private Story media, tester screenshots, feed events, direct messages, likes/comments, marketplace listings, blocked accounts, generated AI media, and any payment records. Do not assume every foreign key cascades or that deleting rows also deletes Storage objects.
5. Remove Storage objects via authorized Supabase Storage APIs before deleting dependent Auth/SQL records. Consider lawful transaction, abuse/safety and financial retention requirements. Keep only the minimum data lawfully necessary.
6. Delete the Auth user through an authorized Supabase Admin operation only after the associated data removal is complete and verified. Do not use SQL to bypass safety rules. Record a minimal deletion confirmation and date with lawful retention.
7. Confirm completion to the verified account email and record completion in a controlled operator log. If a request cannot be fulfilled yet, explain the lawful reason and next steps. Target completion within 30 days or sooner where required.

## Security and privacy
- RLS lets signed-in users submit and view only their own request. They cannot delete, amend or read another person's request. Only authorized service operations can triage requests.
- Anyone without a signed-in account may start a deletion request via \`https://reconfeed.com/delete-account.html\` using their registered account email. Verify that email before acting.
- Do not confuse this intake with completed deletion. Monitor it until closed; have a trained backup operator.
- Verify Apple App Store and Google Play declarations match actual behavior. Review with counsel and privacy professionals before global scale.
