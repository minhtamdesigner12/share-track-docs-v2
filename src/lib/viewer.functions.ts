import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SLUG_RE = /^[a-f0-9]{16,64}$/;

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Resolve a public share slug into viewable document metadata.
 * Public endpoint — anyone with a valid slug can fetch metadata & signed URL.
 * Enforces password and expiration.
 */
export const resolveShareLink = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      slug: string;
      password?: string;
      leadName?: string;
      leadEmail?: string;
    }) =>
      z
        .object({
          slug: z.string().regex(SLUG_RE),
          password: z.string().max(200).optional(),
          leadName: z.string().trim().min(1).max(120).optional(),
          leadEmail: z.string().trim().max(200).email().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link, error } = await supabaseAdmin
      .from("share_links")
      .select(
        "id, document_id, slug, label, allow_download, expires_at, is_active, password_hash, require_lead_capture",
      )
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!link || !link.is_active) return { error: "not_found" as const };
    if (link.expires_at && new Date(link.expires_at).getTime() < Date.now())
      return { error: "expired" as const };
    // Lead capture is checked before the password gate, so a recipient always
    // identifies themselves first, then unlocks with the password if one is set.
    if (link.require_lead_capture && (!data.leadName || !data.leadEmail))
      return { error: "lead_required" as const };
    if (link.password_hash) {
      if (!data.password) return { error: "password_required" as const };
      if ((await sha256Hex(data.password)) !== link.password_hash)
        return { error: "password_wrong" as const };
    }
    const { data: doc } = await supabaseAdmin
      .from("pdf_documents")
      .select("id, name, page_count, source_storage_path")
      .eq("id", link.document_id)
      .single();
    if (!doc) return { error: "not_found" as const };
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("pdfs")
      .createSignedUrl(doc.source_storage_path, 60 * 60);
    if (sErr || !signed) throw new Error(sErr?.message ?? "sign failed");
    return {
      ok: true as const,
      shareLinkId: link.id,
      documentId: doc.id,
      docName: doc.name,
      pageCount: doc.page_count,
      allowDownload: link.allow_download,
      label: link.label,
      signedUrl: signed.signedUrl,
    };
  });

export const startViewSession = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      shareLinkId: string;
      anonId: string;
      userAgent?: string;
      leadName?: string;
      leadEmail?: string;
    }) =>
      z
        .object({
          shareLinkId: z.string().uuid(),
          anonId: z.string().min(4).max(80),
          userAgent: z.string().max(500).optional(),
          leadName: z.string().trim().min(1).max(120).optional(),
          leadEmail: z.string().trim().max(200).email().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin
      .from("share_links")
      .select("id, is_active, expires_at, require_lead_capture")
      .eq("id", data.shareLinkId)
      .maybeSingle();
    if (!link || !link.is_active) throw new Error("Invalid link");
    if (link.expires_at && new Date(link.expires_at).getTime() < Date.now())
      throw new Error("Link expired");
    // If the link requires lead capture, the caller must have already
    // gone through resolveShareLink's lead_required gate — this is a
    // defense-in-depth check so a session can't be started without it.
    if (link.require_lead_capture && (!data.leadName || !data.leadEmail))
      throw new Error("Name and email are required for this link");
    // Only set recipient_name/email when provided, so re-visits without a
    // fresh lead form (e.g. no lead capture required) don't clobber a
    // previously captured name/email.
    const { data: viewer, error: vErr } = await supabaseAdmin
      .from("viewers")
      .upsert(
        {
          share_link_id: data.shareLinkId,
          anon_id: data.anonId,
          last_seen: new Date().toISOString(),
          ...(data.leadName ? { recipient_name: data.leadName } : {}),
          ...(data.leadEmail ? { recipient_email: data.leadEmail } : {}),
        },
        { onConflict: "share_link_id,anon_id" },
      )
      .select("id")
      .single();
    if (vErr) throw new Error(vErr.message);
    const { data: session, error: sErr } = await supabaseAdmin
      .from("viewing_sessions")
      .insert({
        viewer_id: viewer.id,
        share_link_id: data.shareLinkId,
        user_agent: data.userAgent ?? null,
      })
      .select("id")
      .single();
    if (sErr) throw new Error(sErr.message);
    return { sessionId: session.id, viewerId: viewer.id };
  });

const eventSchema = z.object({
  pageIndex: z.number().int().min(0).max(10000),
  activeMs: z.number().int().min(0).max(24 * 3600_000),
  sequence: z.number().int().min(0).max(1_000_000),
  enteredAt: z.string().max(64),
});

export const recordSessionUpdate = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      sessionId: string;
      events: z.infer<typeof eventSchema>[];
      lastPage: number;
      totalActiveMs: number;
      uniquePages: number;
      pageCount: number;
      ended?: boolean;
    }) =>
      z
        .object({
          sessionId: z.string().uuid(),
          events: z.array(eventSchema).max(500),
          lastPage: z.number().int().min(0).max(10000),
          totalActiveMs: z.number().int().min(0).max(24 * 3600_000),
          uniquePages: z.number().int().min(0).max(10000),
          pageCount: z.number().int().min(1).max(10000),
          ended: z.boolean().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.events.length) {
      const rows = data.events.map((e) => ({
        session_id: data.sessionId,
        page_index: e.pageIndex,
        active_ms: e.activeMs,
        sequence: e.sequence,
        entered_at: e.enteredAt,
      }));
      const { error: eErr } = await supabaseAdmin.from("page_view_events").insert(rows);
      if (eErr) throw new Error(eErr.message);
    }
    const completion = Math.min(
      100,
      (data.uniquePages / Math.max(1, data.pageCount)) * 100,
    );
    const update: {
      active_ms: number;
      last_page: number;
      completion_pct: number;
      ended_at?: string;
    } = {
      active_ms: data.totalActiveMs,
      last_page: data.lastPage,
      completion_pct: Number(completion.toFixed(2)),
    };
    if (data.ended) update.ended_at = new Date().toISOString();
    const { error: uErr } = await supabaseAdmin
      .from("viewing_sessions")
      .update(update)
      .eq("id", data.sessionId);
    if (uErr) throw new Error(uErr.message);
    const { data: sess } = await supabaseAdmin
      .from("viewing_sessions")
      .select("viewer_id")
      .eq("id", data.sessionId)
      .single();
    if (sess) {
      await supabaseAdmin
        .from("viewers")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", sess.viewer_id);
    }
    return { ok: true };
  });
