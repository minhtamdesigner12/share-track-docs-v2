import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { PoweredByFooter } from "@/components/powered-by-footer";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [{ title: "Terms of Service — iEduPDF" }],
  }),
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: August 2026</p>

        <div className="prose prose-sm mt-8 max-w-none text-foreground [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mt-3 [&_p]:text-muted-foreground [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-muted-foreground [&_li]:mt-1">
          <h2>1. Agreement to these terms</h2>
          <p>
            iEduPDF ("we", "us", "the Service") is provided by tamplaylab.com. By uploading a
            file, creating an account, or opening a shared link, you agree to these terms. If you
            don't agree, please don't use the Service.
          </p>

          <h2>2. What the Service does</h2>
          <p>
            iEduPDF lets you edit, organize, and compress PDF files in your browser, and
            optionally create trackable share links so you can see how recipients view a
            document — which pages they viewed and how long they spent. Editing tools work
            without an account; creating a share link requires signing in with Google.
          </p>

          <h2>3. Your content</h2>
          <p>
            You retain all ownership rights to the PDFs you upload. By using the Service, you
            grant us a limited license to store, process, and display your files solely to
            provide the Service to you (and, when you create a share link, to the recipients you
            choose to share it with).
          </p>
          <p>You're responsible for making sure you have the right to upload and share any file you use with the Service.</p>

          <h2>4. Acceptable use</h2>
          <p>You agree not to use the Service to:</p>
          <ul>
            <li>Upload or share content that's illegal, infringing, or that you don't have the rights to distribute</li>
            <li>Distribute malware or attempt to compromise the security of the Service</li>
            <li>Use the tracking features to harass, stalk, or deceive recipients</li>
            <li>Attempt to access another user's account or data without authorization</li>
          </ul>

          <h2>5. Sharing and tracking responsibilities</h2>
          <p>
            When you create a share link, you're the one responsible for how you use it —
            including who you send it to and, if you enable the optional "require name & email"
            feature, how you use the information recipients provide. If applicable privacy laws
            require you to have a legal basis for collecting that information (for example, if
            you're sharing with recipients in the EU), that responsibility is yours, not ours.
          </p>

          <h2>6. Service availability</h2>
          <p>
            The Service is provided "as is." We don't guarantee it will be available at all
            times, uninterrupted, or error-free. Features may change or be discontinued.
          </p>

          <h2>7. Termination</h2>
          <p>
            We may suspend or terminate access to the Service for accounts that violate these
            terms. You can stop using the Service and request account deletion at any time (see
            our <Link to="/privacy" className="text-brand hover:underline">Privacy Policy</Link>{" "}
            for how).
          </p>

          <h2>8. Limitation of liability</h2>
          <p>
            To the fullest extent permitted by law, we aren't liable for any indirect,
            incidental, or consequential damages arising from your use of the Service, including
            loss of data.
          </p>

          <h2>9. Changes to these terms</h2>
          <p>
            We may update these terms from time to time. We'll update the date at the top of this
            page when we do. Continued use of the Service after a change means you accept the
            updated terms.
          </p>

          <h2>10. Contact</h2>
          <p>
            Questions about these terms? Reach out via our{" "}
            <Link to="/contact" className="text-brand hover:underline">Contact page</Link>.
          </p>
        </div>
      </main>
      <PoweredByFooter />
    </div>
  );
}
