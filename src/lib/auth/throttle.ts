import 'server-only'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Drosselung der Zugangsdaten-Pfade (BUG-29, `.claude/rules/security.md`).
 *
 * **Warum sie in den Actions sitzt und nicht im Proxy.** Next.js bindet eine
 * Server Action nicht an die Route, auf der sie definiert wurde: `loginAction`
 * läuft unter `/`, unter `/privacy` und — weil der Proxy-Matcher Bild-Endungen
 * ausnimmt — unter jedem `*.png`. Eine Schranke davor ist umgehbar, gemessen im
 * QA-Lauf vom 2026-09-05 (BUG-30, BUG-31). Hier ist sie es nicht: Wer die Action
 * erreicht, erreicht auch den Zähler.
 *
 * **Zwei Zähler, weil einer beide Angriffe nicht abdeckt** (siehe
 * `docs/stacks/backend-supabase.md`): Der IP-Zähler bremst das schnelle Raten von
 * einer Stelle aus. Er hilft nicht gegen einen Angreifer, der IPs wechselt oder
 * ein gängiges Passwort gegen viele Konten probiert — dafür der Konto-Zähler.
 */

/** Grenzwerte aus `docs/production/rate-limiting.md` → Recommended Limits. */
export const LIMITS = {
  /** Login/Register: 5 Anfragen pro Minute. */
  credentialsPerIp: { limit: 5, windowSeconds: 60 },
  /** Passwort-Reset: 3 Anfragen pro 5 Minuten. */
  passwordResetPerIp: { limit: 3, windowSeconds: 300 },
  /**
   * Der Konto-Zähler ist bewusst weiter gefasst als der IP-Zähler — und das ist
   * ein Kompromiss, kein Versehen.
   *
   * Ein enger Konto-Zähler stoppt verteiltes Raten wirksam, macht aber zugleich
   * jedes Konto aussperrbar: Wer eine Adresse kennt, hält sie mit ein paar
   * Anfragen pro Minute dauerhaft draußen. Das Gegenmittel dafür wäre ein CAPTCHA
   * — `.claude/rules/security.md` nennt es in einem Atemzug mit dem Zähler —, und
   * genau das hat dieses Produkt bewusst nicht (`docs/PRD.md`: „ohne Erklärung
   * sofort loslegen").
   *
   * 20 Fehlversuche in 15 Minuten ist der gewählte Mittelweg: zu wenig, um ein
   * Passwort zu erraten, zu viel, um jemanden mit einem Skript billig
   * lahmzulegen — und das Fenster heilt von selbst aus. Die Entscheidung samt
   * ihrem Preis steht in `features/PROJ-1-user-login/design.md`.
   */
  credentialsPerAccount: { limit: 20, windowSeconds: 900 },
} as const

type Limit = { limit: number; windowSeconds: number }

/**
 * Die anfragende IP, so gut sie serverseitig feststellbar ist.
 *
 * `x-forwarded-for` kann ein Client selbst setzen, solange kein Reverse Proxy
 * davorsteht, der den Header überschreibt. Der IP-Zähler ist deshalb die
 * schwächere der beiden Hälften — er bremst das gewöhnliche schnelle Raten, nicht
 * den, der den Header fälscht. Genau dagegen steht der Konto-Zähler, den man
 * nicht umgehen kann, indem man sich eine andere Herkunft ausdenkt.
 *
 * Beim `/deploy` gehört der Header vom Host gesetzt und clientseitige Werte
 * verworfen — dieselbe Hausaufgabe wie bei BUG-18 (`X-Forwarded-Host`).
 */
async function clientIp(): Promise<string> {
  const headerList = await headers()
  const forwarded = headerList.get('x-forwarded-for')
  // Der erste Eintrag ist der ursprüngliche Client; alles dahinter sind Proxys.
  const first = forwarded?.split(',')[0]?.trim()
  return first || headerList.get('x-real-ip') || 'unbekannt'
}

/** Adressen sind Groß-/Kleinschreibung egal — sonst wären `A@b.de` und `a@b.de` zwei Zähler. */
function accountKey(scope: string, email: string) {
  return `${scope}:account:${email.trim().toLowerCase()}`
}

async function count(key: string, { limit, windowSeconds }: Limit): Promise<boolean> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('register_auth_attempt', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })

  // Fehlt die Migration oder ist die Datenbank weg, wird **nicht** durchgewunken.
  // Eine Drosselung, die im Fehlerfall stillschweigend aufmacht, ist genau dann
  // nicht da, wenn etwas nicht stimmt.
  if (error) throw new Error(`Drosselung nicht zählbar: ${error.message}`)
  return data === true
}

export type ThrottleScope = 'login' | 'register' | 'password-reset'

/**
 * Zählt einen Versuch auf beiden Zählern und meldet, ob er erlaubt bleibt.
 *
 * **Beide werden immer gezählt**, auch wenn der erste schon abgelehnt hat: Sonst
 * könnte ein Angreifer den Konto-Zähler leer halten, indem er den IP-Zähler
 * absichtlich überlaufen lässt.
 */
