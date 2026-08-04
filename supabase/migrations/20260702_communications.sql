-- Communication preferences, native push tokens, and email audit history.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_notifications_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  device_type text NOT NULL CHECK (device_type IN ('ios', 'android', 'web')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS push_tokens_user_device_idx
  ON public.push_tokens(user_id, device_type);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own push tokens" ON public.push_tokens;
CREATE POLICY "Users manage own push tokens"
  ON public.push_tokens FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  sender text NOT NULL CHECK (sender IN ('noreply@dritchwear.com', 'support@dritchwear.com')),
  audience text NOT NULL CHECK (audience IN ('individual', 'customers')),
  recipients text[] NOT NULL DEFAULT '{}',
  subject text NOT NULL,
  format text NOT NULL CHECK (format IN ('text', 'html')),
  status text NOT NULL CHECK (status IN ('sending', 'sent', 'partial', 'failed')),
  provider_ids text[] NOT NULL DEFAULT '{}',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read email history" ON public.email_messages;
CREATE POLICY "Admins read email history"
  ON public.email_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));
