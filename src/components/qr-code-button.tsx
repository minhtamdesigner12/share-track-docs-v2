import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Loader2, QrCode as QrCodeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Props {
  /** The full public URL to encode (e.g. https://.../view/abc123). */
  url: string;
  /** Used as the downloaded PNG filename (without extension). */
  fileNameHint?: string;
  size?: "sm" | "default";
}

/** Small button that reveals a scannable QR code for a share link, with a PNG download. */
export function QrCodeButton({ url, fileNameHint = "share-link", size = "sm" }: Props) {
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || dataUrl) return;
    let cancelled = false;
    QRCode.toDataURL(url, {
      width: 320,
      margin: 2,
      color: { dark: "#0a0a0a", light: "#ffffff" },
    })
      .then((d) => {
        if (!cancelled) setDataUrl(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to generate QR code");
      });
    return () => {
      cancelled = true;
    };
  }, [open, url, dataUrl]);

  function download() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    const safeName = fileNameHint.replace(/[^a-z0-9-_]+/gi, "-").slice(0, 60);
    a.download = `${safeName || "share-link"}-qr.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size={size}>
          <QrCodeIcon className="mr-1 h-3.5 w-3.5" /> QR code
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="end">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-[168px] w-[168px] items-center justify-center rounded-lg border border-border bg-white">
            {error ? (
              <p className="px-3 text-center text-xs text-destructive">{error}</p>
            ) : dataUrl ? (
              <img src={dataUrl} alt="QR code for share link" className="h-40 w-40" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            )}
          </div>
          <p className="max-w-[168px] text-center text-[11px] text-muted-foreground">
            Scan to open the shared PDF. Views through this code are tracked the same as the link.
          </p>
          <Button size="sm" variant="outline" className="w-full" onClick={download} disabled={!dataUrl}>
            <Download className="mr-1 h-3.5 w-3.5" /> Download PNG
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
