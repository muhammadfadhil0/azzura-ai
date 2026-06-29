'use client'

import { suggestionCards } from '@/lib/dummy-data'

interface Props {
  onSuggest: (prompt: string) => void
}

export function EmptyState({ onSuggest }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Halo, Aku Azzura
        </h1>
        <p className="text-lg text-muted-foreground">
          Ada yang bisa aku bantu?
        </p>
      </div>
      <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {suggestionCards.map(({ icon: Icon, title, prompt }) => (
          <button
            key={title}
            type="button"
            onClick={() => onSuggest(prompt)}
            className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card p-4 text-left text-sm transition-colors hover:bg-surface-hover"
          >
            <Icon className="mt-0.5 size-5 text-muted-foreground" />
            <div className="flex-1">
              <div className="font-medium">{title}</div>
              <div className="line-clamp-2 text-xs text-muted-foreground">
                {prompt}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
