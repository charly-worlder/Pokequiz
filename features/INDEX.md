# Feature Index

> Central tracking for all features. Updated by skills automatically.

## Status Legend
- **Roadmap** - `/init` done, feature identified in feature map, no spec file yet
- **Mapped** - already built before the kit arrived; proposed by `/map`, confirmed at `/init`, no spec folder yet — `/reverse-spec` writes it
- **Spec'd** - `/reverse-spec` done: runs in production, criteria confirmed, not yet verified — `/qa` closes that gap
- **Planned** - `/write-spec` done, full spec written, architecture not yet designed
- **Architected** - `/architecture` done, tech design approved, ready to build
- **Tasked** - `/tasks` done, tasks.md approved, ready to build
- **In Progress** - `/build` active or completed, not yet in QA
- **In Review** - `/qa` active, testing in progress
- **Approved** - `/qa` passed, no critical/high bugs, ready to deploy
- **Deployed** - `/deploy` done, live in production

## Features

> The **Spec** column links to the feature **folder** (`features/PROJ-X-name/`), not a single file. Each folder contains `spec.md`, `design.md`, `tasks.md`, and `qa-report.md`.
>
> **Feature** is the name only — two to four words, the way you would say it ("User accounts & login", "Kanban board"). **Description** is one sentence of what it does. Priority and dependencies are not columns: they are the **build order** line under the table, and it is the only place they live — there is no second roadmap table anywhere else.

| ID | Feature | Description | Status | Spec | Created |
|----|---------|-------------|--------|------|---------|
| PROJ-1 | Benutzerkonto & Login | Registrierung und Anmeldung per E-Mail/Passwort, dazu ein eindeutiger Trainername als öffentlicher Anzeigename | Approved | [Spec](PROJ-1-user-login/spec.md) | 2026-08-30 |
| PROJ-2 | Pokémon-Quiz | Eine **serverseitig geführte** Runde aus Bild-Fragen mit vier deutschen Namensoptionen, Serien-Zähler und Zeitmessung bis zum ersten Fehler | Approved | [Spec](PROJ-2-pokemon-quiz/spec.md) | 2026-08-30 |
| PROJ-3 | Weltrangliste | Globale Top-5 nach Serie absteigend, bei Gleichstand nach Zeit aufsteigend, mit Eintrag des eigenen Ergebnisses | Approved | [Spec](PROJ-3-leaderboard/spec.md) | 2026-08-30 |
| PROJ-4 | Datenschutz & Kontolöschung | Datenschutzerklärung und die Möglichkeit, das eigene Konto samt Ranglisten-Einträgen zu löschen | Roadmap | — | 2026-08-30 |

**Build order:** P0 (MVP): PROJ-1 → PROJ-2 → PROJ-3 · P1: PROJ-4 (braucht PROJ-1)

<!-- Add features above this line -->

## Deploy-Blocker

> Dinge, die den jetzigen Stand **nicht** kaputt machen — die Features sind zu Recht `Approved` —, die aber vor dem öffentlichen Start erledigt sein müssen. `/deploy` arbeitet diese Liste ab. Die vollständige Einordnung steht jeweils im `qa-report.md` des Features.

