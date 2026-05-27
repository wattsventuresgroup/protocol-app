import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BottomNav from './BottomNav'
import AppHeader from './components/AppHeader'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      maxWidth: 'var(--app-max-width)',
      margin: '0 auto',
      background: 'var(--color-surface)',
      position: 'relative',
    }}>
      <AppHeader />
      <main style={{
        flex: 1,
        overflowY: 'auto',
        paddingTop: '56px',
        paddingBottom: 'calc(64px + env(safe-area-inset-bottom))',
        paddingLeft: 'var(--app-h-padding)',
        paddingRight: 'var(--app-h-padding)',
      }}>
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
