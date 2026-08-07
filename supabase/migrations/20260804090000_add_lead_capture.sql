ALTER TABLE public.share_links
  ADD COLUMN IF NOT EXISTS require_lead_capture boolean NOT NULL DEFAULT false;
