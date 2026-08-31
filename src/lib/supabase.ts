// Supabase Client Setup
//
// Dies ist der Browser-Client für einfache Lesezugriffe. Die Auth-Flows
// (Registrierung, Login, Session) brauchen zusätzlich den @supabase/ssr-Split
// aus Server-Client + Middleware — den führt PROJ-1 ein, siehe
// docs/stacks/backend-supabase.md → "The login and signup flow".

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
