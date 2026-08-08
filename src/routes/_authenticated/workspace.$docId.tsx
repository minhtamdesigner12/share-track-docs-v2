import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { getDocument, updateDocumentBytes } from "@/lib/pdf.functions";
import { Button } from "@/components/ui/button";
import { EditorProvider } from "@/modules/pdf-doc/store";
import { EditorShell } from "@/modules/pdf-doc/EditorShell";

export const Route = createFileRoute("/_authenticated/workspace/$docId")({
  component: Workspace,
});

function uint8ToBase64(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

function Workspace() {
  const { docId } = Route.useParams();
  const getFn = useServerFn(getDocument);
  const updateFn = useServerFn(updateDocumentBytes);
  const qc = useQueryClient();

  const { data: doc, isLoading, error } = useQuery({
    queryKey: ["doc", docId],
    queryFn: () => getFn({ data: { id: docId } }),
    staleTime: 60_000,
  });

  // Fetch the actual PDF bytes once we have a signed URL, so the real
  // editor (with annotation tools) can load it the same way it loads a
  // fresh guest upload.
  const { data: bytes, isLoading: bytesLoading, error: bytesError } = useQuery({
    queryKey: ["doc-bytes", docId, doc?.signedUrl],
    queryFn: async () => {
      const res = await fetch(doc!.signedUrl);
      if (!res.ok) throw new Error("Failed to download PDF");
      const buf = await res.arrayBuffer();
      return new Uint8Array(buf);
    },
    enabled: !!doc?.signedUrl,
    staleTime: Infinity,
  });

  if (isLoading || (doc && bytesLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading PDF…
      </div>
    );
  }
  if (error || bytesError || !doc || !bytes) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Failed to load PDF.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <EditorProvider>
      <EditorShell
        docName={doc.name}
        initialSource={{ id: doc.id, name: doc.name, bytes }}
        documentId={doc.id}
        backTo="/dashboard"
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["doc", docId] });
          qc.invalidateQueries({ queryKey: ["docs"] });
        }}
        saveDocument={async (editedBytes, pageCount) => {
          await updateFn({
            data: {
              id: doc.id,
              base64: uint8ToBase64(editedBytes),
              pageCount,
            },
          });
        }}
      />
    </EditorProvider>
  );
}
