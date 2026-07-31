import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, ExternalLink, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";

import { supabase } from "@/integrations/supabase/client";
import { saveTrackedPdf, createShareLink } from "@/lib/share.functions";

type Phase = "signin" | "form" | "saving" | "done";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Async producer for the current edited PDF bytes. */
  getPdfBytes: () => Promise<Uint8Array>;
  /** Number of pages currently in the editor. */
  pageCount: number;
  /** Human-friendly base name (no extension). */
  docName: string;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

export function ShareTrackDialog({
  open,
  onOpenChange,
  getPdfBytes,
  pageCount,
  docName,
}: Props) {
  const [phase, setPhase] = useState<Phase>("signin");
  const [signedIn, setSignedIn] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [label, setLabel] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [allowDownload, setAllowDownload] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [password, setPassword] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [savingErr, setSavingErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; slug: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const saveFn = useServerFn(saveTrackedPdf);
  const createFn = useServerFn(createShareLink);
  const documentIdRef = useRef<string | null>(null);

  // Watch auth state
  useEffect(() => {
    if (!open) return;
    supabase.auth.getUser().then(({ data }) => {
      const authed = !!data.user;
      setSignedIn(authed);
      if (authed) setPhase("form");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const authed = !!session?.user;
      setSignedIn(authed);
      if (authed && phase === "signin") setPhase("form");
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Default label when entering form
  useEffect(() => {
    if (phase === "form" && !label) setLabel(docName);
  }, [phase, docName, label]);

  // Reset when closing
  useEffect(() => {
    if (!open) {
      setSavingErr(null);
      // keep result if reopened during same edit session? just reset for clarity
      setResult(null);
      setCopied(false);
      setPhase(signedIn ? "form" : "signin");
    }
  }, [open, signedIn]);

  async function handleGoogle() {
    setOauthLoading(true);

    // Remember that the user wants to continue sharing after login
    sessionStorage.setItem("openShareDialog", "true");

    const returnTo =
      typeof window !== "undefined"
        ? window.location.origin + window.location.pathname + window.location.search
        : undefined;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: returnTo },
    });

    if (error) {
      sessionStorage.removeItem("openShareDialog");
      toast.error(error.message);
      setOauthLoading(false);
    }
  }

  async function handleCreate() {
    setSavingErr(null);
    if (!label.trim()) {
      setSavingErr("Please add a link name.");
      return;
    }
    setPhase("saving");
    try {
      // 1. Save PDF (once per dialog session)
      if (!documentIdRef.current) {
        const bytes = await getPdfBytes();
        const base64 = uint8ToBase64(bytes);
        const saved = await saveFn({
          data: { name: docName, base64, pageCount },
        });
        documentIdRef.current = saved.id;
      }
      // 2. Create share link
      const link = await createFn({
        data: {
          documentId: documentIdRef.current!,
          label: label.trim(),
          recipientName: recipientName.trim() || null,
          recipientEmail: recipientEmail.trim() || null,
          allowDownload,
          password: showAdvanced && password.trim() ? password.trim() : null,
          expiresAt:
            showAdvanced && expiresAt
              ? new Date(expiresAt).toISOString()
              : null,
        },
      });
      const url = `${window.location.origin}/view/${link.slug}`;
      setResult({ url, slug: link.slug });
      setPhase("done");
    } catch (e) {
      setSavingErr(e instanceof Error ? e.message : "Failed to create link");
      setPhase("form");
    }
  }

  async function copyLink() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed");
    }
  }

  function createAnother() {
    setResult(null);
    setLabel("");
    setRecipientName("");
    setRecipientEmail("");
    setPassword("");
    setExpiresAt("");
    setShowAdvanced(false);
    setPhase("form");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {phase === "signin" && (
          <>
            <DialogHeader>
              <DialogTitle>Sign in to track your PDF</DialogTitle>
              <DialogDescription>
                Sign in with Google to securely save your shared PDF and access its viewing
                activity and analytics anytime.
              </DialogDescription>
            </DialogHeader>
            <Button
              onClick={handleGoogle}
              disabled={oauthLoading}
              variant="outline"
              className="h-11 w-full"
            >
              {oauthLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              Continue with Google
            </Button>
            <DialogFooter className="sm:justify-center">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Not now
              </Button>
            </DialogFooter>
          </>
        )}

        {(phase === "form" || phase === "saving") && (
          <>
            <DialogHeader>
              <DialogTitle>Create a trackable link</DialogTitle>
              <DialogDescription>
                Anyone with the link can view — no account required. You'll see exactly which
                pages they view and how long they spend.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="label">Link name</Label>
                <Input
                  id="label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Investors — Alex"
                  className="mt-1"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="rname">Recipient name (optional)</Label>
                  <Input
                    id="rname"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Alex"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="remail">Recipient email (optional)</Label>
                  <Input
                    id="remail"
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="alex@example.com"
                    className="mt-1"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={allowDownload}
                  onCheckedChange={(v) => setAllowDownload(!!v)}
                />
                Allow recipients to download the PDF
              </label>

              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {showAdvanced ? "Hide" : "Show"} advanced options
              </button>

              {showAdvanced && (
                <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
                  <div>
                    <Label htmlFor="pw" className="flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Password (optional)
                    </Label>
                    <Input
                      id="pw"
                      type="text"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Leave blank for no password"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="exp">Expires (optional)</Label>
                    <Input
                      id="exp"
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              )}

              {savingErr && (
                <p className="text-sm text-destructive" role="alert">
                  {savingErr}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={phase === "saving"}>
                {phase === "saving" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Trackable Link
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === "done" && result && (
          <>
            <DialogHeader>
              <DialogTitle>Your trackable link is ready</DialogTitle>
              <DialogDescription>
                Share this link with your recipient. Every visit is tracked in your analytics.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted p-3 text-sm">
              <span className="truncate font-mono text-xs">{result.url}</span>
              <Button size="sm" variant="outline" onClick={copyLink} className="ml-auto">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span className="ml-1">{copied ? "Copied" : "Copy"}</span>
              </Button>
              <Button size="sm" asChild>
                <a href={result.url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Tracking works only when the PDF is viewed through this link. If the recipient
              downloads the PDF and opens it locally, tracking cannot continue.
            </p>

            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="outline" onClick={createAnother}>
                Create another link
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button asChild>
                  <a
                    href={`/analytics/${documentIdRef.current}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View analytics
                  </a>
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GoogleIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.75-6-6.15S8.7 5.6 12 5.6c1.9 0 3.15.8 3.87 1.5l2.65-2.55C16.9 3.1 14.7 2.1 12 2.1 6.75 2.1 2.55 6.35 2.55 11.75S6.75 21.4 12 21.4c6.95 0 9.55-4.9 9.55-9.4 0-.63-.07-1.1-.15-1.55L12 10.2z"
      />
    </svg>
  );
}
