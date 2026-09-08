import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BallMark } from '@/components/shell/wordmark'

/**
 * Der Leerzustand der Rangliste (spec.md AC-17) — **und zugleich der Hinweis aus
 * AC-9**.
 *
 * Die beiden Kriterien beschreiben denselben Bildschirm aus zwei Blickwinkeln:
 * Wenn niemand gewertet ist, ist auch der Betrachter nicht gewertet. Zwei
 * gestapelte Meldungen sagten ihm zweimal dasselbe. Der eine Satz des
 * Leerzustands trägt deshalb die Aussage von AC-9 („mindestens eine Frage
 * richtig beantworten"), und der Primär-Button ist das „Runde starten" aus AC-9
 * und AC-14 zugleich.
 *
 * Form nach `docs/app-shell.md` → Seiten-Muster: gedämpftes Ball-Motiv, ein Satz
 * in `--muted-foreground`, darunter die naheliegende Aktion als Primär-Button.
 */
export function LeaderboardEmpty() {
  return (
    <div className="animate-[in_0.4s_ease-out] flex flex-col items-center gap-5 py-10 text-center">
      <BallMark className="size-14 opacity-40" />

      <p className="mx-auto max-w-[40ch] text-[15px] text-muted-foreground text-pretty">
        Noch hat niemand einen gewerteten Lauf. Beantworte mindestens{' '}
        <strong className="font-semibold text-foreground">eine Frage richtig</strong>, und du stehst
        als Erster in der Weltrangliste.
      </p>

      <Button asChild size="lg" className="min-h-12 px-8 text-[17px]">
        <Link href="/">Runde starten</Link>
      </Button>
    </div>
  )
}

/**
 * Derselbe Gedanke für den anderen Fall: Es **gibt** eine Rangliste, aber dieser
 * Spieler hat noch keinen gewerteten Lauf (spec.md AC-9).
 *
 * Steht unter der Liste an der Stelle, an der sonst die eigene Zeile stünde —
 * die Antwort auf „wo stehe ich?" ist hier „noch nirgends, und das änderst du
 * so".
 */
export function NoRankedRunHint() {
  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="px-3 text-[13px] text-muted-foreground text-pretty sm:px-4">
        Du bist noch nicht in der Wertung. Beantworte mindestens{' '}
        <strong className="font-semibold text-foreground">eine Frage richtig</strong>, dann erscheint
        dein bester Lauf hier.
      </p>
    </div>
  )
}
