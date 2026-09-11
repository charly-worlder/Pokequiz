import { AuthCard } from '@/components/auth/auth-card'

/**
 * PROJ-4 AC-12 — die Bestätigung nach einer geglückten Kontolöschung.
 *
 * Der Merker kommt aus der Umleitung der Lösch-Action (`/login?geloescht=1`).
 * **Nur ein Satz, keine Karte:** Der Nutzer hat gerade bewusst gehandelt und
 * braucht keine Feier, sondern die Gewissheit, dass es passiert ist. Und er
 * erscheint ausdrücklich **nur** mit dem Merker — wer `/login` einfach so
 * aufruft, sieht nichts davon.
 *
 * Der Merker ist ein reines Anzeigesignal und keine Zusicherung: Wer die URL von
 * Hand tippt, bekommt den Satz zu sehen, ohne dass etwas gelöscht wurde. Das ist
 * harmlos — es steht dort keine Information über ein Konto, nur eine Aussage
 * über eine Handlung, die der Betrachter selbst ausgelöst haben müsste.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ geloescht?: string }>
}) {
  const { geloescht } = await searchParams

  return (
    // BUG-5 (PROJ-1/qa-report.md): this used to be a <main>. Since PROJ-2 the
    // app shell provides the page's <main> (components/shell/page-frame.tsx),
    // so a second one here nested two "main" landmarks in one document —
    // invalid HTML, and screen readers offer both.
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6">
      {geloescht === '1' && (
        <p
          role="status"
          className="w-full max-w-md rounded-card border border-border bg-card px-4 py-3 text-center text-[15px]"
        >
          Dein Konto wurde gelöscht. Alle deine Runden und dein Ranglisten-Eintrag sind entfernt.
        </p>
      )}
      <AuthCard />
    </div>
  )
}
