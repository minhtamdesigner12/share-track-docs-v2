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
