/** Consistent "Powered by tamplaylab.com" attribution, used across app pages. */
export function PoweredByFooter() {
  return (
    <footer className="border-t border-border/60 py-6">
      <div className="mx-auto flex max-w-6xl items-center justify-center px-4 text-xs text-muted-foreground sm:justify-end">
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
