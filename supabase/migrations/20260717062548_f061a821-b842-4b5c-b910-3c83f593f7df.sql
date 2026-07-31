
-- Profiles
CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles owner read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "profiles owner upsert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles owner update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PDF Documents (original source stored in storage bucket)
CREATE TABLE public.pdf_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_storage_path TEXT NOT NULL,
  page_count INTEGER NOT NULL DEFAULT 0,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdf_documents TO authenticated;
GRANT ALL ON public.pdf_documents TO service_role;
ALTER TABLE public.pdf_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs owner all" ON public.pdf_documents FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX pdf_documents_owner_idx ON public.pdf_documents(owner_id, created_at DESC);

-- Page order/rotation snapshots (for edit workspace)
CREATE TABLE public.pdf_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.pdf_documents ON DELETE CASCADE,
  position INTEGER NOT NULL,
  source_page_index INTEGER NOT NULL,
  rotation INTEGER NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdf_pages TO authenticated;
GRANT ALL ON public.pdf_pages TO service_role;
ALTER TABLE public.pdf_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pages owner all" ON public.pdf_pages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pdf_documents d WHERE d.id = document_id AND d.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pdf_documents d WHERE d.id = document_id AND d.owner_id = auth.uid()));
CREATE INDEX pdf_pages_doc_idx ON public.pdf_pages(document_id, position);

-- Annotations (highlight/strikethrough/note stored as layer)
CREATE TYPE public.annotation_type AS ENUM ('highlight', 'strikethrough', 'note');
CREATE TABLE public.annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.pdf_documents ON DELETE CASCADE,
  page_index INTEGER NOT NULL,
  type public.annotation_type NOT NULL,
  position JSONB NOT NULL,
  content TEXT,
  visible_to_recipients BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.annotations TO authenticated;
GRANT ALL ON public.annotations TO service_role;
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "annotations owner all" ON public.annotations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pdf_documents d WHERE d.id = document_id AND d.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pdf_documents d WHERE d.id = document_id AND d.owner_id = auth.uid()));
CREATE INDEX annotations_doc_page_idx ON public.annotations(document_id, page_index);

-- Share links
CREATE TABLE public.share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.pdf_documents ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  label TEXT,
  recipient_name TEXT,
  recipient_email TEXT,
  password_hash TEXT,
  expires_at TIMESTAMPTZ,
  allow_download BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.share_links TO authenticated;
GRANT ALL ON public.share_links TO service_role;
ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "share_links owner all" ON public.share_links FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX share_links_doc_idx ON public.share_links(document_id);

-- Viewers (anonymous or identified recipient)
CREATE TABLE public.viewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id UUID NOT NULL REFERENCES public.share_links ON DELETE CASCADE,
  anon_id TEXT NOT NULL,
  recipient_name TEXT,
  recipient_email TEXT,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (share_link_id, anon_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.viewers TO authenticated;
GRANT ALL ON public.viewers TO service_role;
ALTER TABLE public.viewers ENABLE ROW LEVEL SECURITY;
-- Only PDF owners can see viewers of their share links
CREATE POLICY "viewers owner read" ON public.viewers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.share_links s WHERE s.id = share_link_id AND s.owner_id = auth.uid()));
CREATE INDEX viewers_share_idx ON public.viewers(share_link_id);

-- Sessions
CREATE TABLE public.viewing_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id UUID NOT NULL REFERENCES public.viewers ON DELETE CASCADE,
  share_link_id UUID NOT NULL REFERENCES public.share_links ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  active_ms INTEGER NOT NULL DEFAULT 0,
  last_page INTEGER,
  completion_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  user_agent TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.viewing_sessions TO authenticated;
GRANT ALL ON public.viewing_sessions TO service_role;
ALTER TABLE public.viewing_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions owner read" ON public.viewing_sessions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.share_links s WHERE s.id = share_link_id AND s.owner_id = auth.uid()));
CREATE INDEX sessions_link_idx ON public.viewing_sessions(share_link_id, started_at DESC);
CREATE INDEX sessions_viewer_idx ON public.viewing_sessions(viewer_id, started_at DESC);

-- Page view events
CREATE TABLE public.page_view_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.viewing_sessions ON DELETE CASCADE,
  page_index INTEGER NOT NULL,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  active_ms INTEGER NOT NULL DEFAULT 0,
  sequence INTEGER NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_view_events TO authenticated;
GRANT ALL ON public.page_view_events TO service_role;
ALTER TABLE public.page_view_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "page_events owner read" ON public.page_view_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.viewing_sessions vs
    JOIN public.share_links s ON s.id = vs.share_link_id
    WHERE vs.id = session_id AND s.owner_id = auth.uid()
  ));
CREATE INDEX page_events_session_idx ON public.page_view_events(session_id, sequence);

-- Helper trigger for updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER pdf_documents_touch BEFORE UPDATE ON public.pdf_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
