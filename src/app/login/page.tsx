import { AuthCard } from '@/components/auth/auth-card'

export default function LoginPage() {
  return (
    // BUG-5 (PROJ-1/qa-report.md): this used to be a <main>. Since PROJ-2 the
    // app shell provides the page's <main> (components/shell/page-frame.tsx),
    // so a second one here nested two "main" landmarks in one document —
    // invalid HTML, and screen readers offer both.
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <AuthCard />
    </div>
  )
}
