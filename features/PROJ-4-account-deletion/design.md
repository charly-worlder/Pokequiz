# PROJ-4 — Tech Design

> Der technische Entwurf (das WIE) zu `spec.md`. Zwei Leser: der Nutzer, der ihn freigibt, und `/build`, das dagegen baut. Kein Code — aber so genau, dass beim Bau nichts geraten werden muss.
> Eigentümer: `/architecture`. Der Vertrag (das WAS) steht in `spec.md`, die Aufgabenliste in `tasks.md`.

## Die Kurzfassung für den Freigebenden

Die beiden Fragen, für die dieser Entwurf angefordert wurde, haben eine erfreuliche und eine unerfreuliche Antwort.

**Atomarität (EC-3) ist bereits gebaut — sie muss nur benutzt werden.** Die Datenbank trägt seit PROJ-1 und PROJ-2 eine durchgehende Kaskadenkette. Ein einziges Löschen der Auth-Zeile entfernt Profil, alle Runden und den laufenden Rundenzustand **in derselben Transaktion**. „Alles oder nichts" ist damit eine Eigenschaft von Postgres, nicht eine Sorgfaltsleistung von Anwendungscode — und genau das ist die belastbare Variante.

**Die Berechtigungsfrage ist entschieden, aber sie war die falsche Frage.** Der Service-Role-Schlüssel ist **längst in dieser Anwendung** (`src/lib/supabase/admin.ts`, vier Aufrufer). Es geht also nicht darum, ob ein Generalschlüssel eingeführt wird, sondern darum, dass dieser Pfad die zu löschende Kennung **niemals** aus der Anfrage nimmt. Der Entwurf löst das strukturell: Die Server Action hat **keinen Parameter für eine Konto-Kennung**. Was nicht angenommen wird, kann nicht untergeschoben werden.

**Und ein Fund, der nicht bestellt war:** Der bestehende Aufräum-Trigger für die Drosselungszähler löscht **drei fest verdrahtete Schlüssel**. Der neue Zähler aus AC-15 wäre nicht dabei — die E-Mail-Adresse des Nutzers überlebte damit ausgerechnet die Löschung, die sie beseitigen soll. Das bricht AC-17 und wird hier mitkorrigiert.

---

## Component Structure

```
/account  (neue Route, nur angemeldet)
+-- PageFrame                       [bestehend, PROJ-2 — unverändert übernommen]
|   +-- SiteHeader                  [bestehend — Nutzer-Chip wird zum Link, siehe unten]
|   +-- Inhalt
|   |   +-- Seitentitel "Dein Konto"        (im Inhaltsbereich, nicht in der Kopfzeile)
|   |   +-- AccountDataCard                  [neu]  → AC-2, AC-3, AC-6, AC-7, AC-19
|   |   |   +-- Wertzeile x5   (E-Mail, Trainername, Dabei seit, Runden, Bester Lauf)
|   |   |   +-- Vollständigkeits-Satz        → AC-19
|   |   +-- DangerZoneCard                   [neu]  → AC-8
|   |       +-- Erklärtext (was verschwindet)
|   |       +-- Button "Konto löschen"  (destructive)
|   |       +-- DeleteAccountDialog          [neu]  → AC-9 bis AC-14, AC-20
|   |           +-- Warntext                 → AC-20
|   |           +-- Passwortfeld             → AC-9
|   |           +-- Fehlerbereich  (falsches Passwort / gedrosselt / Technikfehler)
|   |           +-- [Abbrechen]  [Endgültig löschen]
|   +-- SiteFooter                  [bestehend — unverändert]

/login
+-- Bestätigungsbanner nach erfolgreicher Löschung   [neu, klein]  → AC-12
```

**Kein neues Rahmenwerk.** `PageFrame`, `SiteHeader`, `SiteFooter` und die shadcn-Bausteine (`Card`, `Button`, `Input`, `AlertDialog`, `Alert`) sind vorhanden und werden unverändert benutzt. Es entsteht keine zweite Navigation (AC-5).

**Der Dialog ist ein `AlertDialog`, kein `Dialog`.** Er unterbricht bewusst und hat keinen Schließen-Kreuz-Ausweg neben den beiden Knöpfen; das ist die shadcn-Komponente für unumkehrbare Handlungen. Escape und Klick daneben schließen ihn trotzdem (AC-14) — die Abbruchmöglichkeit soll leicht sein, nur die Bestätigung schwer.