| Feature | Blocker | Behebbar |
|---------|---------|----------|
| PROJ-1 | ~~**AC-8 / EC-4** — Rate-Limit lokal nicht auslösbar~~ — **erledigt** am 2026-09-04: gegen das gehostete Projekt gemessen, 429 bei Versuch 33. BUG-7 geschlossen | ✅ |
| PROJ-1 | ~~**AC-8 verspricht einen Schutz, den die Architektur nicht liefern kann** (BUG-21)~~ — **erledigt** am 2026-09-05. Beide geforderten Hälften liegen vor: Der eigene, zweiteilige Zähler ist seit BUG-29 gebaut und gemessen (Verbindung 5/Min, Konto 20/15 Min, Erstattung bei Erfolg), und `/refine` hat AC-8 und EC-4 darauf umgeschrieben sowie AC-16/AC-17/AC-18 und EC-8/EC-9 ergänzt. Supabases Regel steht nur noch als zweite Ebene im Vertrag, ausdrücklich als Untergrenze statt als Schutz. **Die Wirksamkeit der IP-Hälfte hängt weiterhin an BUG-61** (Zeile weiter unten) — das ist jetzt auch in AC-8 als Bedingung ausgeschrieben, statt stillschweigend vorausgesetzt zu werden | ✅ |
| **PROJEKT** | **Site-URL im gehosteten Projekt steht auf `http://localhost:3000`** — vom abgebrochenen `supabase config push` geschrieben, am 2026-09-04 im Dashboard bestätigt. Ohne Korrektur zeigt jeder Mail-Link in Produktion ins Leere. Zusammen mit der Absender-Domain zu setzen | beim Deploy, zwingend |
| **PROJEKT** | **Eigener SMTP-Dienst und Absender-Domain fehlen** — Supabases eingebauter Versand stellt nur an Team-Adressen zu (2/Stunde, nicht für Produktion). **Der Passwort-Reset funktioniert für echte Spieler damit gar nicht**, und ohne eigenen SMTP bleiben die E-Mail-Vorlagen im Free Tier gesperrt. Siehe `docs/PRD.md` → Rahmenbedingungen | **blockiert** — keine Domain vorhanden (Stand 2026-09-04) |
| PROJ-1 | **T18** — Reset-Mail-Vorlage im gehosteten Projekt setzen. Ohne sie verschickt die Produktion den PKCE-Standardlink und der geräteübergreifende Reset (EC-7) ist erneut kaputt. **Nicht setzbar**, solange kein eigener SMTP-Dienst konfiguriert ist: `supabase config push` scheitert mit `400 Email template modification is not available for free tier projects using the default email provider`.<br>**Am 2026-09-05 kam ein zweiter Grund dazu:** Ohne die eigene Vorlage nimmt Supabase die Standardvorlage mit `{{ .ConfirmationURL }}`, die aus `redirect_to` gebaut wird — und `redirect_to` speist sich aus dem ungeprüften `origin`-Header der Anfrage (**BUG-77**). Steht die Redirect-Allowlist des gehosteten Projekts dann weit, zeigt der Reset-Link eines Opfers auf eine fremde Domain. Beim Setzen von T18 gehört deshalb die URL Configuration mitgeprüft | erst nach eigenem SMTP |
| PROJ-1 | ~~**T4** — Passwort-Mindestlänge (8) im Dashboard des gehosteten Projekts setzen~~ — **erledigt** am 2026-09-05, vom Nutzer im Dashboard gesetzt. Der lokale Spiegel in `config.toml` war bereits gesetzt und verifiziert. **Korrektur an dieser Zeile:** Sie führte die Aufgabe als „erst nach dem ersten `/deploy`" — das war falsch. `tasks.md` → T4 sagt ausdrücklich, sie braucht **nur ein gehostetes Projekt, keinen App-Deploy**, und ein solches existiert seit dem 2026-09-04. Der QA-Lauf vom 2026-09-05 hat den Widerspruch aufgedeckt. **Gegengemessen am 2026-09-05:** Registrierung mit 7 Zeichen gegen das gehostete Projekt → `HTTP 422 · weak_password · "Password should be at least 8 characters."`, **kein Konto angelegt**. Mit lokaler Kontrollmessung abgesichert, damit ein negatives Ergebnis deutbar gewesen wäre | ✅ |
| PROJ-1 | **AC-11 / AC-12** — der Passwort-Reset-Link hängt an Site-URL und Redirect-URLs des gehosteten Projekts | erst gegen das gehostete Projekt |
| PROJ-1 | ~~**Warnhinweis am Trainername-Feld**~~ — **erledigt** am 2026-09-03: `AC-15` gebaut (`T14`) und im QA-Lauf verifiziert | ✅ |
| PROJ-1 | **Security-Header fehlen** — `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` sind nirgends gesetzt (BUG-12). Werden beim Host konfiguriert und müssen gegen die Live-URL geprüft werden. **Am 2026-09-04 im QA-Lauf zu PROJ-2 neu bewertet: Medium statt Low** — es trifft jede Route, auch die Shell, und `Referrer-Policy` ist in einem Produkt mit Bild-Weiterleitung nicht kosmetisch | beim Deploy |
| PROJ-1 | **⛔ Härtester Deploy-Blocker: Der Host muss `x-forwarded-for` selbst setzen und einen vom Client mitgebrachten Wert verwerfen** (BUG-61, ursprünglich High — am 2026-09-05 auf Entscheidung des Nutzers zum Deploy-Blocker umgestuft; BUG-53 geht darin auf). **Beide Richtungen sind Pflicht:** *(a)* Setzt der Host **gar keinen** Header, fallen alle Spieler auf den gemeinsamen Zählerschlüssel `unbekannt` mit 5 Versuchen pro Minute — der Schutz wird zur Aussperr-Waffe gegen die eigenen Nutzer. *(b)* **Hängt** der Host nur **an**, statt zu überschreiben (der gewöhnliche nginx-Aufbau mit `proxy_add_x_forwarded_for`), bleibt der erste Eintrag angreiferkontrolliert und die IP-Hälfte der Drosselung ist mit einer Kopfzeile abschaltbar: **gemessen 40 Rateversuche gegen 40 verschiedene Konten in 5 s, null abgewiesen**, dazu 25 neue Konten in 9 s. Ohne CAPTCHA (bewusst nicht vorhanden) ist der IP-Zähler die einzige Bremse gegen Passwort-Spraying.<br>**Anbieter-Voraussetzung:** ein Host, der den Header selbst setzt bzw. überschreibt — **Vercel tut das**; bei einem eigenen nginx/Traefik-Aufbau muss die Konfiguration ausdrücklich auf Überschreiben statt Anhängen gestellt werden. `deploy` steht in `.ai-eng-kit` noch auf `null`.<br>**Schließbedingung — und nur diese:** gegen die **echte Live-URL** gemessen, dass ein selbst gesetzter `x-forwarded-for` den Zähler **nicht** beeinflusst (Rateversuche mit rotierendem Header müssen ab dem 6. abgewiesen werden). Erst dann gilt BUG-61 als geschlossen. Eine Zusage des Anbieters in einer Dokumentation genügt nicht | beim Deploy, **zwingend** |
| PROJ-1 | ~~**Kontoexistenz über den Passwort-Reset ermittelbar** (BUG-79, High)~~ — **behoben** am 2026-09-06: `mapPasswordResetRequestError` schluckt jeden Fehler, der 429-Zweig ist weg. Live gegengeprüft: je 2 Anfragen für 5 echte und 5 erfundene Adressen, **alle zehn Paare identisch**. **⚠️ Am 2026-09-06 im Nachlauf widerlegt: der Fix reichte nicht.** Der Meldungstext ist vereinheitlicht, aber der `Set-Cookie`-Header verrät die Kontoexistenz weiter — bei Supabases 429 löscht `@supabase/ssr` die PKCE-Cookies in dieselbe Antwort. **30/30 korrekt, 4,13 Adressen/s, doppelt so schnell wie zuvor** (BUG-87). — **Am 2026-09-06 behoben, diesmal strukturell:** Die Antwort dieses Pfades entsteht an einer Stelle, die alle drei Kanaele schliesst (Rueckgabewert, geworfener Fehler, Cookies); der Waechter vergleicht die **ausgehende Antwort** statt einer Funktion und wurde durch Wiedereinbau des Fehlers rot geprueft. Der Zeitkanal ist seit dem als EC-11 im Vertrag und durch die Server Action gemessen: **eine Anfrage genügt für 97,5 %**. Ursprünglicher Befund — Supabases `429 over_email_send_rate_limit` tritt nur bei existierenden Konten auf und wird auf die Drosselungsmeldung abgebildet; die unbekannte Adresse bekommt die Bestätigung. **30/30 Adressen korrekt bestimmt, ~2 Adressen/s.** Bricht AC-10 und EC-3 im Wortlaut. **Gehostet wird das Fenster 60× breiter** (`max_frequency` 60 s statt 1 s). Nicht erst beim Deploy zu beheben, sondern im Code — steht hier, weil es zusätzlich die Begründung von **EC-9** entwertet (dort ist das Aussperren als Low akzeptiert, *weil man die Adresse kennen muss*).<br>**✅ Am 2026-09-06 unabhängig gegengeprüft und geschlossen.** Drei Belege aus Kontexten, die den Fix nicht gebaut haben: Lane 2 Blindtest **24 Sonden → 1 einziger Fingerabdruck** (Status + Rumpf + Länge + alle `Set-Cookie` + alle Header-Namen); Lane 1 unabhängig **byte-identischer Rumpf, 0 Cookies, Header-`diff` leer**; beide mit Mailpit-Gegenkontrolle, dass der Versand weiterhin stattfindet. Der Owner hat zusätzlich das Orakel **selbst wieder eingebaut**, in der N23-Klasse (inline in `actions.ts`, Leck nur über Cookies): `npm test` **209/209 grün** (Unit-Ebene blind), der E2E-Wächter **rot in Zeile 106** mit der richtigen Diagnose, nach Rücknahme wieder grün | ✅ |
| PROJ-1 | ~~**⛔ Kontoübernahme über `updatePasswordAction`**~~ — **behoben am 2026-09-06.** `updatePasswordAction` verlangt jetzt eine echte **Recovery-Sitzung** (erkannt am `amr`-Anspruch des signierten JWT: `password` beim Login, `otp` nach `verifyOtp({type:'recovery'})`) und zählt auf einem eigenen Scope `password-update` (10/15 min). **Laufzeit gegengeprüft:** die abgefangene Anfrage eines legitimen Resets, wiederholt mit dem Cookie-Glas einer gewöhnlichen Login-Sitzung → **abgewiesen**, Angriffspasswort gilt nicht, vorheriges gilt weiter; 15 Aufrufe von einer Verbindung → **8 abgewiesen** (vorher 0 von 12). Der legitime Reset (AC-11) läuft unverändert. **Rot-Nachweis auf beiden Ebenen:** Entscheidung (`hasRecoverySession` immer `true`) **und** Verdrahtung (die Action fragt nicht mehr) werden beide rot — die Trennung, an der BUG-75/87/91 gescheitert sind. Detail unten (Original) | ✅ |
| PROJ-1 | _(Original zu BUG-91, High — fasst BUG-17 und BUG-90 zusammen; BUG-17 steht seit dem 2026-09-04 offen). `src/lib/auth/actions.ts:161-193` prüft nur `getUser()`, **nicht ob es eine Recovery-Sitzung ist**, und ruft `registerAttempt` gar nicht auf — `design.md` → Behaviors & Access verspricht ausdrücklich „nur mit gültiger Recovery-Sitzung". **Am 2026-09-06 erstmals zur Laufzeit vollständig durchgespielt:** mit einer gewöhnlichen Login-Sitzung Passwort gesetzt → Login mit **altem** Passwort abgelehnt, mit **neuem** erfolgreich; **12 Aufrufe von einer IP, 0 abgewiesen**. Da die Sitzung laut AC-5 mit `Max-Age=34560000` bis zum aktiven Logout läuft, übernimmt jeder, der ein angemeldetes Gerät erreicht, das Konto endgültig ohne Kenntnis des alten Passworts.)_ | ✅ erledigt |
| PROJ-1 | **Grenzwerte des neuen Scopes `password-update` stehen nicht im Vertrag** — 10 je 15 Minuten, gebaut beim BUG-91-Fix und durch eine Mutation bewacht, aber AC-18 nennt keine Zahlen und `spec.md` ist während `/build` read-only. Dieselbe Klasse wie N22/N31 im Vorlauf: eine Entscheidung ohne Kriterium. Per `/refine` in AC-18 nachzutragen | Vertrag nachziehen |
| PROJ-1 | **Kontoexistenz weiterhin über zwei andere Kanäle bestimmbar** (BUG-88/BUG-89, Medium) — nicht mehr über die Reset-Antwort, aber über die **Antwortzeit** (durch die Server Action gemessen: Median 120,3 vs. 71,1 ms, Blindtest **20/20** bzw. **30/30** bei **einer** Anfrage je Adresse, ~10 Adressen/s) und über das **Registrierungsformular** (deterministisch, **30/30**, 6,72 Adressen/s, ohne Kontoanlage — Folge von AC-3). Kein Codefehler im engeren Sinn; entwertet aber die Low-Einstufung von **EC-9** zum zweiten Mal.<br>**✅ Entschieden am 2026-09-06 durch `/refine`:** EC-9 steht jetzt auf **Medium** statt Low, EC-11 trägt die durch die Server Action gemessenen Zahlen, EC-4 die richtigen Ausheilzeiten je Vorgang. Neu im Vertrag festgehalten: Begründungen für EC-9 dürfen sich **nicht mehr auf die Vertraulichkeit von Adressen stützen** — AC-3 gibt die Kontoexistenz bewusst preis, und genau daran sind drei Begründungen nacheinander gescheitert. **Verhalten unverändert** — bewusst getragen, korrekt benannt | ✅ dokumentiert |
| PROJ-2 | **`X-Forwarded-Host` hebelt die Origin-Prüfung der Server Actions aus** (BUG-18) — aus dem Browser nicht ausnutzbar (`sameSite: lax`, Preflight scheitert), **aber** ein echter CSRF-Vektor, sobald ein Reverse Proxy oder CDN davorsteht, das clientseitige `X-Forwarded-Host`-Header nicht verwirft. Beim gewählten Host prüfen und den Header dort strippen. **Am 2026-09-07 zur Laufzeit reproduziert:** mit `Origin: https://evil.example.com` allein → HTTP 500 „Invalid Server Actions request."; **zusätzlich mit `X-Forwarded-Host: evil.example.com`** → Runde gestartet | beim Deploy |
| PROJ-2 | **Aufbewahrungsfrist aus AC-41 hängt an `pg_cron` im gehosteten Projekt** — die offenen `[user]`-Aufgaben **T36** und **T37**. Zu erledigen: Extension im Dashboard einschalten (Database → Extensions), prüfen, dass das Projekt nicht wegen Inaktivität pausiert ist (Project Settings), danach den Job im gehosteten Projekt nachmessen. **Lokal belegt** (Job lief, `DELETE 1`).<br>~~**BUG-124** — `0010` bricht bei verweigerter Erweiterung die ganze Migration ab~~ — **behoben am 2026-09-07**: Der `create extension` steckt jetzt in einem `do`-Block, der den Fehlschlag zu einer Warnung macht und nur den Aufräum-Lauf überspringt; `supabase db push` scheitert dadurch nicht mehr hart. Die rückwirkende Änderung an `0010` war zulässig, weil kein Feature auf `Deployed` steht. Über zwei vollständige `db reset` von 0001–0013 verifiziert | beim Deploy |


