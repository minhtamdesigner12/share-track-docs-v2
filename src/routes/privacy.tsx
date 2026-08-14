import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { PoweredByFooter } from "@/components/powered-by-footer";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [{ title: "Privacy Policy — iEduPDF" }],
  }),
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: August 2026</p>

        <div className="prose prose-sm mt-8 max-w-none text-foreground [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mt-3 [&_p]:text-muted-foreground [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-muted-foreground [&_li]:mt-1">
          <p>
            This policy covers two different groups of people: <strong>account holders</strong>{" "}
            (people who sign in and share PDFs) and <strong>viewers</strong> (people who open a
            shared link). What we collect is different for each.
          </p>

          <h2>1. Information we collect</h2>
          <p><strong>If you create an account:</strong></p>
          <ul>
            <li>Your name and email, from Google sign-in</li>
            <li>The PDF files you upload, and any edits you make to them</li>
            <li>Share link settings you configure (labels, passwords — stored as a hash, never in plain text — expiry dates, download permissions)</li>
          </ul>
          <p><strong>If you open a shared link (as a viewer):</strong></p>
          <ul>
            <li>An anonymous identifier stored in your browser, used to recognize repeat visits to the same link</li>
            <li>Which pages you viewed, how long you spent on each, and when</li>
            <li>Your name and email, but only if the sender enabled "require name & email before viewing" for that specific link, and only after you voluntarily provide it</li>
            <li>General technical data like browser type and approximate location, collected via Google Analytics</li>
          </ul>

          <h2>2. How we use this information</h2>
          <ul>
            <li>To provide the editing, sharing, and tracking features of the Service</li>
            <li>To show account holders the analytics for links they've created</li>
            <li>To send emails when an account holder chooses to email a share link to a recipient</li>
            <li>To understand overall site usage and improve the Service</li>
          </ul>

          <h2>3. Third parties we use</h2>
          <p>We rely on a small number of infrastructure providers to run the Service:</p>
          <ul>
            <li><strong>Supabase</strong> — authentication, database, and file storage</li>
            <li><strong>Vercel</strong> — application hosting</li>
            <li><strong>Google</strong> — sign-in (OAuth) and site analytics (Google Analytics)</li>
            <li><strong>Resend</strong> — delivering emails when you choose to send a share link by email</li>
          </ul>
          <p>Each of these processes data according to their own privacy policies, in addition to this one.</p>

          <h2>4. Cookies & local storage</h2>
          <p>
            We use browser storage (cookies and similar technologies) to keep you signed in,
            recognize repeat visits to a shared link for accurate tracking, and for Google
            Analytics. We don't use advertising cookies or sell data to advertisers.
          </p>

          <h2>5. How long we keep data</h2>
          <p>
            Account data and uploaded PDFs are kept as long as your account is active. If you
            upload a PDF as a guest without signing in, it's stored temporarily in your own
            browser and automatically removed after 24 hours if never saved to an account.
          </p>

          <h2>6. Your rights</h2>
          <p>
            You can request access to, correction of, or deletion of your data at any time via
            our <Link to="/contact" className="text-brand hover:underline">Contact page</Link>.
            If you're a viewer who was asked to provide your name and email through a shared
            link, you can contact us directly, or reach out to the person who shared the link
            with you, since they're the one who chose to collect it.
          </p>

          <h2>7. Children's privacy</h2>
          <p>The Service isn't directed at children, and we don't knowingly collect information from children.</p>

          <h2>8. Security</h2>
          <p>
            We use industry-standard measures to protect your data, including access controls on
            our database and encrypted storage. No system is perfectly secure, and we can't
            guarantee absolute security.
          </p>

          <h2>9. Changes to this policy</h2>
          <p>
            We may update this policy from time to time. We'll update the date at the top of this
            page when we do.
          </p>

          <h2>10. Contact</h2>
          <p>
            Questions about this policy or your data? Reach out via our{" "}
            <Link to="/contact" className="text-brand hover:underline">Contact page</Link>.
          </p>
        </div>
      </main>
      <PoweredByFooter />
    </div>
  );
}
