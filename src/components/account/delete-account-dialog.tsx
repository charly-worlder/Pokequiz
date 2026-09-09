'use client'

import { useActionState, useState } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { deleteAccountAction } from '@/lib/account/delete-action'
import type { ActionState } from '@/lib/auth/error-mapping'

/**
 * Der Lösch-Dialog (spec.md AC-9, AC-11, AC-14, AC-20; EC-3, EC-7).
 *
 * **Warum `AlertDialog` und nicht `Dialog`:** Das ist die shadcn-Komponente für
 * unumkehrbare Handlungen. Sie hat kein Schließen-Kreuz neben den Knöpfen, der
 * Fokus liegt beim Öffnen auf „Abbrechen", und sie ist als Unterbrechung
 * angelegt statt als Panel.
 *
 * **Abbrechen ist leicht, Bestätigen ist schwer** (AC-14). Escape, Klick daneben
 * und „Abbrechen" schließen folgenlos — die Hürde gehört vor die Löschung, nicht
 * vor den Rückzug.
 *
 * **Drei unterscheidbare Fehler, und das ist keine Kosmetik.** Ein technischer
 * Fehlschlag darf nicht wie ein falsches Passwort aussehen: Sonst tippt der
 * Nutzer sein richtiges Passwort neu ein und hält sich für vergesslich. Die
 * Server Action liefert die Unterscheidung mit — falsches Passwort kommt als
 * Feldfehler, Drosselung und Technikfehler als `error`.
 */
export function DeleteAccountDialog() {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    deleteAccountAction,
    {}
  )

  // Nach dem Schließen bleibt kein alter Fehler stehen, der beim nächsten Öffnen
  // wieder auftaucht und sich auf eine Eingabe von vorhin bezieht: Der Inhalt
  // bekommt einen neuen Schlüssel und wird damit frisch aufgebaut.
  //
  // **Im Event-Handler, nicht in einem Effekt.** Ein Effekt, der auf das
  // Öffnen lauscht und dabei Zustand setzt, löst eine zweite Renderrunde aus, für die
  // es keinen Grund gibt — das Schließen ist ein Ereignis, kein Zustand, auf den
  // man reagieren müsste. Die Lint-Regel react-hooks/set-state-in-effect hat
  // beim Bau genau darauf gezeigt.
  const [nonce, setNonce] = useState(0)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setNonce((value) => value + 1)
  }

  const passwordError = state.fieldErrors?.password
  const generalError = state.error

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Konto löschen</Button>
      </AlertDialogTrigger>

      <AlertDialogContent key={nonce}>
        <form action={formAction}>
          <AlertDialogHeader>
            <AlertDialogTitle>Konto endgültig löschen?</AlertDialogTitle>
            {/*
              AC-20: klar und nicht juristisch. Es steht hier ein zweites Mal,
              obwohl der Gefahrenbereich es schon sagt — wer bis hierher geklickt
              hat, soll die Folge unmittelbar vor der Bestätigung lesen, nicht
              nur davor.
            */}
            <AlertDialogDescription>
              Dein Konto, dein Trainername, alle gespielten Runden und dein Eintrag in der
              Weltrangliste werden gelöscht. Das lässt sich nicht rückgängig machen.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <Label htmlFor="delete-password">Zum Bestätigen dein Passwort</Label>
            <Input
              id="delete-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              aria-invalid={Boolean(passwordError)}
              aria-describedby={passwordError ? 'delete-password-error' : undefined}
              className="mt-1.5"
            />
            {passwordError && (
              <p id="delete-password-error" className="mt-1.5 text-[13px] text-destructive">
                {passwordError}
              </p>
            )}
          </div>

          {generalError && (
            <p role="alert" className="mb-4 text-[13px] text-destructive">
              {generalError}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={pending}>
              Abbrechen
            </AlertDialogCancel>
            {/*
              **Bewusst KEIN `AlertDialogAction`.** Der schließt den Dialog beim
              Klick — auch mit `asChild`, weil das Schließen an seinem eigenen
              `onClick` hängt und nicht am gerenderten Element. Genau das darf
              hier nicht passieren: Bei falschem Passwort, Drosselung oder
              technischem Fehler muss der Dialog offen bleiben und den Fehler
              zeigen (AC-11, EC-3, EC-7). Sonst verschwindet die Meldung im
              selben Moment, in dem sie erscheint, und der Nutzer sieht nur, dass
              nichts passiert ist.

              Geschlossen wird dieser Dialog auf genau zwei Wegen: durch
              „Abbrechen"/Escape/Klick daneben (AC-14) — oder gar nicht, weil die
              geglückte Löschung auf `/login` umleitet.
            */}
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? 'Wird gelöscht …' : 'Endgültig löschen'}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