---

## Data Model

**Dieses Feature legt keine neue Entität an und ändert keine Beziehung.** `docs/data-model.md` bleibt inhaltlich unverändert; es beschreibt die Löschung bereits als vorgesehenen Weg. Was PROJ-4 hinzufügt, ist der **Auslöser** — und eine Korrektur an einem bestehenden Aufräum-Trigger.

### Was `/account` anzeigt (alles gelesen, nichts geschrieben)

```
Die Kontoanzeige besteht aus fünf Werten, alle bereits gespeichert:

- E-Mail-Adresse      Text. Quelle: das Auth-Konto der Sitzung.
                      Nicht aus `profiles` — die Tabelle führt keine E-Mail.
- Trainername         Text, 3–20 Zeichen aus [A-Za-z0-9_]. Quelle: profiles.trainer_name.
- Dabei seit          Datum, dargestellt als TT.MM.JJJJ. Quelle: profiles.created_at.
- Runden gespielt     Ganzzahl ≥ 0. Anzahl aller eigenen Zeilen in `runs`.
                      Zählt **alle** Runden, auch Nullrunden — die Anzeige ist eine
                      Auskunft über Gespeichertes, keine Wertung (anders als die
                      Rangliste in PROJ-3, die Serie 0 ausschließt).
- Bester Lauf         Serie (Ganzzahl) und Zeit (mm:ss,s). Ermittelt wie in PROJ-3:
                      Serie absteigend, bei Gleichstand Zeit aufsteigend.
                      Fehlt, wenn der Spieler keine Runde mit Serie ≥ 1 hat → AC-6.

Zugriff: ausschließlich die eigene Zeile. Alle drei Quellen sind bereits durch
Row Level Security auf den Eigentümer beschränkt (Migrationen 0016 und 0002);
für diese Seite wird **keine** Öffnung gebaut und **kein** Admin-Client benutzt.

Aufbewahrung: unverändert — bis zur Kontolöschung.
```

**Bewusst nicht angezeigt:** Konto-Kennung (UUID), Zeitstempel der letzten Anmeldung, IP-Adressen, der laufende Rundenzustand. Die UUID ist für den Nutzer bedeutungslos und wäre eine zusätzliche Kennung im Browser; die übrigen speichert die Anwendung gar nicht. Das ist die Datensparsamkeits-Prüfung aus AC-19: **Angezeigt wird alles Gespeicherte, nicht mehr.**

> ⚠️ **AC-19 ist eine Zusage mit Verfallsdatum.** Sie stimmt genau so lange, wie kein Feature ein weiteres personenbezogenes Feld einführt. Wer das tut, muss diese Seite mitziehen. Der Test dazu (siehe Prüfhinweise) prüft deshalb die Liste der Felder, nicht nur ihre Darstellung.

### Die Löschkette, wie sie schon existiert

```
auth.users            ← hier wird gelöscht, genau eine Zeile
  └─ profiles         on delete cascade   (0001)
       ├─ runs        on delete cascade   (0002)   — alle Runden des Spielers
       └─ active_runs on delete cascade   (0007)   — der laufende Rundenzustand
  └─ auth_throttle    kein Fremdschlüssel — Trigger `on_auth_user_deleted` (0005)
```

Die ersten vier hängen an Fremdschlüsseln und werden von Postgres im selben Vorgang mitgelöscht. Die fünfte hängt an **nichts** — `auth_throttle` hat bewusst keinen Fremdschlüssel, weil sie auch Schlüssel ohne Konto führt (IP-Adressen). Deshalb der Trigger.

### Die Korrektur an diesem Trigger (neue Migration)

**Befund.** `forget_auth_throttle_for_user()` löscht heute exakt drei Schlüssel, buchstäblich aufgezählt:
`login:account:<mail>`, `register:account:<mail>`, `password-reset:account:<mail>`.

AC-15 führt einen vierten Scope ein (`account-delete`). Er stünde nicht in dieser Liste. Folge: Wer sein Konto löscht und dabei einmal das Passwort falsch eingegeben hat, hinterlässt eine Zeile, die seine E-Mail-Adresse im Klartext trägt — **erzeugt vom Löschvorgang selbst**. Das bricht AC-17 im Wortlaut und ist die Wiederholung genau des Fehlers, den Migration `0005` behoben hat.

