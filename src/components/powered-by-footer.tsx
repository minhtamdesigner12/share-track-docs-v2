import { Link } from "@tanstack/react-router";

/** Consistent "Powered by tamplaylab.com" attribution + legal links, used across app pages. */
export function PoweredByFooter() {
  return (
    <footer className="border-t border-border/60 py-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-xs text-muted-foreground sm:flex-row">
        <nav className="flex items-center gap-4">
          <Link to="/terms" className="transition-colors hover:text-foreground">
            Terms
          </Link>
          <Link to="/privacy" className="transition-colors hover:text-foreground">
            Privacy
          </Link>
          <Link to="/contact" className="transition-colors hover:text-foreground">
            Contact
          </Link>
        </nav>
        <a
          href="https://tamplaylab.com"
          target="_blank"
          rel="noreferrer"
          className="transition-colors hover:text-foreground"
        >
          Powered by <span className="font-semibold">tamplaylab.com</span>
        </a>
      </div>
    </footer>
  );
}