## Bekannte Restrisiken — PROJ-1 (Stand 2026-09-06)

> **PROJ-1 steht auf `Approved` mit offenen Punkten.** Das ist eine bewusste Entscheidung des Nutzers vom 2026-09-06: Nach dem Abschlusslauf wird alles außer einem **neuen** Critical/High mit direkter Auswirkung auf echte Nutzerdaten oder Kontoübernahme **dokumentiert statt behoben**. Der Lauf fand keinen solchen Befund. Diese Liste ist der Preis dieser Entscheidung — sie steht hier, damit niemand `Approved` für „nichts mehr offen" hält.
>
> **Die beiden weiterhin als High geführten Punkte sind nicht neu und lokal nicht schließbar:** Ihre Schließbedingung verlangt ein Deploy-Ziel, das es noch nicht gibt (`deploy: null` in `.ai-eng-kit`, keine Absender-Domain). Sie stehen unverändert in der Deploy-Blocker-Tabelle oben und **müssen vor dem öffentlichen Start erledigt sein**.

### Was der Abschlusslauf positiv festgehalten hat

Die beiden schwersten Befunde der Vortage sind geschlossen und **von Kontexten bestätigt, die den Fix nicht gebaut haben** — die Kontoübernahme über `updatePasswordAction` (BUG-91) und das Kontoexistenz-Orakel auf dem Reset-Pfad (BUG-87). Erstmals sind **alle 20 AC und alle 11 EC** belegt, AC-18 zum ersten Mal zur Laufzeit. Keine Regression: Test 218/218, Lint 0, Build Exit 0, E2E 39/39 in drei Engines über zwei Läufe.