**Entscheidung: Die Aufzählung wird durch einen Musterabgleich ersetzt.** Der Trigger löscht künftig jede Zeile, deren Schlüssel auf `:account:<e-mail-adresse>` endet — unabhängig davon, welcher Scope davor steht. Damit ist **jeder künftige Scope automatisch mit abgedeckt**, statt dass ihn jemand hier nachtragen muss.

```
Neu:  alle Zeilen mit Schlüssel-Endung  ":account:" + kleingeschriebene Adresse
Alt:  drei buchstäblich aufgezählte Schlüssel

Unverändert: IP-Schlüssel bleiben stehen. Sie gehören einer Verbindung, nicht
einem Konto. Sie mitzulöschen hieße, dass ein Angreifer seine eigene Bremse löst,
indem er ein Wegwerf-Konto anlegt und wieder löscht (das ist BUG-39, und der
Kommentar in 0005 warnt ausdrücklich davor).
```

**Der Preis, benannt:** Ein Mustervergleich mit vorangestelltem Platzhalter kann den Primärschlüssel-Index nicht nutzen und liest die Tabelle durch. Das ist hier folgenlos: Die Tabelle ist durch `prune_auth_throttle` auf abgelaufene Fenster von höchstens einer Stunde begrenzt (Größenordnung: Hunderte bis wenige Tausend Zeilen), und der Vorgang läuft **einmal pro Kontolöschung** — nicht auf einem heißen Pfad. Ein Index eigens dafür wäre teurer als der Durchlauf.

---

## Behaviors & Access

### Der Löschvorgang, Schritt für Schritt

```
Vorgang: "eigenes Konto löschen"
Eingang: eine Server Action. Sie nimmt GENAU EIN Feld entgegen: das Passwort.
         Es gibt KEINEN Parameter für eine Konto-Kennung, eine E-Mail-Adresse
         oder eine Sitzungs-Kennung.                              → AC-16

 1. Drosselung zählen — VOR jeder Prüfung.
    Zwei Schlüssel: account-delete:ip:<verbindung> und
                    account-delete:account:<e-mail der sitzung>.
    Grenzen: 5 Versuche je 15 Minuten, beide Hälften.             → AC-15
    Überschritten → abweisen mit Restzeit in Minuten. Ende.       → EC-7
    Fehlt der Zähler (kein Service-Role-Schlüssel) → abweisen,
    niemals stillschweigend durchlassen (fail closed).

 2. Sitzung prüfen. Wer bin ich?
    Über den Auth-Dienst, nicht über den Token-Inhalt (siehe unten).
    Keine gültige Sitzung → auf /login umleiten.                  → AC-4, EC-4
    Ergebnis: Konto-Kennung und E-Mail-Adresse. AUSSCHLIESSLICH
    von hier stammt die Kennung, die gelöscht wird.               → AC-16

 3. Passwort prüfen.
    Anmeldeversuch mit der E-Mail aus Schritt 2 und dem eingegebenen
    Passwort — auf einem eigenen, sitzungslosen Client, der KEINE
    Cookies schreibt. Die bestehende Sitzung bleibt dadurch unberührt.
    Falsch → Fehlermeldung, Dialog bleibt offen, nichts gelöscht. → AC-11

 4. Löschen. Ein Aufruf, harte Löschung, mit der Kennung aus Schritt 2.
    Postgres entfernt in derselben Transaktion: Auth-Zeile, Profil,
    alle Runden, den laufenden Rundenzustand — und der Trigger die
    Zählerzeilen der Adresse.                                     → AC-10, AC-17
    Scheitert der Aufruf → NICHTS ist gelöscht, Nutzer bleibt
    angemeldet, Fehler in der Karte mit "Erneut versuchen"        → EC-3
    UND der in Schritt 1 gezählte Versuch wird erstattet
    (genau einer, siehe unten).                                   → siehe „Der Fehlerfall"

 5. Sitzung örtlich beenden. Die Auth-Cookies werden gelöscht,
    ohne den Auth-Dienst zu fragen — dort gibt es das Konto nicht
    mehr, ein Abmelde-Aufruf hätte nichts zu beenden.             → AC-12

 6. Auf /login umleiten, mit einem Merker für den Bestätigungsbanner. → AC-12
```

