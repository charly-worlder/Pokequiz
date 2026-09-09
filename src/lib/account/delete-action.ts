'use server'

import { redirect } from 'next/navigation'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registerAttempt, refundAccountDeleteAttempt } from '@/lib/auth/throttle'
import {
  throttleMessage,
  WRONG_PASSWORD_MESSAGE,
  DELETE_FAILED_MESSAGE,
  type ActionState,
} from '@/lib/auth/error-mapping'

/**
 * Die Kontolöschung (PROJ-4, spec.md AC-9 bis AC-12, AC-15 bis AC-17, AC-20 bis
 * AC-22; EC-1, EC-3, EC-4, EC-8).
 *
 * **Diese Action nimmt genau ein Feld entgegen: das Passwort.** Es gibt keinen
 * Parameter für eine Konto-Kennung, eine Adresse oder eine Sitzungskennung.
 * AC-16 wird dadurch nicht *geprüft*, sondern *unmöglich* — was nicht angenommen
 * wird, kann niemand unterschieben. Dieses Projekt hat mit BUG-17, BUG-90 und
 * BUG-91 dreimal dieselbe Klasse gehabt: eine Prüfung, die fehlte oder zu schwach
 * war. Eine fehlende Prüfung kann jemand später entfernen; einen Parameter, den
 * es nicht gibt, kann niemand hinzufügen, ohne dass es auffällt.
 */

/**
 * Prüft ein Passwort, **ohne die Sitzung des Nutzers anzufassen**.
 *
 * Es gibt bei Supabase keine Schnittstelle „prüfe dieses Passwort". Der eingebaute
 * Weg (`reauthenticate`) verschickt einen Code **per E-Mail** und ist für dieses
 * Projekt damit unbrauchbar: Es hat bewusst keinen funktionierenden Mailversand
 * (`docs/PRD.md` → Rahmenbedingungen), und `secure_password_change` steht in
 * `config.toml` auf `false`.
 *
 * Bleibt der Anmeldeversuch. Er läuft auf einem **eigenen Client ohne
 * Sitzungsspeicherung**: Er schreibt keine Cookies, dreht keine Token und lässt
 * die bestehende Anmeldung unberührt. Würde man dafür den Server-Client der
 * Anfrage benutzen, würde ein geglückter Versuch die Cookies des Nutzers
 * überschreiben — ausgerechnet in dem Moment, in dem sie gleich gelöscht werden
 * sollen, und bei einem *fehlgeschlagenen* Löschversuch bliebe eine frisch
 * gedrehte Sitzung zurück.
 *
 * **Der Preis, benannt:** Dieser Versuch zählt gegen das gemeinsame
 * Anmeldekontingent des Auth-Dienstes, das wegen der Server-Action-Architektur
 * für alle Spieler an derselben Server-IP hängt (BUG-21). Genau deshalb sitzt die
 * eigene Drosselung **davor** und nicht dahinter.
 */
async function passwordIsCorrect(email: string, password: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('Supabase-Zugangsdaten fehlen.')

  const probe = createSupabaseClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const { error } = await probe.auth.signInWithPassword({ email, password })
  return !error
}

