import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";

const searchSchema = z.object({
  returnTo: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  component: AuthPage,
});

function AuthPage() {
  const { returnTo } = Route.useSearch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

    useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      // Wait for Supabase to finish restoring the session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!cancelled && session) {
        if (returnTo && returnTo.startsWith("/")) {
          window.location.replace(returnTo);
        } else {
          navigate({ to: "/", replace: true });
        }
      }
    }

    restoreSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;

      if (event === "SIGNED_IN" && session) {
        if (returnTo && returnTo.startsWith("/")) {
          window.location.replace(returnTo);
        } else {
          navigate({ to: "/", replace: true });
        }
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [navigate, returnTo]);

  async function handleGoogle() {
    setLoading(true);
    const target =
      typeof window !== "undefined"
        ? window.location.origin + (returnTo && returnTo.startsWith("/") ? returnTo : "/")
        : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: target },
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 font-semibold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <FileText className="h-4 w-4" />
          </div>
          <span>iEduPDF</span>
        </Link>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-soft">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to track your PDF</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Editing, compressing, and downloading PDFs is free — no account required. Sign in
            with Google only when you want to share a PDF and see how recipients engage with it.
          </p>

          <Button
            type="button"
            variant="outline"
            className="mt-6 h-11 w-full"
            onClick={handleGoogle}
            disabled={loading}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon />}
            Continue with Google
          </Button>

          <div className="mt-6 text-center text-sm">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              Back to iEduPDF
            </Link>
          </div>
        </div>
      </div>
    </div>
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