**Warum die Drosselung vor der Sitzungsprüfung zählt und nicht danach:** Der Verbindungs-Schlüssel steht sofort fest, der Konto-Schlüssel braucht die Sitzung. Gezählt wird deshalb **zweistufig** — der Verbindungs-Zähler in Schritt 1, der Konto-Zähler unmittelbar nach Schritt 2, aber **vor** Schritt 3. Entscheidend ist allein, dass kein Passwort geprüft wird, bevor beide Zähler ihn durchgelassen haben.

### Zugriffsregeln

```
- /account öffnen                — nur angemeldet; sonst Umleitung auf /login   (AC-4)
- Die fünf Werte lesen           — nur die eigene Zeile, über die Nutzersitzung
                                    mit Row Level Security. Kein Admin-Client.  (AC-2)
- Konto löschen                  — nur die eigene Sitzung, nur mit richtigem
                                    Passwort, nur innerhalb der Drosselung      (AC-9, AC-15, AC-16)
- Fremde Konten löschen          — es gibt keinen Aufruf, der das ausdrücken
                                    könnte. Nicht "abgewiesen", sondern
                                    nicht formulierbar.                          (AC-16)

Abgewiesen wird bei: keiner Sitzung, falschem Passwort, überschrittener
Drosselung — jeweils ohne dass irgendetwas gelöscht wird.
```

### Die Garantien hinter den zeitlichen Edge Cases

Die Skill-Regel verlangt, für jeden Edge Case über Gleichzeitigkeit, Zustandswechsel oder doppelte Zustellung zu benennen, **was** das zugesagte Verhalten trägt. Hier sind es vier:

| Edge Case | Was die Zusage trägt |
|---|---|
| **EC-1** — Doppelklick, zwei Tabs | Der zweite Aufruf findet in Schritt 2 keine gültige Sitzung mehr (das Konto existiert nicht) und leitet auf `/login` um. Es braucht **keinen** Idempotenz-Schlüssel und keine Sperre: Der Zustand „gelöscht" ist selbst die Abwehr, weil er den Vorgang unerfüllbar macht. Gewinnt ein Aufruf das Rennen um die Zeile, bekommt der andere von Postgres den Fehler „nichts gelöscht", was auf denselben Ausgang führt |
| **EC-2** — Runde in anderem Tab | Der Rundenzustand ist mitgelöscht (Kaskade). Der andere Tab bekommt bei der nächsten Handlung entweder die Umleitung auf `/login` (Sitzung ungültig) oder den bereits gebauten `no-round`-Zustand aus PROJ-2. Beide Wege existieren schon; PROJ-4 baut hier nichts |
| **EC-3** — Teilausfall | **Eine** Transaktion. Die Kaskade ist Teil des DELETE, nicht eine Folge von Aufrufen. Es gibt keinen Zwischenstand, in dem das Profil weg und die Runden noch da wären — er ist nicht herstellbar, nicht nur unwahrscheinlich |
| **EC-8** — Verbindungsabbruch | Dieselbe Transaktion. Sie ist entweder festgeschrieben oder zurückgerollt; ein abgebrochener Browser ändert daran nichts. Der Nutzer sieht beim nächsten Aufruf einen der beiden eindeutigen Zustände |

### Der Fehlerfall — was genau scheitern kann, und was der Nutzer dann sieht

**Ein Teilzustand ist nicht der Fehlerfall.** „Profil gelöscht, Runden noch da" kann nicht entstehen: Die Kaskade ist Teil desselben DELETE. Was scheitern kann, ist die **ganze Transaktion** — sie rollt dann vollständig zurück. Realistische Auslöser sind genau drei: die Datenbank ist nicht erreichbar, der Auth-Dienst antwortet nicht, oder einer der Trigger auf `auth.users` wirft einen Fehler (der Aufräum-Trigger läuft *nach* dem Löschen, in derselben Transaktion — wirft er, ist auch die Löschung zurückgerollt).

**Der Zustand danach ist in allen drei Fällen derselbe und vollständig unverändert:** Konto, Profil, Runden, Rundenzustand und Sitzung existieren wie vorher. Der Nutzer ist weiterhin angemeldet.

