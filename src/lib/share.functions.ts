import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function makeSlug() {
  return crypto.randomUUID().replace(/-/g, "");
}

/**
 * Save the (possibly edited) PDF bytes as a new owned document, uploading to
 * private storage. Called after the guest signs in and clicks "Save & share".
 */
export const saveTrackedPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; base64: string; pageCount: number }) =>
    z
      .object({
        name: z.string().trim().min(1).max(255),
        base64: z.string().min(1).max(200_000_000),
        pageCount: z.number().int().min(1).max(5000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const bin = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const path = `${context.userId}/${crypto.randomUUID()}.pdf`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin.storage
      .from("pdfs")
      .upload(path, bin, { contentType: "application/pdf", upsert: false });
    if (upErr) throw new Error(upErr.message);
    const { data: doc, error } = await context.supabase
      .from("pdf_documents")
      .insert({
        owner_id: context.userId,
        name: data.name.replace(/\.pdf$/i, ""),
        source_storage_path: path,
        page_count: data.pageCount,
        size_bytes: bin.byteLength,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: doc.id };
  });

export const createShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      documentId: string;
      label: string;
      recipientName?: string | null;
      recipientEmail?: string | null;
      allowDownload?: boolean;
      expiresAt?: string | null;
      password?: string | null;
    }) =>
      z
        .object({
          documentId: z.string().uuid(),
          label: z.string().trim().min(1).max(120),
          recipientName: z.string().trim().max(120).nullable().optional(),
          recipientEmail: z
            .string()
            .trim()
            .max(200)
            .email()
            .nullable()
            .optional()
            .or(z.literal("")),
          allowDownload: z.boolean().optional(),
          expiresAt: z.string().datetime().nullable().optional(),
          password: z.string().min(1).max(200).nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: doc, error: dErr } = await context.supabase
      .from("pdf_documents")
      .select("id")
      .eq("id", data.documentId)
      .single();
    if (dErr || !doc) throw new Error("Document not found");
    const password_hash = data.password ? await sha256Hex(data.password) : null;
    const { data: link, error } = await context.supabase
      .from("share_links")
      .insert({
        document_id: data.documentId,
        owner_id: context.userId,
        slug: makeSlug(),
        label: data.label,
        recipient_name: data.recipientName || null,
        recipient_email: data.recipientEmail || null,
        allow_download: !!data.allowDownload,
        expires_at: data.expiresAt || null,
        password_hash,
      })
      .select("id, slug, label, allow_download, expires_at, created_at")
      .single();
    if (error) throw new Error(error.message);
    return link;
  });

export const listShareLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { documentId: string }) =>
    z.object({ documentId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: links, error } = await context.supabase
      .from("share_links")
      .select(
        "id, slug, label, recipient_name, recipient_email, allow_download, expires_at, is_active, created_at, password_hash",
      )
      .eq("document_id", data.documentId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (links ?? []).map((l) => l.id);
    let sessCounts: Record<string, { sessions: number; viewers: number; totalMs: number }> = {};
    if (ids.length) {
      const { data: sess } = await context.supabase
        .from("viewing_sessions")
        .select("share_link_id, viewer_id, active_ms")
        .in("share_link_id", ids);
      const byLink = new Map<string, { sess: number; viewers: Set<string>; ms: number }>();
      for (const id of ids) byLink.set(id, { sess: 0, viewers: new Set(), ms: 0 });
      for (const s of sess ?? []) {
        const b = byLink.get(s.share_link_id)!;
        b.sess += 1;
        b.viewers.add(s.viewer_id);
        b.ms += s.active_ms ?? 0;
      }
      sessCounts = Object.fromEntries(
        Array.from(byLink.entries()).map(([k, v]) => [
          k,
          { sessions: v.sess, viewers: v.viewers.size, totalMs: v.ms },
        ]),
      );
    }
    return (links ?? []).map((l) => ({
      id: l.id,
      slug: l.slug,
      label: l.label,
      recipient_name: l.recipient_name,
      recipient_email: l.recipient_email,
      allow_download: l.allow_download,
      expires_at: l.expires_at,
      is_active: l.is_active,
      created_at: l.created_at,
      has_password: !!l.password_hash,
      stats: sessCounts[l.id] ?? { sessions: 0, viewers: 0, totalMs: 0 },
    }));
  });

export const getSharedDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: doc, error } = await context.supabase
      .from("pdf_documents")
      .select("id, name, page_count, size_bytes, created_at")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return doc;
  });

export const getShareLinkAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { shareLinkId: string }) =>
    z.object({ shareLinkId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: link, error: lErr } = await context.supabase
      .from("share_links")
      .select(
        "id, slug, label, recipient_name, recipient_email, allow_download, expires_at, is_active, created_at, document_id",
      )
      .eq("id", data.shareLinkId)
      .single();
    if (lErr || !link) throw new Error("Not found");
    const { data: doc } = await context.supabase
      .from("pdf_documents")
      .select("id, name, page_count")
      .eq("id", link.document_id)
      .single();
    const { data: viewers } = await context.supabase
      .from("viewers")
      .select("id, anon_id, recipient_name, recipient_email, first_seen, last_seen")
      .eq("share_link_id", link.id);
    const { data: sessions } = await context.supabase
      .from("viewing_sessions")
      .select("id, viewer_id, started_at, ended_at, active_ms, last_page, completion_pct")
      .eq("share_link_id", link.id)
      .order("started_at", { ascending: true });
    const sessionIds = (sessions ?? []).map((s) => s.id);
    let events: {
      session_id: string;
      page_index: number;
      active_ms: number;
      sequence: number;
      entered_at: string;
    }[] = [];
    if (sessionIds.length) {
      const { data: ev } = await context.supabase
        .from("page_view_events")
        .select("session_id, page_index, active_ms, sequence, entered_at")
        .in("session_id", sessionIds)
        .order("sequence", { ascending: true });
      events = ev ?? [];
    }
    return {
      link,
      doc,
      viewers: viewers ?? [],
      sessions: sessions ?? [],
      events,
    };
  });

/** List all documents the user has shared (at least one share link). */
export const listSharedDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("pdf_documents")
      .select(
        "id, name, page_count, size_bytes, created_at, updated_at, share_links(id)",
      )
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((d: any) => ({
      id: d.id,
      name: d.name,
      page_count: d.page_count,
      size_bytes: d.size_bytes,
      updated_at: d.updated_at,
      created_at: d.created_at,
      link_count: Array.isArray(d.share_links) ? d.share_links.length : 0,
    }));
  });
