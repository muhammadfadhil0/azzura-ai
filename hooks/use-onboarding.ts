'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  completeOnboarding as dbCompleteOnboarding,
  getProfile,
  markOnboardingShown,
  type OnboardingData,
  type Profile,
} from '@/lib/supabase/profiles'

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000

export function useOnboarding() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted || !user) { setLoading(false); return }

      setUserId(user.id)
      const prof = await getProfile(supabase, user.id)
      if (!mounted) return

      setProfile(prof)

      if (!prof || prof.onboarding_completed) {
        setLoading(false)
        return
      }

      const lastPrompted = prof.onboarding_last_prompted_at
      const withinWindow = !lastPrompted ||
        Date.now() - new Date(lastPrompted).getTime() < TWELVE_HOURS_MS

      if (withinWindow) {
        setShowOnboarding(true)
        await markOnboardingShown(supabase, user.id)
      }
      setLoading(false)
    }

    init()
    return () => { mounted = false }
  }, [])

  async function completeOnboarding(data: OnboardingData) {
    if (!userId) return
    const supabase = createClient()
    await dbCompleteOnboarding(supabase, userId, data)
    setShowOnboarding(false)
  }

  function dismissOnboarding() {
    setShowOnboarding(false)
  }

  async function refreshProfile() {
    if (!userId) return
    const supabase = createClient()
    const prof = await getProfile(supabase, userId)
    setProfile(prof)
  }

  return { showOnboarding, loading, profile, completeOnboarding, dismissOnboarding, refreshProfile }
}
