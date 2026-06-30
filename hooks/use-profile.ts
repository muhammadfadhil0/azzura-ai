'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getProfile, type Profile } from '@/lib/supabase/profiles'

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    async function load(userId: string) {
      const prof = await getProfile(supabase, userId)
      if (mounted) {
        setProfile(prof)
        setLoading(false)
      }
    }

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) load(data.user.id)
      else if (mounted) setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) load(session.user.id)
      else if (mounted) {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  async function refresh() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const prof = await getProfile(supabase, user.id)
    setProfile(prof)
  }

  return { profile, loading, refresh }
}