export async function deleteAccountAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const password = formData.get('password')
  if (typeof password !== 'string' || password.length === 0) {
    return { fieldErrors: { password: 'Bitte gib dein Passwort ein.' } }
  }

  // Schritt 1 — Wer bin ich? Über den Auth-Dienst, nicht über den Token-Inhalt.
  //
  // **Hieran hängt AC-21.** Das Löschen eines Kontos macht ein bereits
  // ausgestelltes Token nicht ungültig — es läuft erst nach einer Stunde ab
  // (`jwt_expiry = 3600`). Wer den Token nur lokal prüft, hält einen gelöschten
  // Nutzer bis dahin für angemeldet. `getUser()` fragt den Dienst und bekommt für
  // ein gelöschtes Konto einen Fehler. Derselbe Grund wie bei BUG-3 im Proxy.
  let supabase
  try {
    supabase = await createClient()
  } catch {
    return { error: DELETE_FAILED_MESSAGE }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Auch der zweite Aufruf nach erfolgreicher Löschung landet hier (EC-1): Das
  // Konto gibt es nicht mehr, also gibt es keine Sitzung. Der Nutzer sieht die
  // Anmeldeseite, keine Fehlermeldung.
  if (!user?.email) redirect('/login')

  // Schritt 2 — Drosselung: **ein** Aufruf für beide Hälften (AC-15).
  //
  // `registerAttempt` zählt die Verbindung **immer** und das Konto zusätzlich,
  // sobald eine Adresse dabei ist. Beim Bau stand hier zunächst ein zweiter
  // Aufruf davor (erst die Verbindung ohne Adresse, dann das Konto) — das zählte
  // die Verbindung **doppelt** und halbierte ihre Grenze still. Gefunden hat es
  // `tests/PROJ-4-delete-throttle.spec.ts`, weil dort die 5 buchstäblich geprüft
  // wird statt „nach vielen Versuchen"; genau dafür ist ein literaler
  // Grenzwert-Test da (BUG-101 in PROJ-1 ist die Gegenprobe: vier ungepinnte
  // Grenzwerte, an denen so etwas unbemerkt bliebe).
  //
  // Dass die Sitzungsprüfung davor liegt, ist unbedenklich: Sie prüft keine
  // Zugangsdaten, sondern liest ein vorhandenes Cookie. Entscheidend für AC-15
  // ist, dass **kein Passwort** geprüft wird, bevor der Zähler zugestimmt hat.
  let throttle
  try {
    throttle = await registerAttempt('account-delete', user.email)
  } catch {
    return { error: DELETE_FAILED_MESSAGE }
  }
  if (!throttle.allowed) {
    return { error: throttleMessage(throttle.blockedBy) }
  }

  // Schritt 3 — Passwort (AC-9, AC-11).
  let correct: boolean
  try {
    correct = await passwordIsCorrect(user.email, password)
  } catch {
    return { error: DELETE_FAILED_MESSAGE }
  }
  if (!correct) {
    return { fieldErrors: { password: WRONG_PASSWORD_MESSAGE } }
  }

  // Schritt 4 — Löschen. **Hart, nicht weich.** Eine weiche Löschung behielte die
  // Auth-Zeile und machte den Nutzer über die gehashte Kennung weiter
  // identifizierbar — damit wären AC-13 (Adresse und Name wieder frei) und AC-17
  // (kein Personenbezug mehr) gebrochen, und der Aufräum-Trigger feuerte nicht
  // einmal, weil nichts gelöscht würde. Der zweite Parameter ist deshalb
  // ausdrücklich `false` und kein Standardwert, auf den man sich verlässt.
  //
  // Die Kennung stammt **ausschließlich** aus Schritt 2 (AC-16).
  //
  // Postgres entfernt in derselben Transaktion Profil, alle Runden und den
  // laufenden Rundenzustand über die Fremdschlüssel-Kaskaden, und der Trigger
  // `on_auth_user_deleted` die Zählerzeilen der Adresse. Es gibt keinen
  // Zwischenzustand — belegt in `tests/PROJ-4-deletion-cascade.spec.ts`, in
  // beide Richtungen.
  let deleteFailed = false
  try {
    const { error } = await createAdminClient().auth.admin.deleteUser(user.id, false)
    deleteFailed = Boolean(error)
  } catch {
    deleteFailed = true
  }

  if (deleteFailed) {
    // Erstattung genau eines Versuchs auf beiden Zählern — **nur hier**, hinter
    // der bestandenen Passwortprüfung. Ohne sie machte eine Datenbankstörung aus
    // dem Missbrauchsschutz eine Sperre gegen den rechtmäßigen Eigentümer: fünf
    // Fehlversuche der Infrastruktur, und er kommt 15 Minuten lang nicht an sein
    // eigenes Konto. Wer das Passwort nicht kennt, erreicht diese Zeile nie.
    await refundAccountDeleteAttempt(user.email)
    return { error: DELETE_FAILED_MESSAGE }
  }

  // Schritt 5 — Sitzung örtlich beenden (AC-12). `scope: 'local'` löscht die
  // Cookies, **ohne** den Auth-Dienst zu fragen: Dort gibt es das Konto nicht
  // mehr, ein Abmelde-Aufruf hätte nichts zu beenden und liefe in einen Fehler.
  await supabase.auth.signOut({ scope: 'local' })

  // Schritt 6 — Bestätigung auf der Anmeldeseite (AC-12).
  redirect('/login?geloescht=1')
}