### Offen, nach Gewicht

| # | Risiko | Severity | Warum es liegen bleibt |
| --- | --- | --- | --- |
| **BUG-61** | Rotierendes `x-forwarded-for` hebelt den IP-Zähler aus — **29 von 30** Spraying-Versuchen kamen durch | **High** | **Deploy-Blocker.** Nur am gehosteten Ziel schließbar: Der Host muss den Header selbst setzen und Client-Werte verwerfen. Kein Codefehler |
| **T18** | Reset-Mail-Vorlage im gehosteten Projekt nicht gesetzt | **High** (Skill-Regel) | **Deploy-Blocker**, blockiert durch fehlenden eigenen SMTP-Dienst und fehlende Absender-Domain |
| **EC-12** (vorher BUG-100) | Die **Recovery-Sitzung wird nicht verbraucht**: Wer den Reset-Link je auf einem geteilten Gerät geöffnet hat, kann dort das Passwort beliebig oft weiter setzen — ohne das aktuelle zu kennen, ohne neuen Link | Medium, **im Vertrag akzeptiert** | **Am 2026-09-06 per `/refine` als EC-12 in `spec.md` aufgenommen**, mit der vollständigen Abwägung. Setzt Gerätezugriff voraus; in diesem Zustand gewährt die Sitzung nach AC-5 ohnehin 400 Tage vollen Zugriff. **Kein Kontoverlust** — der Besitzer kontrolliert sein Postfach und kann jederzeit zurücksetzen |
| **BUG-101 / BUG-102 / BUG-92 / BUG-103 / BUG-104** | Fortschreibung der **bereits bekannten Test-Abdeckungslücke** (BUG-81/82): vier Drosselungs-**Zahlen** von keinem Test gepinnt (Tests tautologisch — 5→19, 20→2000, 10→10000 laufen grün durch beide Suiten) · für beide High-Fixes je nur **ein** Wächter · der BUG-87-Wächter zur Hälfte zeitfenster-abhängig · zwei ungepinnte Zweige | Medium, **akzeptiert** | **Am 2026-09-06 auf Entscheidung des Nutzers als weitere Punkte derselben Lücke eingeordnet, nicht als eigener `/build`-Durchgang.** Dieselbe Begründung wie bei BUG-81/82: Die Schutzmechanismen sind gegen echte Angriffe verifiziert und halten — was fehlt, ist Regressionsschutz gegen einen künftigen Umbau, kein aktiver Funktionsfehler. **Zwei alte Lücken sind dabei geschlossen worden** (M12, M14). Vollständige Aufteilung je Mutation in `design.md` → „Fortschreibung 2026-09-06 (spät)" |
| **BUG-12** | Security-Header (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, HSTS, CSP) sämtlich nicht gesetzt | Medium | Werden beim Host konfiguriert, gegen die Live-URL zu prüfen |
| **BUG-18 / BUG-77** | `X-Forwarded-Host` hebelt die Origin-Prüfung aus; `origin` fließt ungeprüft in `redirectTo` | Medium | Beim gewählten Host zu prüfen und zu strippen; BUG-77 hängt zusätzlich an T18 |
| **EC-9 / EC-10 / EC-11** | Kontoexistenz bleibt über **Antwortzeit** und über das **Registrierungsformular** bestimmbar — eine Anfrage je Adresse, ~10 Adressen/s | Medium, **im Vertrag akzeptiert** | Bewusst getragen. Die Preisgabe beim Registrieren ist eine Produktentscheidung (AC-3). Nachgemessen, Zahlen unverändert |
| **BUG-103 … BUG-108** | Fehlerzweig von `getClaims()` ungepinnt · neue Prüfung in `reset-password/page.tsx` ohne Test · `X-Powered-By` · Passwort-Obergrenze (72 Byte) nicht im Vertrag · Dev-Build gibt DB-Meldung und absolute Serverpfade aus (Produktions-Build ungeprüft) · `PROJ-2-access-guard.spec.ts:53` verdrahtet Port fest | Low | Sammelposten für den nächsten Aufräum-Durchgang |
| ~~**BUG-131**~~ | ~~`profiles` gewährt `anon` und `authenticated` **alle** Tabellenrechte; Schreibzugriffe hält allein RLS~~ — **behoben am 2026-09-07** (Migration `0014`): `revoke all` + `grant select` nur für `authenticated`, `anon` bekommt nichts. Vor dem Schnitt geprüft, dass kein Pfad `anon`-Zugriff braucht (Kopfzeile liest über die Nutzersitzung; `is_trainer_name_taken` und der Anlege-Trigger sind `security definer`). Danach gegengemessen: Registrierung und Lesepfad laufen, Schreibversuche scheitern jetzt am **Tabellenrecht** statt erst an der Policy. **Von einem Test gepinnt**, der die Meldung prüft, nicht den Statuscode — mit Rot-Gegenprobe | ✅ |
| **BUG-132** | `auth_throttle` behält für `anon` und `authenticated` die **vollen** Tabellenrechte (`arwdDxtm`), hat RLS an und **keine einzige Policy** — es hält also genau eine Schicht, und TRUNCATE unterliegt ihr nicht. Dieselbe Einschicht-Konstruktion, die BUG-122 (`runs`) und BUG-131 (`profiles`) beseitigt haben; `auth_throttle` wurde ausgelassen. **Kein erreichbarer Angriff** (gemessen: REST-Lesen und -Löschen wirkungslos, RPC → 401, PostgREST kennt kein TRUNCATE-Verb). Beim Fix mitzukorrigieren: `0007_active_runs.sql:92` nennt sein Vorgehen „dasselbe Muster wie auth_throttle (0003)", geht aber tatsächlich einen Schritt weiter — `0003` entzieht nur Funktionsrechte | Low | Gefunden am 2026-09-07 im vierten QA-Lauf zu PROJ-2, **von zwei Bahnen unabhängig**. Fix ist derselbe Einzeiler wie bei BUG-122/131 |
| **BUG-97** | „Stattdessen einloggen" erscheint auch bei einem bloßen Formatfehler in der E-Mail | Low | — |

