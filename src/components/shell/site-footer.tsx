import Link from 'next/link'

/**
 * spec.md AC-23 — on every page, signed in or out.
 *
 * The footer shows a legal link only once its page actually exists. PROJ-4
 * builds /privacy and /imprint; until then this list stays empty and the footer
 * renders no link rather than a dead one (docs/app-shell.md → Layout-Regionen).
 * PROJ-4's job is to add the entries here.
 */
const LEGAL_PAGES: { href: string; label: string }[] = []

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-[clamp(18px,4vw,44px)] py-5">
        <p className="text-[12px] text-muted-foreground">
          Ein Fan-Quiz. Pokémon ist eine Marke ihrer jeweiligen Inhaber.
        </p>
        {LEGAL_PAGES.length > 0 && (
          <nav aria-label="Rechtliches" className="flex gap-4">
            {LEGAL_PAGES.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                className="rounded text-[12px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {page.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </footer>
  )
}
