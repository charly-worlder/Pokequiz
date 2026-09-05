import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { actionsInFile, callsGetUser, PUBLIC_ACTIONS } from './server-actions.guard'

/**
 * **Der Wächter über alle Server Actions — angewandt auf dieses Projekt.**
 *
 * Die Erkennungslogik und die Begründung stehen in `server-actions.guard.ts`;
 * geprüft wird sie selbst in `server-actions.guard.self.test.ts`. Hier wird sie
 * über `src/` gefahren: Jede gefundene Server Action muss ihre Sitzung prüfen
 * oder mit Begründung in `PUBLIC_ACTIONS` stehen.
 */

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) sourceFiles(full, found)
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) found.push(full)
  }
  return found
}

const SRC = join(process.cwd(), 'src')
const files = sourceFiles(SRC).filter((f) => !f.endsWith('server-actions.guard.ts'))
const allActions = files.flatMap((file) => actionsInFile(file, readFileSync(file, 'utf8')))

/** Jede Datei, in der `'use server'` überhaupt vorkommt — der Gegenzeuge zur Erkennung. */
const filesMentioningUseServer = files.filter((file) =>
  /['"]use server['"]/.test(readFileSync(file, 'utf8'))
)

const rel = (file: string) => relative(process.cwd(), file).split(sep).join('/')

describe('Server Actions — Sitzungsprüfung strukturell erzwungen', () => {
  it('findet in jeder Datei, die `use server` erwähnt, mindestens eine Action', () => {
    // Der Gegenzeuge zur Erkennung selbst: Bricht der Sucher — umbenannter
    // Ordner, geänderte Schreibweise, eine Form, die der AST-Durchlauf nicht
    // kennt —, wäre der Test sonst leer und damit still grün. Genau daran ist
    // die erste Fassung gescheitert (BUG-20).
    const withoutActions = filesMentioningUseServer
      .filter((file) => !allActions.some((a) => a.file === file))
      .map(rel)

    expect(
      withoutActions,
      `Diese Dateien erwähnen \`use server\`, aber der Wächter hat darin keine Action\n` +
        `gefunden. Entweder steht die Direktive in einer Form da, die er nicht kennt —\n` +
        `dann ist er unvollständig und muss erweitert werden —, oder sie steht nur in\n` +
        `einem Kommentar. Beides gehört angesehen, nicht ignoriert.`
    ).toEqual([])

    expect(filesMentioningUseServer.length).toBeGreaterThanOrEqual(3)
    expect(allActions.length).toBeGreaterThanOrEqual(8)
  })

  it.each(allActions.map((a) => [`${a.name} (${rel(a.file)})`, a] as const))(
    '%s prüft die Sitzung oder ist begründet öffentlich',
    (_label, action) => {
      if (PUBLIC_ACTIONS[action.name]) {
        expect(PUBLIC_ACTIONS[action.name].length).toBeGreaterThan(20)
        return
      }

      const where = rel(action.file)

      if (!action.node) {
        expect(
          `nicht analysierbar: ${action.unanalyzable}`,
          `Die Server Action \`${action.name}\` (${where}) ist für den Wächter nicht\n` +
            `analysierbar: ${action.unanalyzable}.\n` +
            `\n` +
            `Was nicht geprüft werden kann, wird nicht durchgelassen. Schreibe die Action\n` +
            `als benannte Funktion in dieser Datei, oder trage sie mit Begründung in\n` +
            `PUBLIC_ACTIONS ein (src/lib/actions/server-actions.guard.ts).`
        ).toBe('analysierbar')
        return
      }

      expect(
        callsGetUser(action.node),
        `Die Server Action \`${action.name}\` (${where}) prüft die Sitzung nicht.\n` +
          `\n` +
          `Sie ist ein öffentlicher Endpunkt: Jeder kann sie mit beliebiger Nutzlast\n` +
          `aufrufen, und auf der Quiz-Route greift der Proxy-Schutz seit BUG-9 nicht.\n` +
          `\n` +
          `Entweder ein \`await supabase.auth.getUser()\` an den Anfang — oder, wenn sie\n` +
          `wirklich ohne Sitzung erreichbar sein muss, ein Eintrag mit Begründung in\n` +
          `PUBLIC_ACTIONS (src/lib/actions/server-actions.guard.ts).`
      ).toBe(true)
    }
  )
})
