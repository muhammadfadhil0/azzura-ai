import type { SupabaseClient } from '@supabase/supabase-js'

export interface Profile {
  id: string
  email: string | null
  display_name: string | null
  nickname: string | null
  avatar_url: string | null
  job: string | null
  bio: string | null
  onboarding_completed: boolean
  onboarding_last_prompted_at: string | null
  created_at: string
  updated_at: string | null
}

export interface OnboardingData {
  nickname: string
  avatar_url: string | null
  job: string | null
  bio: string | null
}

export async function getProfile(supabase: SupabaseClient, userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) return null
  return data as Profile
}

export async function markOnboardingShown(supabase: SupabaseClient, userId: string) {
  await supabase
    .from('profiles')
    .upsert({ id: userId, onboarding_last_prompted_at: new Date().toISOString() }, { onConflict: 'id' })
}

export async function completeOnboarding(
  supabase: SupabaseClient,
  userId: string,
  data: OnboardingData,
) {
  const { error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        nickname: data.nickname,
        avatar_url: data.avatar_url,
        job: data.job,
        bio: data.bio,
        onboarding_completed: true,
        onboarding_last_prompted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
  if (error) throw error
}