### Wie es mit PROJ-1 weitergeht

**Kein weiterer Fix-Zyklus** — Entscheidung des Nutzers vom 2026-09-06. PROJ-1 ist abgenommen; die Punkte oben sind dokumentiert, nicht offen im Sinne von „noch zu erledigen vor der Abnahme". Was tatsächlich vor dem Start passieren muss, steht in der **Deploy-Blocker**-Tabelle und nirgends sonst.

**Falls die Test-Abdeckungslücke später doch geschlossen wird, ist BUG-101 der Anfang** — nicht BUG-102: Ein literaler Test je Grenzwert (wie er für zwei der sechs Limits bereits existiert) deckt vier Kriterien auf einmal ab und ist der billigste Schritt. Die Mutationen liegen mit genauem Diff und gemessenem Rot/Grün-Verhalten als fertiges Abnahmekriterium im `qa-report.md` → QA-Abschlusslauf 2026-09-06.

**Nächster Schritt im Projekt ist nicht PROJ-1, sondern PROJ-2.** Der `/architecture`-Anlauf zu PROJ-3 hatte gezeigt, dass die clientseitig geführte Runde die Rangliste mit einem einzigen manipulierten Aufruf dauerhaft entwertet; `/refine PROJ-2` hat den Vertrag am 2026-09-06 darauf umgestellt (Server vergibt Fragen, prüft Antworten, zählt Serie und misst Zeit — AC-32 bis AC-41). **Stand 2026-09-07:** `/architecture`, `/tasks` und `/build` sind gelaufen, dazu drei QA-Durchgänge auf dem Branch `feat/PROJ-2-server-authoritative-round`. Der dritte hat den Critical und alle Befunde des Vorlaufs als geschlossen bestätigt und **40 von 41 AC** belegt; PROJ-2 steht auf `In Review` mit drei Medium und zwei Low. Reihenfolge von hier: `/build` für die verbliebenen Befunde → `/qa` → dann PROJ-3 und PROJ-4. `/deploy` läuft erst, wenn alle vier stehen.


