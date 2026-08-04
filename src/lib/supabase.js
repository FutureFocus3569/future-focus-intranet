import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
    },
  }
)

export const CENTRES = [
  'Papamoa Beach',
  'The Boulevard',
  'Terrace Views',
  'Livingstone',
  'West Dune',
  'Head Office',
]

export const PERMISSIONS = [
  { value: 'super_admin', label: 'Super Admin', description: 'Full access — all centres, all staff' },
  { value: 'centre_leader', label: 'Centre Leader', description: 'Manage staff at their centre' },
  { value: 'policy_admin', label: 'Policy Admin', description: 'Manage documents in Knowledge Centre' },
  { value: 'staff', label: 'Staff', description: 'Standard access — view only' },
]
