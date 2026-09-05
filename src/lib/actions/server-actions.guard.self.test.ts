import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { actionsInFile, callsGetUser } from './server-actions.guard'

/**
 * **Der Test über den Wächter.**
 *
 * `server-actions.guard.test.ts` ist die einzige strukturelle Zusicherung dafür,
 * dass jede Server Action ihre Sitzung prüft — `src/proxy.ts` stützt sich in
 * seinem Kommentar ausdrücklich darauf. Eine solche Zusicherung muss selbst
 * geprüft werden, sonst ist sie eine Behauptung.
 *
 * Genau daran ist die erste Fassung gescheitert (BUG-20, QA-Lauf 2026-09-05):
 * Sie war grün, ihre Erkennung hatte aber fünf Lücken — und niemand hatte je
 * eine Datei erfunden, die durch sie hindurchfällt. Jede Lücke steht hier als
 * eigener Fall.
 *
 * Die Quelltexte unten sind absichtlich Zeichenketten und keine echten Dateien:
 * Eine ungeschützte Server Action ins Projekt zu legen, nur um sie zu prüfen,
 * wäre genau der Fehler, gegen den der Wächter existiert.
 */

const names = (src: string) => actionsInFile('probe.ts', src).map((a) => a.name)
const find = (src: string, name: string) =>
  actionsInFile('probe.ts', src).find((a) => a.name === name)

describe('Der Wächter selbst — die fünf Lücken aus BUG-20', () => {
  it('Lücke 1: findet ein `use server` im Funktionsrumpf, auch ohne Direktive am Dateianfang', () => {
    // Genau die Form, die Next.js' mitgelieferte Dokumentation als Erstes zeigt.
    // Die erste Fassung sah nur auf den Dateianfang und übersah diese Datei komplett.
    const src = `
      import { createClient } from '@/lib/supabase/server'
      export default function Page() { return null }
      export async function inlineAction(payload: unknown) {
        'use server'
        return { leaked: payload }
      }
    `
    expect(names(src)).toContain('inlineAction')
    expect(callsGetUser(find(src, 'inlineAction')!.node!)).toBe(false)
  })

  it('Lücke 1b: erkennt sie auch als Pfeilfunktion und als Methode', () => {
    const src = `
      const arrow = async () => { 'use server'; return 1 }
      const obj = { async method() { 'use server'; return 2 } }
    `
    const found = names(src)
    expect(found).toContain('arrow')
    expect(found).toContain('method')
  })

  it('Lücke 2: lehnt einen Re-Export aus einem `use server`-Modul ab, statt ihn zu übersehen', () => {
    const src = `
      'use server'
      export { hiddenAction } from './helpers'
      export * from './more'
    `
    const found = actionsInFile('probe.ts', src)
    expect(found.length).toBe(2)
    // Nicht analysierbar heißt: nicht durchlassen.
    for (const action of found) {
      expect(action.node).toBeNull()
      expect(action.unanalyzable).toMatch(/re-exportiert/)
    }
  })

  it('Lücke 3: erfasst einen anonymen Default-Export, statt ihn zu überspringen', () => {
    const src = `
      'use server'
      export default async function (payload: unknown) { return { leaked: payload } }
    `
    const found = actionsInFile('probe.ts', src)
    expect(found.length).toBe(1)
    expect(callsGetUser(found[0].node!)).toBe(false)
  })

  it('Lücke 4: lehnt einen destrukturierten Export ab, statt ihn zu überspringen', () => {
    const src = `
      'use server'
      import { impl } from './impl'
      export const { doThing } = impl
    `
    const found = actionsInFile('probe.ts', src)
    expect(found.length).toBe(1)
    expect(found[0].node).toBeNull()
    expect(found[0].unanalyzable).toMatch(/destrukturiert/)
  })

  it('Lücke 5: ein `getUser()` im Kommentar zählt nicht als Sitzungsprüfung', () => {
    // Die erste Fassung prüfte den *Text* des Rumpfs — dieser Kommentar reichte
    // für ein Bestanden. Der AST kennt keine Kommentare.
    const src = `
      'use server'
      export async function looksSafe() {
        // TODO: await supabase.auth.getUser() ergänzen
        return { secret: 'leaked' }
      }
    `
    const action = find(src, 'looksSafe')!
    expect(action.node).not.toBeNull()
    expect(callsGetUser(action.node!)).toBe(false)
  })

  it('erkennt einen echten Aufruf weiterhin — auch verkettet und destrukturiert', () => {
    const chained = `
      'use server'
      export async function guarded() {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return null
        return 'ok'
      }
    `
    expect(callsGetUser(find(chained, 'guarded')!.node!)).toBe(true)

    const bare = `
      'use server'
      export async function guarded2() {
        const user = await getUser()
        return user ? 'ok' : null
      }
    `
    expect(callsGetUser(find(bare, 'guarded2')!.node!)).toBe(true)
  })

  it('lässt eine Datei ohne `use server` vollständig in Ruhe', () => {
    const src = `
      export async function ordinaryHelper() { return 42 }
      export const value = 1
    `
    expect(actionsInFile('probe.ts', src)).toEqual([])
  })

  it('zählt eine Action nicht doppelt, wenn beide Wege auf sie zeigen', () => {
    // Exportiert aus einem 'use server'-Modul UND mit eigener Direktive im Rumpf.
    const src = `
      'use server'
      export async function twice() { 'use server'; return 1 }
    `
    expect(actionsInFile('probe.ts', src).length).toBe(1)
  })

  it('erkennt `use server` auch hinter einer anderen Direktive', () => {
    const src = `
      'use strict'
      'use server'
      export async function afterOtherDirective() { return 1 }
    `
    expect(names(src)).toContain('afterOtherDirective')
  })

  it('hält den AST-Sucher an einen echten Aufruf, nicht an eine Zeichenkette', () => {
    const source = ts.createSourceFile(
      'x.ts',
      `function f() { const s = "getUser()"; return s }`,
      ts.ScriptTarget.Latest,
      true
    )
    expect(callsGetUser(source)).toBe(false)
  })
})