## PROJ-2 steht seit dem 2026-09-08 wieder auf `Planned` — warum

**Der Vertrag ist gewachsen, nicht die Qualität gesunken.** `/refine PROJ-2` hat am 2026-09-08 **AC-24 neu gefasst** und **AC-43** sowie **EC-16** ergänzt: Die App muss ab **320 px** Breite ohne waagerechten Überlauf funktionieren. Für dieses neue Kriterium gibt es weder Design noch Bau, deshalb ist `Approved` nicht mehr zutreffend.

**Nichts am bisherigen Abnahmestand ist dadurch entwertet.** Die fünf QA-Durchgänge und alle darin belegten AC gelten unverändert; die Liste der akzeptierten Restrisiken weiter unten bleibt gültig. Hinzugekommen ist genau eine Zusage, die vorher niemand gegeben hatte.

**Der Anlass kam von außen:** Beim Bau von PROJ-3 schaltet `LEADERBOARD_PAGE_EXISTS` den Bestenlisten-Zugang frei. Damit trägt die Kopfzeile **drei** Elemente statt zwei — und `docs/app-shell.md` hielt bis dahin ausdrücklich fest, „bei zwei Bereichen passt beides in die Kopfzeile". Gemessen am 2026-09-08: Die Kopfzeile braucht ab da konstant 375 px; bei 320 px war „Abmelden" zu 39 % sichtbar und die Seite ließ sich **nicht** waagerecht scrollen. Vollständige Messreihe in `PROJ-2/design.md` → Technical Decisions.

