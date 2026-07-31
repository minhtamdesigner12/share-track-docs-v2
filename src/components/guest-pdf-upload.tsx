import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Upload, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { putGuestPdf } from "@/lib/guest-pdf-store";

const MAX_BYTES = 100 * 1024 * 1024;

/**
 * Guest PDF upload — no account required.
 * Reads the file into memory and navigates to /edit with a local id.
 */
export function GuestPdfUpload() {
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const onFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      const file = files[0];
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        toast.error("Only PDF files are supported");
        return;
      }
      if (file.size > MAX_BYTES) {
        toast.error("File exceeds 100 MB limit");
        return;
      }
      setBusy(true);
      try {
        const entry = await putGuestPdf(file);
        navigate({ to: "/edit", search: { id: entry.id } });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load PDF");
        setBusy(false);
      }
    },
    [navigate],
  );

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
        Drag &amp; drop a PDF here, or click to choose one. No account needed. Max 100 MB.
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
    </div>
  );
}
