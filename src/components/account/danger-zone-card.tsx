import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DeleteAccountDialog } from './delete-account-dialog'

/**
 * Der Gefahrenbereich (spec.md AC-8).
 *
 * **Optisch abgesetzt, und zwar bevor geklickt wird.** Der Rahmen ist
 * `--destructive` statt `--border`, und die Aufzählung nennt jede der vier
 * Folgen beim Namen. AC-8 verlangt ausdrücklich, dass das **vor** dem Klick
 * dasteht — nicht erst im Dialog. Wer den Knopf sieht, soll schon wissen, was er
 * auslöst; der Dialog wiederholt es dann als letzte Bestätigung.
 */
export function DangerZoneCard() {
  return (
    <Card className="rounded-card border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Konto löschen</CardTitle>
        <CardDescription>
          Das lässt sich nicht rückgängig machen. Gelöscht wird:
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="list-disc space-y-1 pl-5 text-[15px] text-muted-foreground">
          <li>dein Konto und deine Anmeldedaten</li>
          <li>
            dein Trainername — er wird danach wieder frei und kann von jemand anderem gewählt
            werden
          </li>
          <li>alle deine gespielten Runden</li>
          <li>dein Eintrag in der Weltrangliste</li>
        </ul>

        <div className="pt-5">
          <DeleteAccountDialog />
        </div>
      </CardContent>
    </Card>
  )
}
