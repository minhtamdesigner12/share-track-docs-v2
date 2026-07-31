// In-memory store for the guest (no-login) PDF workflow.
// Holds the uploaded file bytes, a blob URL for previews, and a stable id.
// State is intentionally not persisted across full page reloads;
// on reload the guest is redirected back to the home page.

interface GuestPdf {
  id: string;
  name: string;
  url: string;
  bytes: Uint8Array;
}

const store = new Map<string, GuestPdf>();

export async function putGuestPdf(file: File): Promise<GuestPdf> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const name = file.name.replace(/\.pdf$/i, "");
  return putGuestPdfBytes(bytes, name);
}

export function putGuestPdfBytes(bytes: Uint8Array, name: string): GuestPdf {
  const id = crypto.randomUUID();
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const entry: GuestPdf = { id, name: name.replace(/\.pdf$/i, ""), url, bytes };
  store.set(id, entry);
  return entry;
}

export function getGuestPdf(id: string): GuestPdf | undefined {
  return store.get(id);
}

export function clearGuestPdf(id: string) {
  const entry = store.get(id);
  if (entry) {
    URL.revokeObjectURL(entry.url);
    store.delete(id);
  }
}
