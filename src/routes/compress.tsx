import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  FileEdit,
  FileText,
  Loader2,
  Minimize2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { loadDocument } from "@/modules/pdf-render/loader";
import {
  compressPdf,
  formatBytes,
  PROFILES,
  type CompressLevel,
  type CompressResult,
} from "@/modules/compress/compress";
import { putGuestPdfBytes } from "@/lib/guest-pdf-store";
import { downloadBytes } from "@/modules/pdf-doc/export";

export const Route = createFileRoute("/compress")({
  component: CompressPage,
});

const MAX_BYTES = 100 * 1024 * 1024;

interface UploadedPdf {
  name: string;
  bytes: Uint8Array;
  size: number;
  pageCount: number;
}

function CompressPage() {
  const navigate = useNavigate();
  const [uploaded, setUploaded] = useState<UploadedPdf | null>(null);
  const [level, setLevel] = useState<CompressLevel>("recommended");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ page: number; total: number } | null>(null);
  const [result, setResult] = useState<CompressResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onFiles = useCallback(async (files: FileList | null) => {
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
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      // Validate + get page count
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const doc = await loadDocument(copy);
      setUploaded({
        name: file.name.replace(/\.pdf$/i, ""),
        bytes,
        size: file.size,
        pageCount: doc.numPages,
      });
      setResult(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read PDF");
    }
  }, []);

  async function handleCompress() {
    if (!uploaded || busy) return;
    setBusy(true);
    setResult(null);
    setProgress({ page: 0, total: uploaded.pageCount });
    try {
      const res = await compressPdf(uploaded.bytes, level, (p) => setProgress(p));
      setResult(res);
      if (res.notSmaller) {
        toast.info("This PDF was already well optimized — little to no savings.");
      } else {
        const pct = Math.round((1 - res.compressedSize / res.originalSize) * 100);
        toast.success(`Reduced by ${pct}%`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Compression failed");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function handleDownload() {
    if (!result || !uploaded) return;
    const bytes = result.notSmaller ? uploaded.bytes : result.bytes;
    const name = result.notSmaller ? uploaded.name : `${uploaded.name}-compressed`;
    downloadBytes(bytes, `${name}.pdf`);
  }

  function handleEdit() {
    if (!result || !uploaded) return;
    const bytes = result.notSmaller ? uploaded.bytes : result.bytes;
    const name = result.notSmaller ? uploaded.name : `${uploaded.name}-compressed`;
    const entry = putGuestPdfBytes(bytes, name);
    navigate({ to: "/edit", search: { id: entry.id } });
  }

  function reset() {
    setUploaded(null);
    setResult(null);
    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="mx-auto max-w-3xl px-4 pb-24 pt-10">
        <Link
          to="/"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to tools
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary-soft text-brand">
            <Minimize2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Compress PDF</h1>
            <p className="text-sm text-muted-foreground">
              Reduce PDF file size while keeping pages readable. No sign-up required.
            </p>
          </div>
        </div>

        {/* Step 1: Upload */}
        {!uploaded && (
          <div
            className={
              "mt-8 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-colors " +
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
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Upload a PDF</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Drag &amp; drop a PDF here, or choose one from your device. Max 100 MB.
            </p>
            <label className="mt-5 inline-flex cursor-pointer items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground shadow-soft hover:opacity-90">
              <Upload className="mr-2 h-4 w-4" /> Choose file
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => onFiles(e.target.files)}
              />
            </label>
          </div>
        )}

        {/* Step 2+: File loaded */}
        {uploaded && (
          <div className="mt-8 space-y-6">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-brand">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{uploaded.name}.pdf</div>
                <div className="text-xs text-muted-foreground">
                  {formatBytes(uploaded.size)} · {uploaded.pageCount} page
                  {uploaded.pageCount === 1 ? "" : "s"}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={reset} aria-label="Remove file">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold">Compression level</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <LevelCard
                  active={level === "recommended"}
                  onClick={() => setLevel("recommended")}
                  title="Recommended"
                  desc="Reduce file size while keeping good visual quality. Best for most PDFs."
                />
                <LevelCard
                  active={level === "maximum"}
                  onClick={() => setLevel("maximum")}
                  title="Maximum compression"
                  desc="Smallest file size. Image quality may be visibly reduced."
                />
              </div>
            </div>

            {!result && (
              <Button
                size="lg"
                onClick={handleCompress}
                disabled={busy}
                className="w-full sm:w-auto"
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Minimize2 className="mr-2 h-4 w-4" />
                )}
                {busy ? "Compressing your PDF…" : "Compress PDF"}
              </Button>
            )}

            {busy && progress && (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Processing page {Math.max(1, progress.page)} of {progress.total}</span>
                  <span>{PROFILES[level].label}</span>
                </div>
                <Progress value={(progress.page / Math.max(1, progress.total)) * 100} />
              </div>
            )}

            {result && (
              <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                {result.notSmaller ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-border bg-primary-soft/40 p-4 text-sm">
                      <div className="font-semibold text-foreground">
                        This PDF is already well optimized
                      </div>
                      <div className="mt-1 text-muted-foreground">
                        Re-compressing wouldn&apos;t meaningfully shrink it (
                        {formatBytes(result.originalSize)} →{" "}
                        {formatBytes(result.compressedSize)}). Downloading the original keeps full
                        quality.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 items-center gap-4 text-center">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Original
                      </div>
                      <div className="mt-1 text-xl font-bold">
                        {formatBytes(result.originalSize)}
                      </div>
                    </div>
                    <div className="flex flex-col items-center text-brand">
                      <ArrowRight className="h-5 w-5" />
                      <div className="mt-1 text-2xl font-extrabold">
                        {Math.round((1 - result.compressedSize / result.originalSize) * 100)}%
                      </div>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        smaller
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Compressed
                      </div>
                      <div className="mt-1 text-xl font-bold text-brand">
                        {formatBytes(result.compressedSize)}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                  <Button size="lg" onClick={handleDownload} className="flex-1">
                    <Download className="mr-2 h-4 w-4" />
                    {result.notSmaller ? "Download original PDF" : "Download compressed PDF"}
                  </Button>
                  <Button size="lg" variant="outline" onClick={handleEdit} className="flex-1">
                    <FileEdit className="mr-2 h-4 w-4" />
                    Edit PDF
                  </Button>
                </div>
                <div className="mt-3 text-center">
                  <button
                    type="button"
                    onClick={reset}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Compress another PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function LevelCard({
  active,
  onClick,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex flex-col rounded-xl border-2 p-4 text-left transition " +
        (active
          ? "border-brand bg-primary-soft/40"
          : "border-border bg-card hover:border-brand/50")
      }
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">{title}</div>
        <div
          className={
            "h-4 w-4 rounded-full border-2 " +
            (active ? "border-brand bg-brand" : "border-border")
          }
        />
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{desc}</div>
    </button>
  );
}