```
Was der Nutzer sieht:
- Der Dialog bleibt offen, das Passwortfeld wird geleert.
- Im Dialog erscheint: "Das hat gerade nicht geklappt — technisch, nicht
  wegen deines Passworts. Dein Konto ist unverändert." plus [Erneut versuchen].
- Ausdrücklich NICHT die Meldung für ein falsches Passwort. Sonst tippt der
  Nutzer sein richtiges Passwort neu ein und glaubt, er habe sich vertan.
```

**Ist ein erneuter Versuch sicher? Ja — zweimal ja.** Fachlich, weil nichts geschehen ist: Der Vorgang ist von Natur aus wiederholbar, es gibt keinen halben Zustand, auf den ein zweiter Versuch aufsetzen müsste. Und praktisch, weil er **kein Drosselungs-Budget verbraucht**:

> **Erstattung im technischen Fehlerfall.** Schritt 1 zählt vor der Prüfung hoch (fail closed, das bleibt). Scheitert Schritt 4, **nachdem** das Passwort in Schritt 3 als richtig erkannt wurde, wird genau ein Versuch auf beiden Schlüsseln erstattet — mit der bereits vorhandenen Erstattungsfunktion aus Migration `0004`, die um genau eins herunterzählt statt den Zähler zu leeren.
>
> **Warum das keinen Angriffsweg öffnet:** Der Erstattungszweig liegt **hinter** der bestandenen Passwortprüfung. Wer das Passwort nicht kennt, erreicht ihn nie — für ihn zählt jeder Versuch weiter voll. Das ist dieselbe Logik wie beim Login (BUG-54): Ein bewiesener Eigentümer bekommt seinen eigenen Versuch zurück, mehr nicht.
>
> **Ohne diese Erstattung** wäre eine fünfminütige Datenbankstörung eine 15-Minuten-Sperre für jemanden, der sein Konto löschen will und alles richtig gemacht hat — der Schutz träfe ausschließlich den legitimen Nutzer.

### Der Punkt, an dem AC-21 wirklich hängt

**Das Löschen eines Kontos macht ein bereits ausgestelltes Zugangs-Token nicht ungültig.** Das ist eine ausdrückliche Warnung der Supabase-Dokumentation und gilt hier genauso: Die Token dieses Projekts laufen nach **einer Stunde** ab (`jwt_expiry = 3600`). Wer den Token-Inhalt nur lokal prüft, hält einen gelöschten Nutzer bis zu einer Stunde lang für angemeldet.

**Diese Anwendung ist davor geschützt — aus einem Grund, der nichts mit PROJ-4 zu tun hat.** Jeder Schutzpunkt (`src/proxy.ts`, jede Seite, jede Server Action) fragt den Auth-Dienst über `getUser()`, nicht den Token-Inhalt. Für ein gelöschtes Konto antwortet der Dienst mit einem Fehler → Umleitung auf `/login`. AC-21 hält also **sofort**, nicht erst nach einer Stunde.

Bemerkenswert: Der Kommentar in `src/proxy.ts` hält fest, dass dort früher die lokale Prüfung stand (BUG-3) und ausgetauscht wurde. Der Fix von damals ist heute die Grundlage von AC-21 — ohne dass das jemand aufgeschrieben hätte. **Ab jetzt ist es aufgeschrieben:** Wer einen dieser Schutzpunkte auf die lokale Token-Prüfung zurückdreht, bricht AC-21 lautlos für bis zu eine Stunde. Der bestehende Wächter `src/lib/actions/server-actions.guard.ts` prüft bereits, dass Server Actions eine Sitzungsprüfung enthalten; er wird um diesen Fall erweitert (siehe Prüfhinweise).

---

## Dependencies

**Keine neuen Pakete.** Alles ist vorhanden: `@supabase/supabase-js` und `@supabase/ssr` für Auth und Admin-Client, `zod` und `react-hook-form` für das Passwortfeld, `alert-dialog`, `card`, `input`, `alert` und `button` aus shadcn/ui liegen bereits in `src/components/ui/`.

---

## Settings the user makes

| Setting | Wo | Wert | Warum | → AC |
|---|---|---|---|---|
| — | — | — | — | — |

**Keine.** Anders als bei PROJ-1 braucht dieses Feature keinen Dashboard-Handgriff: Die Drosselung ist vollständig selbst gebaut (`auth_throttle`), die Passwortregeln sind bereits gesetzt, und es wird keine E-Mail versendet.

