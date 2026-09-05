import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'

/**
 * **Der Wächter über alle Server Actions.**
 *
 * Jede aus einer `'use server'`-Datei exportierte Funktion ist ein öffentlicher
 * HTTP-Endpunkt. Nicht „im Prinzip" — tatsächlich: Der Browser kann sie mit
 * beliebiger Nutzlast aufrufen, und seit BUG-9 leitet der Proxy solche Aufrufe
 * bewusst **nicht** mehr um, weil Next.js eine HTTP-Weiterleitung auf einen
 * Action-POST als Protokollbruch behandelt. Die Sitzungsprüfung sitzt damit in
 * der Action selbst — genau so, wie die Next.js-Dokumentation es verlangt
 * („any Server Actions called from components must perform their own
 * authorization checks").
 *
 * Das hielt bisher nur, weil vier Actions einmal von Hand nachgesehen wurden.
 * Genau diese Art Schutz verfällt lautlos: Die fünfte Action schreibt jemand in
 * sechs Wochen, und niemand liest diesen Kommentar dabei.
 *
 * Dieser Test findet deshalb **jede** Server Action im Projekt selbst und
 * verlangt für jede eine von zwei Antworten:
 *
 * 1. sie prüft die Sitzung (`getUser()`), oder
 * 2. sie steht unten in `PUBLIC_ACTIONS` — **mit Begründung**, warum sie ohne
 *    Sitzung aufrufbar sein muss.
 *
 * Eine neue Action, die weder das eine noch das andere tut, macht `npm test`
 * rot und nennt sich beim Namen. Das ist die strukturelle Zusicherung; die
 * Aufzählung unten ist keine Erlaubnisliste, die man erweitert, um grün zu
 * werden, sondern eine Stelle, an der man begründen muss.
 */

/**
 * Actions, die absichtlich **ohne** Sitzung erreichbar sind. Wer hier etwas
 * einträgt, schreibt den Grund dazu — der Text ist der eigentliche Zweck der
 * Liste, nicht der Schlüssel.
 */
const PUBLIC_ACTIONS: Record<string, string> = {
  registerAction:
    'Registrierung — wer noch kein Konto hat, kann per Definition keine Sitzung haben (PROJ-1 AC-1).',
  loginAction:
    'Anmeldung — dasselbe: Die Sitzung entsteht hier erst (PROJ-1 AC-4). Gegen Erraten schützt die Drosselung, nicht eine Sitzungsprüfung.',
  requestPasswordResetAction:
    'Passwort vergessen — genau der Fall, in dem der Nutzer nicht hereinkommt (PROJ-1 AC-11). Antwortet bewusst immer gleich, damit sie keine Konten verrät.',
  logoutAction:
    'Abmelden ohne Sitzung ist wirkungslos: Es gibt nichts zu beenden und nichts preiszugeben.',
}

/** Liest `getUser` auch dann, wenn es destrukturiert oder verkettet aufgerufen wird. */
const SESSION_CHECK = /\bgetUser\s*\(/

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      sourceFiles(full, found)
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      found.push(full)
    }
  }
  return found
}

/** Eine Datei ist ein Server-Action-Modul, wenn ihre erste Anweisung `'use server'` ist. */
function isServerActionModule(text: string) {
  return /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use server['"]/.test(text)
}

type Action = { name: string; file: string; body: string }

function exportedActions(file: string, text: string): Action[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const actions: Action[] = []

  const isExported = (node: ts.Node) =>
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)

  for (const statement of source.statements) {
    // export async function foo() {}
    if (ts.isFunctionDeclaration(statement) && isExported(statement) && statement.name) {
      actions.push({ name: statement.name.text, file, body: statement.getText(source) })
      continue
    }
    // export const foo = async () => {}
    if (ts.isVariableStatement(statement) && isExported(statement)) {
      for (const decl of statement.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          actions.push({ name: decl.name.text, file, body: statement.getText(source) })
        }
      }
    }
  }
  return actions
}

const allActions = sourceFiles(join(process.cwd(), 'src'))
  .filter((file) => isServerActionModule(readFileSync(file, 'utf8')))
  .flatMap((file) => exportedActions(file, readFileSync(file, 'utf8')))

describe('Server Actions — Sitzungsprüfung strukturell erzwungen', () => {
  it('findet die Server Actions des Projekts überhaupt', () => {
    // Bricht der Sucher (umbenannter Ordner, geänderte Schreibweise), wäre der
    // Test sonst leer und damit still grün — die gefährlichste Sorte Test.
    expect(allActions.length).toBeGreaterThanOrEqual(4)
  })

  it.each(allActions.map((a) => [a.name, a] as const))(
    '%s prüft die Sitzung oder ist begründet öffentlich',
    (name, action) => {
      if (PUBLIC_ACTIONS[name]) {
        expect(PUBLIC_ACTIONS[name].length).toBeGreaterThan(20)
        return
      }

      const where = relative(process.cwd(), action.file).split(sep).join('/')
      expect(
        SESSION_CHECK.test(action.body),
        `Die Server Action \`${name}\` (${where}) prüft die Sitzung nicht.\n` +
          `\n` +
          `Sie ist ein öffentlicher Endpunkt: Jeder kann sie mit beliebiger Nutzlast\n` +
          `aufrufen, und der Proxy leitet Action-POSTs seit BUG-9 bewusst nicht mehr um.\n` +
          `\n` +
          `Entweder ein \`await supabase.auth.getUser()\` an den Anfang — oder, wenn sie\n` +
          `wirklich ohne Sitzung erreichbar sein muss, ein Eintrag mit Begründung in\n` +
          `PUBLIC_ACTIONS in dieser Datei.`
      ).toBe(true)
    }
  )
})
