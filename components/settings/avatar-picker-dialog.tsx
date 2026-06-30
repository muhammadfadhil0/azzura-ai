'use client'

import { useRef, useState } from 'react'
import { IconCheck, IconUpload } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { uploadAvatar } from '@/lib/supabase/storage'
import { cn } from '@/lib/utils'

const SEEDS = ['Felix', 'Aneka', 'Destiny', 'Scooter', 'Mittens', 'Zoe', 'Shadow', 'Gizmo', 'Mochi', 'Jasper', 'Luna', 'Cleo']
const dicebearUrl = (seed: string) => `https://api.dicebear.com/9.x/notionists/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  onSaved: (url: string) => void
}

type Tab = 'template' | 'upload'

export function AvatarPickerDialog({ open, onOpenChange, userId, onSaved }: Props) {
  const [tab, setTab] = useState<Tab>('template')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [uploadFile, setUploadFile] = useState<{ dataUrl: string; mimeType: string } | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const pendingUrl = tab === 'template' ? selectedTemplate : previewUrl

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    if (!file.type.startsWith('image/')) {
      setError('Hanya file gambar yang diizinkan.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Ukuran file maksimal 5 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setUploadFile({ dataUrl, mimeType: file.type })
      setPreviewUrl(dataUrl)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleSave = async () => {
    if (!pendingUrl) return
    setUploading(true)
    setError(null)
    try {
      const supabase = createClient()
      let finalUrl = pendingUrl
      if (tab === 'upload' && uploadFile) {
        finalUrl = await uploadAvatar(supabase, userId, uploadFile.dataUrl, uploadFile.mimeType)
      }
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: finalUrl },
      })
      if (updateError) throw updateError
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          { id: userId, avatar_url: finalUrl, updated_at: new Date().toISOString() },
          { onConflict: 'id' },
        )
      if (profileError) throw profileError
      onSaved(finalUrl)
      onOpenChange(false)
    } catch {
      setError('Gagal menyimpan avatar. Coba lagi.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="sm:max-w-md gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Ganti foto profil</DialogTitle>
        </DialogHeader>

        <div className="flex border-b border-border px-6">
          {(['template', 'upload'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                tab === t
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t === 'template' ? 'Template' : 'Upload'}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === 'template' && (
            <div className="grid grid-cols-4 gap-2.5">
              {SEEDS.map((seed) => {
                const url = dicebearUrl(seed)
                const active = selectedTemplate === url
                return (
                  <button
                    key={seed}
                    type="button"
                    onClick={() => setSelectedTemplate(url)}
                    className={cn(
                      'relative aspect-square rounded-xl overflow-hidden border-2 transition-all bg-muted',
                      active
                        ? 'border-primary ring-2 ring-primary/30'
                        : 'border-border hover:border-primary/50',
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={seed} className="size-full object-cover" />
                    {active && (
                      <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                        <IconCheck className="size-5 text-primary drop-shadow" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {tab === 'upload' && (
            <div className="flex flex-col items-center gap-4">
              {previewUrl ? (
                <div className="flex flex-col items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="size-28 rounded-full object-cover border-2 border-border"
                  />
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    Ganti gambar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border py-10 transition-colors hover:border-primary/50 hover:bg-muted/30"
                >
                  <IconUpload className="size-8 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Klik untuk upload</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">PNG, JPG, WebP • Maks 5 MB</p>
                  </div>
                </button>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          )}

          {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter className="px-6 pb-6 pt-0">
          <Button onClick={handleSave} disabled={!pendingUrl || uploading}>
            {uploading ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