**Zwei bestehende Blocker gelten hier weiter** — sie sind nicht neu, aber dieses Feature verlässt sich auf sie:
- **BUG-61** (`x-forwarded-for`): Die IP-Hälfte der neuen Drosselung ist genauso fälschbar wie die von PROJ-1. Der Konto-Zähler ist die Hälfte, die trägt.
- **BUG-18** (`X-Forwarded-Host`): Die Origin-Prüfung der Server Actions ist mit einem Header aushebelbar, sobald ein Proxy davorsteht. Für eine unumkehrbare Löschung wiegt das schwerer als für einen Rundenstart — hier steht in der Deploy-Blocker-Tabelle jetzt eine Kontolöschung dahinter, nicht nur eine Quizrunde.

---

## Technical Decisions

| Entscheidung | Begründung | Erwogene Alternative | Preis | Datum |
|---|---|---|---|---|
| **Löschen über den Auth-Admin-Aufruf mit dem Service-Role-Schlüssel** | Der dokumentierte, unterstützte Weg. Er räumt auch die Auth-internen Nebentabellen (Identitäten, Sitzungen, Refresh-Token) korrekt ab — eine selbstgebaute Löschung müsste das nachbilden und würde bei jeder Änderung des Auth-Dienstes stillschweigend veralten. Der Schlüssel ist ohnehin schon in der Anwendung (vier bestehende Aufrufer) | Eine Datenbankfunktion mit erhöhten Rechten, die `auth.uid()` benutzt und für angemeldete Nutzer freigegeben ist. Reizvoll, weil die Kennung dann strukturell aus der Sitzung käme | Der Generalschlüssel liegt auf einem weiteren Pfad. Abgefedert dadurch, dass die Action keinen Kennungs-Parameter hat. Die Alternative wäre **die erste** für `authenticated` freigegebene Funktion dieses Projekts gewesen — gegen seine eigene, konsequent durchgehaltene Linie | 2026-09-09 |
| **Harte Löschung, ausdrücklich keine weiche** | Die weiche Variante behält die Auth-Zeile und macht den Nutzer über die gehashte Kennung weiter identifizierbar. Damit wären AC-13 (E-Mail und Trainername wieder frei) **und** AC-17 (kein Personenbezug mehr) gebrochen — und der Trigger für die Zählerzeilen feuerte nicht, weil gar nichts gelöscht würde | Weiche Löschung als „Sicherheitsnetz" gegen Reue | Kein Rückholweg. Genau so ist es im Vertrag gewollt (`spec.md` → Product Decisions) | 2026-09-09 |
| **Die Server Action nimmt keinen Kennungs-Parameter entgegen** | AC-16 wird dadurch nicht *geprüft*, sondern *unmöglich*. Eine Prüfung kann jemand später entfernen; einen Parameter, den es nicht gibt, kann niemand füllen. Dieses Projekt hat mit BUG-17/90/91 dreimal denselben Fehler gehabt — eine Prüfung, die fehlte oder zu schwach war | Kennung mitschicken und serverseitig gegen die Sitzung vergleichen | Keiner. Die Kennung wird ohnehin nur an einer Stelle gebraucht | 2026-09-09 |
| **Der Aufräum-Trigger vergleicht künftig ein Muster statt drei feste Schlüssel** | Sonst überlebt der neue Scope `account-delete` die Löschung, die ihn erzeugt hat (AC-17). Wichtiger als dieser eine Fall: **Jeder künftige Scope ist automatisch abgedeckt**, statt dass ihn jemand hier nachträgt — die Aufzählung war eine Falle, die genau einmal zuschnappt und dann unbemerkt bleibt | Den vierten Schlüssel zur Aufzählung hinzufügen | Der Mustervergleich nutzt keinen Index und liest die Tabelle durch. Folgenlos: Die Tabelle ist durch das laufende Aufräumen klein, und der Vorgang läuft einmal je Kontolöschung | 2026-09-09 |
| **Passwortprüfung durch einen Anmeldeversuch auf einem sitzungslosen Client** | Es gibt keine Schnittstelle „prüfe dieses Passwort". Der eingebaute Wiederanmelde-Weg (`reauthenticate`) verschickt einen Code **per E-Mail** und ist damit für dieses Projekt unbrauchbar — es hat bewusst keinen funktionierenden Mailversand (`docs/PRD.md`). Ein Client ohne Sitzungsspeicherung prüft das Passwort, ohne die Cookies des Nutzers anzufassen | Die Wiederanmeldung per E-Mail-Code; oder ganz auf die Passwortprüfung verzichten | Der Versuch zählt gegen das **gemeinsame** Anmeldekontingent des Auth-Dienstes, das wegen der Server-Action-Architektur für alle Spieler an derselben Server-IP hängt (BUG-21). Genau deshalb sitzt die eigene Drosselung **davor** und nicht dahinter | 2026-09-09 |
| **Eigener Zähler-Scope `account-delete`, 5 je 15 Minuten, beide Hälften** | Aus AC-15. Ein eigener Scope statt Mitbenutzung von `credentialsPerAccount` (20/15 min), weil sonst ein misslungener Löschversuch den Login des Nutzers mit verbraucht und umgekehrt — zwei Vorgänge mit verschiedenem Zweck an einem Zähler ist genau der Fehler, den BUG-76 beim Passwort-Reset behoben hat | Den bestehenden Login-Zähler mitbenutzen | Ein weiterer Grenzwert, der gepflegt werden will. Deshalb steht er **im Vertrag** (AC-15) und nicht nur im Code — das war bei `password-update` anders und ist dort als offener Punkt gelandet | 2026-09-09 |
| **Keine Erstattung bei Erfolg — aber Erstattung im technischen Fehlerfall** | Bei **Erfolg** ist eine Erstattung gegenstandslos: Das Konto ist weg, und der Trigger räumt die Konto-Schlüssel ohnehin ab. Beim **technischen Fehlschlag nach richtigem Passwort** ist sie dagegen nötig, sonst macht eine Datenbankstörung aus dem Missbrauchsschutz eine Sperre gegen den rechtmäßigen Eigentümer — fünf Fehlversuche der Infrastruktur, und er kommt 15 Minuten lang nicht an die Löschung. Der Zweig liegt hinter der bestandenen Passwortprüfung, ist für einen Angreifer also unerreichbar (dieselbe Abwägung wie BUG-54 beim Login). Der IP-Schlüssel bleibt bei Erfolg stehen (Regel aus `0005`) | Gar nicht erstatten und die Sperre in Kauf nehmen; oder bei Erfolg leeren wie beim Login | Ein zusätzlicher Zweig, der geprüft gehört: Die Erstattung darf **nur** nach richtigem Passwort greifen. Ein Test muss rot werden, wenn sie vor die Passwortprüfung rutscht | 2026-09-09 |
| **Die Kontoanzeige liest über die Nutzersitzung, nicht über den Admin-Client** | Die drei Quellen sind bereits per Row Level Security auf den Eigentümer beschränkt. Den Generalschlüssel hier zu benutzen, wäre bequemer und würde die zweite Schutzschicht wegnehmen, die `.claude/rules/security.md` ausdrücklich verlangt | Alles mit dem Admin-Client holen, spart eine Überlegung | Keiner. Die Daten sind für den Eigentümer ohnehin lesbar | 2026-09-09 |
| **Der Nutzer-Chip in der Kopfzeile wird zum Link auf `/account`** | Die Kopfzeile trägt bei 320 px bereits drei Elemente und wurde am 2026-09-08 mühsam auf diese Breite gebracht (PROJ-2, AC-43). Ein vierter Knopf hätte den Fix sofort gebrochen. Der Chip ist bereits da und ungenutzt | Ein vierter Knopf „Konto"; oder ein Aufklappmenü am Chip | Ein Klickziel, das nicht wie eines aussieht. Gegenmittel: sichtbarer Hover- und Fokuszustand und ein `aria-label`, das das Ziel benennt — der Chip wird nicht heimlich klickbar | 2026-09-09 |
| **Die Kaskade wird beim Bau gemessen, nicht angenommen** | Die ganze Atomaritäts-Zusage (AC-10, EC-3) und AC-17 ruhen auf Fremdschlüsseln, die in drei verschiedenen Migrationen stehen und **nie zusammen im Löschfall geprüft wurden** — sie waren bisher totes Kapital. Ein Kommentar in `0002` sagt zu, dass die Löschung die Runden erreicht; dieses Projekt hat mit BUG-36 und BUG-56 zweimal erlebt, dass eine Zusage im Kommentar keinen Code hinter sich hatte | Auf die Fremdschlüssel vertrauen — sie stehen ja da | Ein Prüfschritt mehr. Er ist billig und deckt den einzigen Fall ab, in dem dieses Feature schweigend falsch sein könnte | 2026-09-09 |