export async function registerAttempt(
  scope: ThrottleScope,
  email: string | null
): Promise<{ allowed: boolean }> {
  const ipLimit = scope === 'password-reset' ? LIMITS.passwordResetPerIp : LIMITS.credentialsPerIp

  const checks = [count(`${scope}:ip:${await clientIp()}`, ipLimit)]
  if (email) {
    checks.push(count(accountKey(scope, email), LIMITS.credentialsPerAccount))
  }

  const results = await Promise.all(checks)
  return { allowed: results.every(Boolean) }
}

/**
 * Räumt nach einer **erfolgreichen Anmeldung** auf — und tut dabei zwei
 * verschiedene Dinge, weil die beiden Zähler verschiedene Angriffe abwehren.
 *
 * **Konto-Zähler: gelöscht.** Wer sich viermal vertippt und beim fünften Mal
 * richtig liegt, soll nicht den Rest des Fensters mit einem fast vollen Zähler
 * herumlaufen. Das ist unbedenklich: Der Konto-Zähler schützt genau dieses eine
 * Konto, und wer sein eigenes Passwort kennt, greift es nicht an.
 *
 * **IP-Zähler: um genau diesen einen Versuch erstattet, nicht geleert.** Damit
 * zählt er im Ergebnis nur noch **Fehl**versuche. Die beiden Fehler, zwischen
 * denen diese Zeile liegt, erklären warum:
 *
 * - **BUG-39** (High): Vorher wurde der IP-Zähler bei jedem geglückten Login
 *   *gelöscht*. Das machte ihn abschaltbar — wer ein einziges eigenes Konto
 *   besitzt, schiebt zwischen seine Rateversuche je einen erfolgreichen Login
 *   und fängt von vorn an, ganz ohne Header-Fälschung. Gemessen: 24
 *   Passwortversuche gegen 24 Konten von einer IP in 3,6 Sekunden, null
 *   abgewiesen. Eine Bremse, die der Angreifer selbst lösen kann, ist keine —
 *   und gegen **Passwort-Spraying** ist sie die einzige, weil der Konto-Zähler
 *   dort nichts sieht (jedes Opferkonto bekommt genau einen Versuch).
 * - **BUG-54** (Medium): Der Fix dafür ließ den Zähler stehen — und traf damit
 *   die Falschen. Gezählt wird **vor** der Passwortprüfung, ein geglückter Login
 *   verbrauchte also Budget. Gemessen: acht verschiedene Spieler mit richtigem
 *   Passwort hinter einer geteilten Adresse — fünf kommen hinein, drei sehen
 *   „Zu viele Versuche". Das trifft Familien- und Schulanschlüsse und
 *   Mobilfunk-CGNAT; die Zielgruppe im PRD schließt Kinder ausdrücklich ein.
 *
 * Die Erstattung löst beides: Ein erfolgreicher Login kostet unterm Strich
 * nichts, und ein Angreifer bekommt dadurch keinen einzigen zusätzlichen
 * Rateversuch — er hat weiter genau `credentialsPerIp.limit` **Fehl**versuche je
 * Fenster, egal wie oft er sich dazwischen selbst anmeldet.
 *
 * **Warum erstattet und nicht „erst prüfen, dann zählen":** Das Hochzählen und
 * das Prüfen stecken bewusst in einem einzigen SQL-Statement (`0003`), damit
 * gleichzeitige Anfragen sich nicht überholen. Getrenntes Lesen und Schreiben
 * würde genau diese Lücke wieder aufreißen — 100 parallele Anfragen sähen alle
 * den Zähler auf 0.
 *
 * **Diese Funktion gilt nur für den Login.** Sie nimmt bewusst keinen `scope`
 * entgegen: Registrierung und Passwort-Reset dürfen **nicht** erstatten, weil
 * dort die begrenzte Sache die Handlung selbst ist — Konten anlegen, Mails
 * verschicken — und nicht das Raten. Mit Erstattung wäre die Massenanlage von
 * Konten unbegrenzt (BUG-47).
 */
export async function settleSuccessfulLogin(email: string): Promise<void> {
  const admin = createAdminClient()
  const scope: ThrottleScope = 'login'

  const [cleared, refunded] = await Promise.all([
    admin.rpc('clear_auth_attempts', { p_keys: [accountKey(scope, email)] }),
    admin.rpc('refund_auth_attempt', { p_key: `${scope}:ip:${await clientIp()}` }),
  ])

  // Ein Fehler hier macht den erfolgreichen Login nicht ungültig — er lässt nur
  // den Zähler stehen. Das ist die sichere Richtung, also kein Wurf.
  const failure = cleared.error ?? refunded.error
  if (failure) {
    console.error('Zähler konnte nach erfolgreicher Anmeldung nicht bereinigt werden', failure)
  }
}
