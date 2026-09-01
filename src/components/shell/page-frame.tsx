import { SiteHeader } from './site-header'
import { SiteFooter } from './site-footer'

/**
 * Header + content + footer — the shared shell of every screen
 * (docs/app-shell.md → Layout-Regionen). Lives in the root layout, so PROJ-3
 * and PROJ-4 inherit it without doing anything.
 */
export function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}
