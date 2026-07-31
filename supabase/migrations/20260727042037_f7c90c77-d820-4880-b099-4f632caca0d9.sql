
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdf_documents TO authenticated;
GRANT ALL ON public.pdf_documents TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.share_links TO authenticated;
GRANT ALL ON public.share_links TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdf_pages TO authenticated;
GRANT ALL ON public.pdf_pages TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.annotations TO authenticated;
GRANT ALL ON public.annotations TO service_role;

GRANT SELECT ON public.viewers TO authenticated;
GRANT ALL ON public.viewers TO service_role;

GRANT SELECT ON public.viewing_sessions TO authenticated;
GRANT ALL ON public.viewing_sessions TO service_role;

GRANT SELECT ON public.page_view_events TO authenticated;
GRANT ALL ON public.page_view_events TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
