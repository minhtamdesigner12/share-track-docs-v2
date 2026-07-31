import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { registerUploadedDocument } from "@/lib/pdf.functions";
import { loadDocument } from "@/modules/pdf-render/loader";
import { Upload, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB

/**
 * Universal PDF upload:
 * 1. Validate file (mime + size)
 * 2. Read pageCount client-side with pdf.js (before storage upload)
 * 3. Upload to Supabase storage under `<userId>/<uuid>.pdf`
 * 4. Register metadata via server fn
 * 5. Navigate to the workspace
 */
export function PdfUpload() {
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "reading" | "uploading" | "registering">("idle");
  const registerFn = useServerFn(registerUploadedDocument);
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        throw new Error("Only PDF files are supported");
      }
      if (file.size > MAX_BYTES) throw new Error("File exceeds 100 MB limit");

      setPhase("reading");
      const buf = await file.arrayBuffer();
      const doc = await loadDocument(new Uint8Array(buf.slice(0)));
      const pageCount = doc.numPages;

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");
      const id = crypto.randomUUID();
      const storagePath = `${userData.user.id}/${id}.pdf`;

      setPhase("uploading");
      setProgress(20);
      const { error: upErr } = await supabase.storage
        .from("pdfs")
        .upload(storagePath, new Blob([buf], { type: "application/pdf" }), {
          upsert: false,
          contentType: "application/pdf",
        });
      if (upErr) throw new Error(upErr.message);
      setProgress(80);

      setPhase("registering");
      const created = await registerFn({
        data: {
          name: file.name.replace(/\.pdf$/i, ""),
          storagePath,
          pageCount,
          sizeBytes: file.size,
        },
      });
      setProgress(100);
      return created;
    },
    onSuccess: (doc) => {
      toast.success("PDF uploaded");
      navigate({ to: "/workspace/$docId", params: { docId: doc!.id } });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      setPhase("idle");
      setProgress(0);
    },
  });

  const onFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;
      mutation.mutate(files[0]);
    },
    [mutation],
  );

  const busy = mutation.isPending;
  const phaseLabel =
    phase === "reading"
      ? "Reading PDF…"
      : phase === "uploading"
        ? "Uploading…"
        : phase === "registering"
          ? "Finishing up…"
          : "";

  return (
    <div
      className={
        "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-colors " +
        (dragOver ? "border-brand bg-primary-soft" : "border-border bg-card")
      }
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onFiles(e.dataTransfer.files);
      }}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-brand">
        {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileText className="h-6 w-6" />}
      </div>
      <h3 className="mt-4 text-lg font-semibold">Upload a PDF</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Drag &amp; drop a PDF here, or click to choose one from your device. Max 100 MB.
      </p>
      <label className="mt-5 inline-flex cursor-pointer items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground shadow-soft hover:opacity-90">
        <Upload className="mr-2 h-4 w-4" /> Choose file
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          disabled={busy}
          onChange={(e) => onFiles(e.target.files)}
        />
      </label>
      {busy && (
        <div className="mt-6 w-full max-w-sm">
          <Progress value={progress} />
          <div className="mt-2 text-xs text-muted-foreground">{phaseLabel}</div>
        </div>
      )}
    </div>
  );
}
