import ts from 'typescript'

/**
 * **Testinfrastruktur, kein Anwendungscode.** Die Erkennungslogik hinter
 * `server-actions.guard.test.ts` (prüft das Projekt) und
 * `server-actions.guard.self.test.ts` (prüft diese Logik). Sie liegt in einem
 * eigenen Modul, damit beide sie importieren können, ohne dass die
 * Projektprüfungen doppelt laufen.
 *
 * **Wozu das Ganze.** Jede aus einer `'use server'`-Datei exportierte Funktion —
 * und jede Funktion mit einem `'use server'` im eigenen Rumpf — ist ein
 * öffentlicher HTTP-Endpunkt. Seit BUG-9 leitet der Proxy Action-POSTs auf der
 * Quiz-Route bewusst nicht mehr um, weil Next.js eine HTTP-Weiterleitung darauf
 * als Protokollbruch behandelt; die Sitzungsprüfung sitzt deshalb in der Action
 * selbst.
 *
 * **Dieser Wächter beantwortet genau eine Frage:** „Gibt es eine Server Action,
 * an die beim Schreiben niemand gedacht hat?" Er prüft, ob im Rumpf ein Aufruf
 * namens `getUser` steht — **nicht**, ob die Sitzung wirksam geprüft wird. Eine
 * Attrappe kommt durch: ein Aufruf in einem toten Zweig, ein nie ausgeführter
 * Callback, ein eigener lokaler `getUser`. Das ist eine bewusste, dokumentierte
 * Grenze und kein Versehen — `design.md` → „Was der Wächter über die Server
 * Actions leistet — und was nicht" führt sie samt Messung auf. **Ob eine
 * vorhandene Prüfung taugt, entscheidet das Code-Review**, nicht diese Datei.
 *
 * **Überarbeitet am 2026-09-05 nach BUG-20.** Die erste Fassung versprach genau
 * diese Zusicherung und hielt sie nicht — ein QA-Verifizierer fand fünf
 * Schreibweisen, an denen sie vorbeisah. Alle fünf sind hier geschlossen und
 * einzeln im Selbsttest festgenagelt:
 *
 * 1. **Inline-`'use server'` im Funktionsrumpf** — die erste Fassung sah nur auf
 *    den Dateianfang und übersah damit ausgerechnet die Form, die Next.js'
 *    eigene Dokumentation zuerst zeigt.
 * 2. **Re-Export** (`export { x } from './y'`, `export *`).
 * 3. **Anonymer Default-Export.**
 * 4. **Destrukturierter Export** (`export const { a } = impl`).
 * 5. **Falsch-Grün durch Textsuche** — `getUser` wurde im Quelltext gesucht, ein
 *    `// TODO: getUser()` reichte. Jetzt entscheidet der AST, der keine
 *    Kommentare kennt.
 *
 * Die Grundregel: **Was der Wächter nicht analysieren kann, lässt er nicht
 * durch.** Eine Absicherung, die im Zweifel schweigt, ist schlimmer als keine —
 * `src/proxy.ts` stützt sich in einem Kommentar ausdrücklich auf diese hier, und
 * wer das liest, hört auf selbst zu prüfen.
 */

/**
 * Actions, die absichtlich **ohne** Sitzung erreichbar sind. Wer hier einträgt,
 * schreibt den Grund dazu — der Text ist der Zweck der Liste, nicht der
 * Schlüssel. Sie ist keine Erlaubnisliste, die man erweitert, um grün zu werden.
 */
export const PUBLIC_ACTIONS: Record<string, string> = {
  registerAction:
    'Registrierung — wer noch kein Konto hat, kann per Definition keine Sitzung haben (PROJ-1 AC-1).',
  loginAction:
    'Anmeldung — dasselbe: Die Sitzung entsteht hier erst (PROJ-1 AC-4). Gegen Erraten schützt die Drosselung, nicht eine Sitzungsprüfung.',
  requestPasswordResetAction:
    'Passwort vergessen — genau der Fall, in dem der Nutzer nicht hereinkommt (PROJ-1 AC-11). Antwortet bewusst immer gleich, damit sie keine Konten verrät.',
  logoutAction:
    'Abmelden ohne Sitzung ist wirkungslos: Es gibt nichts zu beenden und nichts preiszugeben.',
}

export type Action = {
  name: string
  file: string
  /** `null`, wenn die Form nicht analysierbar ist — dann gilt sie als ungeschützt. */
  node: ts.Node | null
  /** Warum sie nicht analysierbar ist; nur gesetzt, wenn `node === null`. */
  unanalyzable?: string
}

