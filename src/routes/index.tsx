import { createFileRoute, Link } from "@tanstack/react-router";
import {
  FileEdit,
  Images,
  Minimize2,
  Share2,
  ArrowRight,
  BarChart3,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { GuestPdfUpload } from "@/components/guest-pdf-upload";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-primary-soft blur-3xl opacity-70" />
        </div>
        <div className="mx-auto max-w-5xl px-4 pt-20 pb-10 text-center sm:pt-24">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
            <Sparkles className="h-3.5 w-3.5 text-brand" />
            No sign up required — edit and download your PDF in seconds
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            Everything you need to<br />work with PDFs.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Edit, organize, compress, and create PDFs — free and instant. Sign in only when you
            want to share a PDF and track how recipients engage with it.
          </p>
        </div>

        {/* Upload */}
        <div className="mx-auto max-w-2xl px-4 pb-16">
          <GuestPdfUpload />
        </div>
      </section>

      {/* Tools */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ToolCard
            icon={<FileEdit className="h-5 w-5" />}
            title="Edit PDF"
            desc="Reorder, rotate, add or remove pages. No account required."
          />
          <ToolCard
            to="/images-to-pdf"
            icon={<Images className="h-5 w-5" />}
            title="Images to PDF"
            desc="Turn multiple images into one organized PDF."
          />

          <ToolCard
            to="/compress"
            icon={<Minimize2 className="h-5 w-5" />}
            title="Compress PDF"
            desc="Reduce PDF file size while maintaining good visual quality."
          />

          <ToolCard
            featured
            icon={<Share2 className="h-5 w-5" />}
            title="Share & Track"
            desc="Share your PDF with a unique link and see how recipients engage — sign in with Google to enable."
          />
        </div>

        {/* Why Share & Track */}
        <div className="mt-20 grid gap-10 rounded-2xl border border-border bg-card p-8 shadow-soft sm:p-12 lg:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-brand">
              Share &amp; Track
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Know exactly how your PDFs perform.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Create a unique link for each recipient. Every visit is tracked — pages viewed,
              time spent, and where they stopped reading. Recipients never need an account; only
              the sender signs in so their tracking data stays private and accessible.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-brand" /> Recipients: no account needed
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-brand" /> Per-page analytics
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-background p-6">
            <div className="text-sm font-semibold">Company Pitch Deck</div>
            <div className="mt-3 space-y-2 text-sm">
              <ViewerRow name="Alex" detail="2 sessions · Stopped on page 5" />
              <ViewerRow name="Sarah" detail="1 session · Completed 100%" />
              <ViewerRow name="Public link" detail="14 viewers · Avg 62% reach" />
            </div>
            <div className="mt-6 text-xs text-muted-foreground">Page reach</div>
            <div className="mt-2 space-y-1.5">
              {[100, 95, 82, 60, 28].map((v, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-16 text-muted-foreground">Page {i + 1}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${v}%` }} />
                  </div>
                  <span className="w-10 text-right tabular-nums text-muted-foreground">{v}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-sm text-muted-foreground sm:flex-row">
          <div>© {new Date().getFullYear()} iEduPDF</div>
          <div>Simple PDF tools with real engagement tracking.</div>
        </div>
      </footer>
    </div>
  );
}

function ToolCard({
  icon,
  title,
  desc,
  featured,
  to,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  featured?: boolean;
  to?: string;
}) {
  const inner = (
    <>
      <div
        className={
          "inline-flex h-10 w-10 items-center justify-center rounded-lg " +
          (featured ? "bg-brand text-brand-foreground" : "bg-primary-soft text-brand")
        }
      >
        {icon}
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 flex-1 text-sm text-muted-foreground">{desc}</p>
      <div className="mt-4 inline-flex items-center text-sm font-medium text-brand">
        {to ? "Open tool" : "Upload above to start"} <ArrowRight className="ml-1 h-3.5 w-3.5" />
      </div>
      {featured && (
        <span className="absolute right-4 top-4 rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-foreground">
          Sign in
        </span>
      )}
    </>
  );
  const className =
    "group relative flex flex-col rounded-2xl border p-6 transition-all " +
    (featured ? "border-brand bg-primary-soft" : "border-border bg-card hover:border-brand/50");
  if (to) {
    return (
      <Link to={to} className={className}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}


function ViewerRow({ name, detail }: { name: string; detail: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2">
      <div className="font-medium">{name}</div>
      <div className="text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}
