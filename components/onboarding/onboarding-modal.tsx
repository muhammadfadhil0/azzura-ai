'use client'

import { useState } from 'react'
import { IconX } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { uploadAvatar } from '@/lib/supabase/storage'
import { useOnboarding } from '@/hooks/use-onboarding'
import { useUser } from '@/hooks/use-user'
import { cn } from '@/lib/utils'
import { StepAvatar } from './steps/step-avatar'
import { StepNickname } from './steps/step-nickname'
import { StepProfile } from './steps/step-profile'

const TOTAL_STEPS = 3

const STEP_LABELS = ['Nama', 'Foto', 'Profil']

export function OnboardingModal() {
  const { showOnboarding, loading, completeOnboarding, dismissOnboarding } = useOnboarding()
  const { user } = useUser()

  const [step, setStep] = useState(1)
  const [nickname, setNickname] = useState('')
  const [avatarValue, setAvatarValue] = useState<string | null>(null)
  const [job, setJob] = useState<string | null>(null)
  const [bio, setBio] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading || !showOnboarding) return null

  const canNext = step === 1 ? nickname.trim().length >= 2 : true

  async function handleNext() {
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      let finalAvatarUrl = avatarValue
      if (avatarValue?.startsWith('data:') && user?.id) {
        const supabase = createClient()
        const mimeMatch = avatarValue.match(/data:([^;]+);/)
        const mimeType = mimeMatch?.[1] ?? 'image/jpeg'
        finalAvatarUrl = await uploadAvatar(supabase, user.id, avatarValue, mimeType)
      }
      await completeOnboarding({
        nickname: nickname.trim(),
        avatar_url: finalAvatarUrl,
        job: job || null,
        bio: bio || null,
      })
      if (finalAvatarUrl) {
        const supabase = createClient()
        await supabase.auth.updateUser({ data: { avatar_url: finalAvatarUrl } })
      }
    } catch {
      setError('Gagal menyimpan. Silakan coba lagi.')
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={showOnboarding} onOpenChange={(open) => { if (!open) dismissOnboarding() }}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg gap-0 p-0 overflow-hidden">

        {/* Top bar: step chips + dismiss */}
        <div className="flex items-center justify-between px-6 pt-4 pb-2">
          <div className="flex items-center gap-1.5">
            {STEP_LABELS.map((label, i) => (
              <span
                key={label}
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                  i + 1 === step
                    ? 'bg-primary text-primary-foreground'
                    : i + 1 < step
                      ? 'bg-muted text-muted-foreground line-through'
                      : 'bg-muted/50 text-muted-foreground/60',
                )}
              >
                {i + 1 < step ? '✓' : `${i + 1}.`} {label}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={dismissOnboarding}
            className="rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Tutup"
          >
            <IconX className="size-3.5" />
          </button>
        </div>

        {/* Step content */}
        <div className="overflow-y-auto px-6 pb-2 pt-4 min-h-[320px] max-h-[60vh]">
          {step === 1 && <StepNickname value={nickname} onChange={setNickname} />}
          {step === 2 && <StepAvatar value={avatarValue} onChange={setAvatarValue} />}
          {step === 3 && (
            <StepProfile
              nickname={nickname.trim()}
              avatarUrl={avatarValue}
              job={job}
              bio={bio}
              onJobChange={setJob}
              onBioChange={setBio}
            />
          )}
          {error && (
            <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4 mt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 1}
            className="text-muted-foreground"
          >
            Kembali
          </Button>
          <Button
            size="sm"
            onClick={handleNext}
            disabled={!canNext || submitting}
            className="min-w-24"
          >
            {submitting
              ? 'Menyimpan…'
              : step === TOTAL_STEPS
                ? 'Selesai'
                : 'Lanjut'}
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  )
}
