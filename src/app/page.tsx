import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPersonalBest } from '@/lib/quiz/run-actions'
import { QuizScreen } from '@/components/quiz/quiz-screen'

/**
 * The game screen — start, play and result are one route, because it is one
 * continuous flow and a reload loses the state anyway (docs/app-shell.md).
 *
 * spec.md AC-13: the proxy already redirects signed-out visitors, and this
 * check is the second, independent one — the page never renders for a request
 * without a session.
 */
export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const personalBest = await getPersonalBest()

  return (
    <div className="mx-auto w-full max-w-2xl px-[clamp(18px,4vw,44px)] py-[clamp(12px,1.8vw,22px)]">
      <QuizScreen initialPersonalBest={personalBest} />
    </div>
  )
}
