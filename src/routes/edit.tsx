import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";

import { getGuestPdf, putGuestPdf } from "@/lib/guest-pdf-store";
import { EditorProvider } from "@/modules/pdf-doc/store";
import { EditorShell } from "@/modules/pdf-doc/EditorShell";

const searchSchema = z.object({ id: z.string().min(1) });

export const Route = createFileRoute("/edit")({
  validateSearch: searchSchema,
  component: EditPage,
});

function EditPage() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<Awaited<ReturnType<typeof getGuestPdf>> | null | undefined>(
    undefined,
  );

  useEffect(() => {
    let cancelled = false;
    getGuestPdf(id).then((e) => {
      if (!cancelled) setEntry(e ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (entry === null) navigate({ to: "/", replace: true });
  }, [entry, navigate]);

  // Still loading from IndexedDB — avoid a flash redirect to home while we
  // check, since the file may well still be there (e.g. right after the
  // Google sign-in redirect).
  if (entry === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading your PDF…
      </div>
    );
  }
  if (!entry) return null;

  return (
    <EditorProvider>
      <EditorShell
        docName={entry.name}
        initialSource={{ id: entry.id, name: entry.name, bytes: entry.bytes }}
        backTo="/"
      />
    </EditorProvider>
  );
}

// Keep the guest upload helper referenced so tree-shaking doesn't drop it
// (used when user drops another PDF onto the home page and lands here).
void putGuestPdf;