---

## Prüfhinweise für `/qa` und `/e2e-tests`

Vier Stellen, an denen ein Test leicht grün wird, ohne etwas zu belegen — dieses Projekt hat dafür eine Vorgeschichte (BUG-81/82, BUG-101 bis BUG-104: Grenzwerte, die kein Test festhielt).

1. **Die Kaskade gehört an echten Zeilen gemessen.** Ein Konto anlegen, mehrere Runden hinterlassen, eine Runde offen lassen, einen Fehlversuch auf jedem der vier Scopes erzeugen — dann löschen und **jede** der fünf Tabellen einzeln nachzählen. Ein Test, der nur „die Aktion warf keinen Fehler" prüft, belegt nichts.
2. **Der neue Zähler braucht einen buchstäblichen Grenzwert-Test.** Nicht „nach vielen Versuchen wird abgewiesen", sondern: Versuch 5 geht durch, Versuch 6 wird abgewiesen. Ein Test, der 5 auf 19 hochdrehen kann und grün bleibt, ist tautologisch — genau das war BUG-101.
3. **AC-19 ist ein Feldlisten-Test, kein Darstellungstest.** Er soll rot werden, wenn irgendwo ein neues personenbezogenes Feld entsteht, das die Seite nicht zeigt.
4. **AC-21 braucht eine Gegenprobe mit dem alten Cookie.** Nach der Löschung mit dem aufbewahrten Cookie-Glas eine geschützte Seite und eine Server Action aufrufen — beide müssen auf `/login` führen. Zusätzlich als Mutation: Wird ein Schutzpunkt auf die lokale Token-Prüfung zurückgedreht, muss ein Test rot werden.

