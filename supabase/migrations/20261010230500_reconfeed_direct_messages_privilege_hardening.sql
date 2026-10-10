-- Supabase default grants may include destructive privileges, which RLS
-- does not constrain for TRUNCATE. Give app members the minimum needed:
-- SELECT and INSERT messages; UPDATE ONLY the read_at acknowledgement.
-- The separate RLS policies limit reading to the two participants and
-- acknowledgements to the recipient only.
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
 ON TABLE public.direct_messages FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.direct_messages TO authenticated;
GRANT UPDATE(read_at) ON TABLE public.direct_messages TO authenticated;