**Wichtig für die Reihenfolge:** Auf `main` existiert der Überlauf **noch nicht** — dort steht der Schalter auf `false`. Er entsteht mit dem Merge von PROJ-3. Der Fix muss deshalb vor oder mit diesem Merge landen.

## Bekannte Restrisiken — PROJ-2 (Stand 2026-09-07)

> **PROJ-2 steht auf `Approved` mit offenen Punkten.** Entscheidung des Nutzers vom 2026-09-07 nach dem fünften QA-Durchgang: Findet der Abschlusslauf nur noch Low, wird der Rest **dokumentiert akzeptiert statt weiter gebaut**. Er fand nur Low. Diese Liste ist der Preis dieser Entscheidung — sie steht hier, damit niemand `Approved` für „nichts mehr offen" hält.
>
> **Kein einziger dieser Punkte trägt ein Sicherheits- oder Datenrisiko.** Der Critical des ersten Laufs (Ergebnisse an der Runde vorbei einreichbar) und alle Autoritätslücken sind geschlossen und mehrfach von Kontexten bestätigt worden, die den Fix nicht gebaut haben.

### Die größte Lücke ist keine Bug-Nummer

**Darstellung und Responsive-Verhalten hat in fünf Läufen niemand gesehen.** `/qa` hat keinen Browser: AC-24, der Uhrstart aus AC-2, die Färbung und die Animationen aus AC-4/AC-6/AC-8, der Puls der Skelettfläche und der Browser-Dialog aus AC-19 sind ausschließlich über Quelltext und Unit-Tests belegt. Das schließt `/e2e-tests`, nicht ein weiterer QA-Durchgang.

### Offen, nach Gewicht

| # | Risiko | Severity | Warum es liegen bleibt |
| --- | --- | --- | --- |
| **BUG-112** | AC-25: Textzeile statt Skelettfläche beim Rundenstart und beim Warten | Low | Kosmetik. Für das Quizbild existiert die Skelettfläche |
| **BUG-125** | AC-34 Satz 2 beschreibt das gebaute Verhalten nicht mehr | Low | Vertragsfrage. Die Alternative — eine vom Client anhaltbare Serveruhr — wurde bewusst verworfen, sie wäre freie Bedenkzeit auf dem Tie-Breaker |
| **BUG-136** | EC-3 im Wortlaut nicht erfüllt; die Meldung nennt den falschen Grund | Low | Wiederholung funktioniert, Ergebnis ist über die Runden-Kennung nachlesbar |
| **BUG-137** | Die Drei-Verwürfe-Grenze aus EC-10 liegt nur im Client, `design.md` schreibt sie dem Server zu | Low | Entweder Dokumentfehler oder kleiner Umbau; kein Nutzerschaden |
| **BUG-138** | Der Entwicklungs-Build protokolliert Sprite-Adressen samt Pokémon-Nummer | Low | Nur Entwicklung, in Produktion unwirksam |
| **BUG-139** | Die Fehlerkarte nach gescheitertem Start bietet nur eine der beiden in AC-16 genannten Aktionen | Low | Sachlich richtig — es gibt nichts zu beenden. AC-16 kennt den Fall nur nicht |
| **BUG-140** | Der Text der `no-round`-Karte nennt einen Grund, der nicht feststeht | Low | Dieselbe Klasse wie BUG-136 |
| **BUG-126** | `replacePreparedQuestionAction` unbegrenzt aufrufbar, erzeugt PokeAPI-Verkehr | Low | Spannung zur Fair-Use-Zusage; kein Zugangsdaten-Pfad, Selbstschaden am eigenen Ziehungsvorrat |
| **BUG-121** | ~~Fehlerkarte betitelt die angezeigte Frage als „die nächste"~~ | — | **behoben am 2026-09-07**, mit Gegenprobe |