const USE_SERVER = /^['"]use server['"]$/
const ANY_DIRECTIVE = /^['"][^'"]*['"]$/

function hasUseServerDirective(statements: ts.NodeArray<ts.Statement>): boolean {
  for (const statement of statements) {
    if (!ts.isExpressionStatement(statement)) break
    const text = statement.expression.getText().trim()
    if (USE_SERVER.test(text)) return true
    // Andere Direktiven ('use client', 'use strict') dürfen davorstehen.
    if (!ANY_DIRECTIVE.test(text)) break
  }
  return false
}

/** Trägt diese Funktion die Direktive in ihrem eigenen Rumpf? (Lücke 1) */
function hasInlineDirective(node: ts.Node): boolean {
  const body = (node as ts.FunctionLikeDeclaration).body
  return !!body && ts.isBlock(body) && hasUseServerDirective(body.statements)
}

/**
 * Sucht im AST einen echten `getUser(...)`-Aufruf — nicht im Text (Lücke 5).
 * Deckt den verketteten Fall (`supabase.auth.getUser()`) und den blanken ab.
 */
export function callsGetUser(node: ts.Node): boolean {
  let found = false
  const visit = (child: ts.Node) => {
    if (found) return
    if (ts.isCallExpression(child)) {
      const callee = child.expression
      const name = ts.isPropertyAccessExpression(callee)
        ? callee.name.text
        : ts.isIdentifier(callee)
          ? callee.text
          : ''
      if (name === 'getUser') {
        found = true
        return
      }
    }
    ts.forEachChild(child, visit)
  }
  ts.forEachChild(node, visit)
  return found
}

function isExported(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  )
}

/** Der Name, unter dem eine anonyme Funktion gebunden ist — `const x = async () => {}`. */
function nameFromBinding(node: ts.Node): string | null {
  const parent = node.parent
  if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
    return parent.name.text
  }
  if (parent && ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) {
    return parent.name.text
  }
  return null
}

export function actionsInFile(file: string, text: string): Action[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const moduleIsAction = hasUseServerDirective(source.statements)
  const actions: Action[] = []
  const seen = new Set<ts.Node>()

  const add = (a: Action) => {
    if (a.node) {
      if (seen.has(a.node)) return
      seen.add(a.node)
    }
    actions.push(a)
  }

  // --- Exporte eines 'use server'-Moduls -----------------------------------
  if (moduleIsAction) {
    for (const statement of source.statements) {
      if (ts.isFunctionDeclaration(statement) && isExported(statement)) {
        // Lücke 3: auch ohne Namen erfassen, nicht überspringen.
        add({ name: statement.name?.text ?? 'default (anonym)', file, node: statement })
        continue
      }
      if (ts.isVariableStatement(statement) && isExported(statement)) {
        for (const decl of statement.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            add({ name: decl.name.text, file, node: statement })
          } else {
            // Lücke 4: destrukturiert — nicht analysierbar, also nicht durchlassen.
            add({
              name: decl.name.getText(source),
              file,
              node: null,
              unanalyzable:
                'destrukturierter Export — der Wächter kann nicht sehen, welche Funktion dahinter steht',
            })
          }
        }
        continue
      }
      if (ts.isExportAssignment(statement)) {
        add({ name: 'export default', file, node: statement })
        continue
      }
      if (ts.isExportDeclaration(statement)) {
        // Typen werden zur Laufzeit gelöscht und sind nie eine Action.
        if (statement.isTypeOnly) continue
        const clause = statement.exportClause
        if (clause && ts.isNamedExports(clause) && clause.elements.every((e) => e.isTypeOnly)) {
          continue
        }
        // Lücke 2: Re-Export bzw. lokaler Export ohne sichtbaren Rumpf.
        add({
          name: statement.getText(source).split('\n')[0].trim(),
          file,
          node: null,
          unanalyzable: statement.moduleSpecifier
            ? 're-exportiert aus einer anderen Datei — der Wächter kann den Rumpf hier nicht sehen'
            : 'über eine Export-Liste exportiert — der Wächter kann die Deklaration nicht sicher zuordnen',
        })
      }
    }
  }

  // --- Lücke 1: Funktionen mit eigener Direktive, in JEDER Datei ------------
  const visit = (node: ts.Node) => {
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node)) &&
      hasInlineDirective(node)
    ) {
      const own =
        (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) && node.name
          ? node.name.text
          : ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)
            ? node.name.text
            : null
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
      add({ name: own ?? nameFromBinding(node) ?? `inline @ Zeile ${line}`, file, node })
    }
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(source, visit)

  return actions
}
