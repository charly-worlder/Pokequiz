import Link from 'next/link'

/**
 * spec.md AC-23 — on every page, signed in or out.
 *
 * The footer shows a legal link only once its page actually exists. The list
 * stayed empty until 2026-09-10 so the footer would render no link rather than a
 * dead one (docs/app-shell.md → Layout-Regionen); both pages exist since then
 * (`src/app/privacy/page.tsx`, `src/app/imprint/page.tsx`) and are public in
 * `src/proxy.ts` → PUBLIC_PATHS, so a signed-out visitor reaches them too.
 *
 * Both pages carry placeholder text on purpose — see the notice at the top of
 * each one and features/INDEX.md → Deploy-Blocker. That is a reason to fill them
 * in before going live, not a reason to hide the links: a footer without them is
 * itself a defect under DDG § 5 and Art. 13 GDPR.
 */
const LEGAL_PAGES: { href: string; label: string }[] = [
  { href: '/privacy', label: 'Datenschutz' },
  { href: '/imprint', label: 'Impressum' },
]

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