**AC-7 (320 px) und die Dialog-Interaktion sieht `/qa` nicht** — es hat keinen Browser. Das schließt `/e2e-tests`, wie bei PROJ-2 und PROJ-3.

---

## Open Questions

- [x] ~~**Soll `/account` auch mit einer Recovery-Sitzung erreichbar sein?**~~ — **Entschieden am 2026-09-09: ja, unverändert erreichbar.** Für die Löschung ist ohnehin das Passwort nötig (AC-9), der Schutz greift also unabhängig davon, wie die Sitzung entstanden ist. Eine zusätzliche Enge hätte den Fall bestraft, in dem jemand sein Passwort gerade zurückgesetzt hat und das Konto dann löschen will. `hasRecoverySession()` wird auf diesem Pfad **nicht** benutzt.

- [ ] **Scheitert die Löschung wirklich als Ganzes?** — *Die einzige verbliebene offene Frage, und sie ist eine Messfrage, keine Entwurfsfrage.*

  **Was nicht mehr offen ist:** Ein Teilzustand ist ausgeschlossen (die Kaskade steckt im selben DELETE), der Zustand nach einem Fehlschlag ist vollständig unverändert, die UI-Antwort steht oben unter „Der Fehlerfall", und ein erneuter Versuch ist fachlich wie budgetmäßig sicher.

  **Was offen ist:** ob die Datenbank sich in der Praxis so verhält, wie die Fremdschlüssel es versprechen. Diese vier Kaskaden stehen in drei Migrationen und wurden **nie im Löschfall zusammen ausgelöst** — sie sind bis heute totes Kapital. Zu belegen beim Bau, in beide Richtungen:
  1. **Gelingt es**, sind hinterher alle fünf Tabellen leer (Auth-Zeile, Profil, Runden, Rundenzustand, Konto-Zählerschlüssel).
  2. **Scheitert es** — künstlich herbeigeführt, etwa durch einen absichtlich werfenden Trigger auf `auth.users` —, ist hinterher **jede** der fünf Zeilen noch da, und die Sitzung funktioniert weiter.

  Ohne Punkt 2 bleibt EC-3 eine begründete Annahme statt einer gemessenen Eigenschaft. Dieses Projekt hat mit BUG-36 und BUG-56 zweimal erlebt, dass eine Zusage im Kommentar keinen Code hinter sich hatte.
