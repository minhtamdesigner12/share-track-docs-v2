import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  /** Path to return to after successful sign-in (e.g. current edit URL). */
  returnTo?: string;
}

/**
 * Minimal sign-in modal used to gate Share & Track.
 * Only offers Continue with Google (Phase 1).
 */
export function SignInModal({ open, onOpenChange, title, description, returnTo }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    setLoading(true);
    const target =
      typeof window !== "undefined"
        ? window.location.origin + (returnTo ?? window.location.pathname + window.location.search)
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title ?? "Sign in to track your PDF"}</DialogTitle>
          <DialogDescription>
            {description ??
              "Sign in with Google to securely save your shared PDF and access its viewing activity and analytics anytime."}
          </DialogDescription>
        </DialogHeader>
        <Button onClick={handleGoogle} disabled={loading} className="h-11 w-full" variant="outline">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon />}
          Continue with Google
        </Button>
        <DialogFooter className="sm:justify-center">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
        </DialogFooter>
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
