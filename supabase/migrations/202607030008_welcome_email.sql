CREATE TABLE IF NOT EXISTS public.welcome_email_deliveries (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  resend_email_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.welcome_email_deliveries ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.dispatch_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.email_confirmed_at IS NULL) THEN
    INSERT INTO public.welcome_email_deliveries (user_id, email, status)
    VALUES (NEW.id, NEW.email, 'pending')
    ON CONFLICT (user_id) DO NOTHING;

    PERFORM net.http_post(
      url := 'https://nkftulouqozzaxiezbvr.supabase.co/functions/v1/send-welcome-email',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := jsonb_build_object('userId', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dispatch_welcome_email_after_confirmation ON auth.users;
CREATE TRIGGER dispatch_welcome_email_after_confirmation
AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.dispatch_welcome_email();

CREATE OR REPLACE FUNCTION public.set_welcome_email_delivery_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS welcome_email_deliveries_updated_at ON public.welcome_email_deliveries;
CREATE TRIGGER welcome_email_deliveries_updated_at
BEFORE UPDATE ON public.welcome_email_deliveries
FOR EACH ROW EXECUTE FUNCTION public.set_welcome_email_delivery_updated_at();
