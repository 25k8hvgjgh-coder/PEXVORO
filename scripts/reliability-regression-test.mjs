import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const [app,inbox,reports,pwa,smoke,migration]=await Promise.all([
 read('mobile/App.tsx'),read('mobile/SocialInbox.tsx'),read('mobile/TesterReports.tsx'),
 read('sw.js'),read('scripts/supabase-smoke.js'),
 read('supabase/migrations/20261010225500_reconfeed_direct_message_unread_receipts.sql')
]);
assert.match(app,/unreadMessages/);
assert.match(app,/\.eq\('recipient_id',userId\)\.is\('read_at',null\)/);
assert.match(app,/onUnreadChange=\{refreshUnreadMessages\}/);
assert.match(inbox,/read_at:string\|null/);
assert.match(inbox,/\.eq\('recipient_id',userId\)\.eq\('sender_id',peer\.id\)\.is\('read_at',null\)/);
assert.match(inbox,/unreadByPeer\.set/);
assert.match(reports,/const user=await client\.auth\.getUser\(\)/);
assert.match(pwa,/reconfeed-shell-reference-v4/);
assert.match(smoke,/worker\.includes\('reconfeed-shell-reference-v4'\)/);
assert.match(migration,/GRANT UPDATE\(read_at\)/);
assert.match(migration,/FOR UPDATE TO authenticated/);
console.log('Unread-message, recipient-only acknowledgement, report auth, and PWA freshness contracts passed');