**Vier der neun sind Vertragsfragen**, keine Codefehler: BUG-125, BUG-136, BUG-139, BUG-140 beschreiben Stellen, an denen `spec.md` etwas anderes sagt als das, was mit gutem Grund gebaut wurde. Wer sie schließen will, tut das mit **einem** `/refine PROJ-2`, nicht mit einem Build.

### Wie es mit PROJ-2 weitergeht

**Kein weiterer Fix-Zyklus.** PROJ-2 ist abgenommen. Was tatsächlich vor dem Start passieren muss, steht in der **Deploy-Blocker**-Tabelle und nirgends sonst — für PROJ-2 sind das BUG-12/BUG-116 (Security-Header), BUG-18 (`X-Forwarded-Host`) und T36/T37 (`pg_cron` im gehosteten Projekt).

**Empfohlen, aber nicht blockierend:** `/e2e-tests` für die Kernschleife — es ist der einzige Weg, die oben benannte Darstellungs-Lücke zu schließen.

## Next Available ID: PROJ-5

## Offen aus dem QA-Lauf 6 zu PROJ-2 (2026-09-08)

**Erledigt am 2026-09-08.** Nach dem Merge von `main` in `feat/PROJ-3-leaderboard` liegen Schalter und Fix erstmals gleichzeitig vor; die Messung und die Rot-Gegenprobe stehen in der Tabelle unten bei REG-1. AC-24, AC-43 und EC-16 sind damit am echten dreielementigen Zustand belegt. Der ursprüngliche Text:

> **Nach dem Merge von PROJ-3 nachzuholen — der 320-px-Fix ist nicht unabhängig bestätigt.** AC-24, AC-43 und EC-16 konnten im QA-Lauf nicht geprüft werden: `/qa` hat keinen Browser, **und** der Fall ist auf `feat/PROJ-2-header-320px` gar nicht herstellbar, weil `LEADERBOARD_PAGE_EXISTS` dort auf `false` steht. Die Kopfzeile trägt erst mit PROJ-3 drei Bedienelemente. `tests/PROJ-2-header-narrow.spec.ts` ist elementzahl-unabhängig formuliert und greift dann von selbst — der Lauf ist nach dem Merge einmal auszuführen und das Ergebnis hier festzuhalten.

| # | Punkt | Schwere |
|---|---|---|
| ~~REG-1~~ | ~~Das Regressionsnetz des Kopfzeilen-Fixes hat vor dem PROJ-3-Merge fast keine Zähne~~ — **geschlossen am 2026-09-08** auf `feat/PROJ-3-leaderboard`, nachdem `main` dort hineingemergt wurde. Erstmals liegen Schalter **und** Fix gleichzeitig vor: Die Kopfzeile trägt bei 320 px **drei** Bedienelemente (Wortmarke bis 38, „Bestenliste" bis 183, „Abmelden" bis 310 — alle im Bild), kein waagerechtes Scrollen. **Und der Test kann jetzt scheitern:** Wortmarken-Reduktion entfernt → 2 rot („die Seite ist 334 px breit bei 320 px sichtbar"), zurückgedreht → 7/7 grün | ✅ |
| BUG-141 | Die Kopfzeilen-Knöpfe sind 36 px hoch; `docs/design-system.md` verlangt 40–46 px (`outline`) bzw. 40 px (`ghost`). Vorbestehend, aber `design.md` und der neue Test schreiben die 36 px jetzt als Untergrenze fest | Low |
| BUG-142 | Kommentar in `site-header.tsx` behauptet, 13 px sei die kleinste zulässige Textgröße — das gilt nur für Button-Text, nicht allgemein | Low |

**Nicht neu, im Lauf bestätigt:** BUG-112, BUG-125, BUG-136, BUG-137 (alle Low, stehen bereits oben) sowie die Deploy-Blocker BUG-12/116, BUG-18 und BUG-126.

**Im Lauf widerlegt:** Die Acceptance-Bahn meldete AC-31/AC-37 (PokeAPI-Zwischenspeicher) als gebrochen. Das Fetch-Protokoll des laufenden Servers zeigt **2317 von 2317 PokeAPI-Anfragen als Cache-Treffer, null Übersprünge**. Kein Befund.
