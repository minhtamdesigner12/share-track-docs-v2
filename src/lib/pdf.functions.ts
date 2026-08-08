import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * List all PDF documents owned by the current user.
 * Ordered by most recently updated.
 */
export const listMyDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("pdf_documents")
      .select("id, name, page_count, size_bytes, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/**
 * Record metadata for a PDF that the client has already uploaded to storage
 * at path `<userId>/<uuid>.pdf`. Returns the created document row.
 */
export const registerUploadedDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { name: string; storagePath: string; pageCount: number; sizeBytes: number }) =>
    z
      .object({
        name: z.string().trim().min(1).max(255),
        storagePath: z.string().min(1),
        pageCount: z.number().int().min(1),
        sizeBytes: z.number().int().min(0),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (!data.storagePath.startsWith(`${context.userId}/`)) {
      throw new Error("Invalid storage path");
    }
    const { data: doc, error } = await context.supabase
      .from("pdf_documents")
      .insert({
        owner_id: context.userId,
        name: data.name,
        source_storage_path: data.storagePath,
        page_count: data.pageCount,
        size_bytes: data.sizeBytes,
      })
      .select("id, name, page_count, size_bytes")
      .single();
    if (error) throw new Error(error.message);
    return doc;
  });

/**
 * Get one PDF document owned by the current user, with a short-lived signed
 * URL to fetch the original source bytes from private storage.
 */
export const getDocument = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: doc, error } = await context.supabase
      .from("pdf_documents")
      .select("id, name, page_count, size_bytes, source_storage_path, created_at")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    const { data: signed, error: sErr } = await context.supabase.storage
      .from("pdfs")
      .createSignedUrl(doc.source_storage_path, 60 * 30);
    if (sErr) throw new Error(sErr.message);

    return { ...doc, signedUrl: signed.signedUrl };
  });

/**
 * Delete a PDF document (row) owned by the current user.
 * NOTE: storage object cleanup will be handled in a follow-up phase.
 */
export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("pdf_documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Overwrite the stored bytes of an already-owned document with a newly
 * edited/exported version (from the annotation editor), and update its
 * page count / size metadata. Existing share links keep working and will
 * serve the updated content, since they resolve to the same storage path.
 */
export const updateDocumentBytes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { id: string; base64: string; pageCount: number }) =>
      z
        .object({
          id: z.string().uuid(),
          base64: z.string().min(1),
          pageCount: z.number().int().min(1),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: doc, error: dErr } = await context.supabase
      .from("pdf_documents")
      .select("id, source_storage_path")
      .eq("id", data.id)
      .single();
    if (dErr || !doc) throw new Error("Document not found");

    const bytes = Buffer.from(data.base64, "base64");
    const { error: upErr } = await context.supabase.storage
      .from("pdfs")
      .upload(doc.source_storage_path, bytes, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (upErr) throw new Error(upErr.message);

    const { error: updErr } = await context.supabase
      .from("pdf_documents")
      .update({
        page_count: data.pageCount,
        size_bytes: bytes.length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (updErr) throw new Error(updErr.message);

    return { ok: true };
  });
