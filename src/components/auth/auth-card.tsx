'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoginView } from './login-view'
import { RegisterView } from './register-view'
import { ForgotPasswordView } from './forgot-password-view'

type View = 'login' | 'register' | 'forgot-password'

const COPY: Record<View, { title: string; description: string }> = {
  login: { title: 'Anmelden', description: 'Melde dich an, um deine Serie fortzusetzen.' },
  register: {
    title: 'Konto erstellen',
    description: 'Trainername, E-Mail und Passwort — und los geht’s.',
  },
  'forgot-password': {
    title: 'Passwort vergessen',
    description: 'Wir schicken dir einen Link zum Zurücksetzen.',
  },
}

export function AuthCard() {
  const [view, setView] = useState<View>('login')

  return (
    <Card className="w-full max-w-md rounded-card">
      <CardHeader>
        <CardTitle>{COPY[view].title}</CardTitle>
        <CardDescription>{COPY[view].description}</CardDescription>
      </CardHeader>
      <CardContent>
        {view === 'login' && (
          <LoginView
            onSwitchToRegister={() => setView('register')}
            onSwitchToForgotPassword={() => setView('forgot-password')}
          />
        )}
        {view === 'register' && <RegisterView onSwitchToLogin={() => setView('login')} />}
        {view === 'forgot-password' && (
          <ForgotPasswordView onBackToLogin={() => setView('login')} />
        )}
      </CardContent>
    </Card>
  )
}
