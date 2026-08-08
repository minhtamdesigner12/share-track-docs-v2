import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Download,
  FileEdit,
  ImageIcon,
  Images as ImagesIcon,
  Loader2,
  Plus,
  RotateCw,
  Trash2,
  Upload,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { putGuestPdfBytes } from "@/lib/guest-pdf-store";
import {
  buildPdfFromImages,
  readImageDimensions,
  type BuildSettings,
  type ImageItem,
  type Margin,
  type Orientation,
  type PageSize,
} from "@/modules/images-to-pdf/build";

export const Route = createFileRoute("/images-to-pdf")({
  component: ImagesToPdfPage,
});

const ACCEPTED = ["image/jpeg", "image/jpg", "image/png"];
const MAX_FILES = 100;
const MAX_BYTES = 25 * 1024 * 1024;

function isImage(file: File): boolean {
  if (ACCEPTED.includes(file.type)) return true;
  const n = file.name.toLowerCase();
  return n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".png");
}

interface Preview {
  bytes: Uint8Array;
  url: string;
  size: number;
  name: string;
  pages: number;
}

function ImagesToPdfPage() {
  const navigate = useNavigate();
  const [images, setImages] = useState<ImageItem[]>([]);
  const [settings, setSettings] = useState<BuildSettings>({
    pageSize: "a4",
    orientation: "auto",
    margin: "small",
  });
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Revoke object URLs on unmount / list change
  useEffect(() => {
    return () => {
      images.forEach((i) => URL.revokeObjectURL(i.url));
      if (preview) URL.revokeObjectURL(preview.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearPreview = useCallback(() => {
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  }, []);

  const addFiles = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files) return;
      const list = Array.from(files);
      if (!list.length) return;
      const accepted: ImageItem[] = [];
      for (const file of list) {
        if (!isImage(file)) {
          toast.error(`${file.name}: only JPG or PNG`);
          continue;
        }
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name}: exceeds 25 MB`);
          continue;
        }
        const url = URL.createObjectURL(file);
        try {
          const dim = await readImageDimensions(url);
          accepted.push({
            id: crypto.randomUUID(),
            file,
            url,
            name: file.name,
            width: dim.width,
            height: dim.height,
            rotation: 0,
          });
        } catch {
          URL.revokeObjectURL(url);
          toast.error(`${file.name}: could not read image`);
        }
      }
      if (!accepted.length) return;
      setImages((prev) => {
        const combined = [...prev, ...accepted];
        if (combined.length > MAX_FILES) {
          toast.error(`Maximum ${MAX_FILES} images per PDF`);
          combined.slice(MAX_FILES).forEach((i) => URL.revokeObjectURL(i.url));
          return combined.slice(0, MAX_FILES);
        }
        return combined;
      });
      clearPreview();
    },
    [clearPreview],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setImages((prev) => {
      const ids = prev.map((i) => i.id);
      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(over.id as string);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
    clearPreview();
  }

  function rotate(id: string) {
    setImages((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, rotation: (((i.rotation + 90) % 360) as ImageItem["rotation"]) } : i,
      ),
    );
    clearPreview();
  }
  function remove(id: string) {
    setImages((prev) => {
      const found = prev.find((i) => i.id === id);
      if (found) URL.revokeObjectURL(found.url);
      return prev.filter((i) => i.id !== id);
    });
    clearPreview();
  }

  async function handleCreate() {
    if (!images.length) return;
    setBusy(true);
    try {
      const bytes = await buildPdfFromImages(images, settings);
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      clearPreview();
      setPreview({
        bytes,
        url,
        size: blob.size,
        name: `images-${new Date().toISOString().slice(0, 10)}.pdf`,
        pages: images.length,
      });
      toast.success("PDF created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create PDF");
    } finally {
      setBusy(false);
    }
  }

  function handleDownload() {
    if (!preview) return;
    const a = document.createElement("a");
    a.href = preview.url;
    a.download = preview.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function handleOpenInEditor() {
    if (!preview) return;
    const entry = await putGuestPdfBytes(preview.bytes, preview.name);
    navigate({ to: "/edit", search: { id: entry.id } });
  }

  const totalMB = useMemo(
    () => (images.reduce((n, i) => n + i.file.size, 0) / (1024 * 1024)).toFixed(1),
    [images],
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/" })}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Images to PDF</h1>
            <p className="text-sm text-muted-foreground">
              Combine JPG or PNG images into one PDF. No account required.
            </p>
          </div>
        </div>

        {images.length === 0 ? (
          <div
            className={
              "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-14 text-center transition-colors " +
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
              addFiles(e.dataTransfer.files);
            }}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-brand">
              <ImagesIcon className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Upload images</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Drag &amp; drop JPG or PNG files here, or click to choose. Up to {MAX_FILES} images,
              25 MB each.
            </p>
            <label className="mt-5 inline-flex cursor-pointer items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground shadow-soft hover:opacity-90">
              <Upload className="mr-2 h-4 w-4" /> Choose images
              <input
                type="file"
                accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                className="hidden"
                multiple
                onChange={(e) => {
                  addFiles(e.target.files);
                  if (e.target) e.target.value = "";
                }}
              />
            </label>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            {/* Thumbnails + controls */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {images.length} image{images.length === 1 ? "" : "s"} · {totalMB} MB · Drag to
                  reorder
                </div>
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                    className="hidden"
                    multiple
                    onChange={(e) => {
                      addFiles(e.target.files);
                      if (e.target) e.target.value = "";
                    }}
                  />
                  <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                    <Plus className="mr-1 h-4 w-4" /> Add more
                  </Button>
                </div>
              </div>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={images.map((i) => i.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {images.map((img, idx) => (
                      <ImageThumb
                        key={img.id}
                        image={img}
                        index={idx}
                        onRotate={() => rotate(img.id)}
                        onRemove={() => remove(img.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            {/* Settings + actions */}
            <aside className="space-y-6">
              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold">PDF settings</h2>
                <div className="mt-4 space-y-4">
                  <SegField
                    label="Page size"
                    value={settings.pageSize}
                    onChange={(v) => {
                      setSettings((s) => ({ ...s, pageSize: v as PageSize }));
                      clearPreview();
                    }}
                    options={[
                      { value: "a4", label: "A4" },
                      { value: "letter", label: "Letter" },
                      { value: "fit", label: "Fit image" },
                    ]}
                  />
                  <SegField
                    label="Orientation"
                    value={settings.orientation}
                    onChange={(v) => {
                      setSettings((s) => ({ ...s, orientation: v as Orientation }));
                      clearPreview();
                    }}
                    disabled={settings.pageSize === "fit"}
                    options={[
                      { value: "auto", label: "Auto" },
                      { value: "portrait", label: "Portrait" },
                      { value: "landscape", label: "Landscape" },
                    ]}
                  />
                  <SegField
                    label="Margin"
                    value={settings.margin}
                    onChange={(v) => {
                      setSettings((s) => ({ ...s, margin: v as Margin }));
                      clearPreview();
                    }}
                    options={[
                      { value: "none", label: "None" },
                      { value: "small", label: "Small" },
                      { value: "normal", label: "Normal" },
                    ]}
                  />
                </div>
                <Button
                  className="mt-5 w-full"
                  onClick={handleCreate}
                  disabled={busy || images.length === 0}
                >
                  {busy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ImageIcon className="mr-2 h-4 w-4" />
                  )}
                  Create PDF
                </Button>
              </div>

              {preview && (
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h2 className="text-sm font-semibold">Preview</h2>
                  <div className="mt-3 text-sm text-muted-foreground">
                    <div className="truncate font-medium text-foreground">{preview.name}</div>
                    <div className="mt-1">
                      {preview.pages} page{preview.pages === 1 ? "" : "s"} ·{" "}
                      {(preview.size / 1024).toFixed(0)} KB
                    </div>
                  </div>
                  <div className="mt-3 overflow-hidden rounded-lg border border-border bg-muted">
                    <iframe
                      title="PDF preview"
                      src={preview.url}
                      className="h-72 w-full"
                    />
                  </div>
                  <div className="mt-4 flex flex-col gap-2">
                    <Button onClick={handleDownload}>
                      <Download className="mr-2 h-4 w-4" /> Download
                    </Button>
                    <Button variant="outline" onClick={handleOpenInEditor}>
                      <FileEdit className="mr-2 h-4 w-4" /> Open in PDF editor
                    </Button>
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function ImageThumb({
  image,
  index,
  onRotate,
  onRemove,
}: {
  image: ImageItem;
  index: number;
  onRotate: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative overflow-hidden rounded-lg border border-border bg-background"
    >
      <div
        {...attributes}
        {...listeners}
        className="flex aspect-square cursor-grab items-center justify-center bg-muted active:cursor-grabbing"
      >
        <img
          src={image.url}
          alt={image.name}
          className="max-h-full max-w-full object-contain transition-transform"
          style={{ transform: `rotate(${image.rotation}deg)` }}
          draggable={false}
        />
      </div>
      <div className="flex items-center justify-between border-t border-border bg-card px-2 py-1.5 text-[11px]">
        <span className="truncate text-muted-foreground">
          #{index + 1} · {image.name}
        </span>
      </div>
      <div className="pointer-events-none absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100">
        <button
          onClick={onRotate}
          className="rounded bg-background/95 p-1 text-muted-foreground shadow ring-1 ring-border hover:text-foreground"
          aria-label="Rotate"
          type="button"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onRemove}
          className="rounded bg-background/95 p-1 text-destructive shadow ring-1 ring-border hover:bg-destructive hover:text-destructive-foreground"
          aria-label="Remove"
          type="button"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function SegField({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      <div
        className={
          "inline-flex w-full rounded-lg border border-border bg-background p-0.5 " +
          (disabled ? "opacity-50" : "")
        }
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={
              "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors " +
              (value === o.value
                ? "bg-brand text-brand-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
