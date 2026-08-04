CREATE TABLE IF NOT EXISTS public.email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  sender text NOT NULL,
  audience text NOT NULL,
  recipients text[] NOT NULL DEFAULT '{}',
  subject text NOT NULL,
  format text NOT NULL DEFAULT 'html',
  status text NOT NULL DEFAULT 'sending',
  provider_ids text[] NOT NULL DEFAULT '{}',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_messages
  ADD COLUMN IF NOT EXISTS communication_type text NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS preview_text text,
  ADD COLUMN IF NOT EXISTS attachment_names text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tracking_status text NOT NULL DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS tracking_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sent_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read email history" ON public.email_messages;
CREATE POLICY "Admins read email history" ON public.email_messages FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE INDEX IF NOT EXISTS email_messages_created_at_idx ON public.email_messages(created_at DESC);
