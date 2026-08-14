import { createFileRoute } from "@tanstack/react-router";
import { LifeBuoy, Mail } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { PoweredByFooter } from "@/components/powered-by-footer";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({
    meta: [{ title: "Contact — iEduPDF" }],
  }),
});

function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-brand">
          <LifeBuoy className="h-7 w-7" />
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">How can we help?</h1>
        <p className="mt-3 text-muted-foreground">
          iEduPDF is one of the apps built by tamplaylab.com. Head to our shared support hub and
          choose iEduPDF to get help with editing, sharing, or tracking your PDFs.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg">
            <a href="https://tamplaylab.com/support" target="_blank" rel="noreferrer">
              Go to support hub
            </a>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href="mailto:support@tamplaylab.com">
              <Mail className="mr-1.5 h-4 w-4" /> Email us
            </a>
          </Button>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          For anything urgent, email{" "}
          <a href="mailto:support@tamplaylab.com" className="text-brand hover:underline">
            support@tamplaylab.com
          </a>
          .
        </p>
      </main>
      <PoweredByFooter />
    </div>
  );
}
