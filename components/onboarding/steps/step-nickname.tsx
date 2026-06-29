"use client";

import { Input } from "@/components/ui/input";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function StepNickname({ value, onChange }: Props) {
  const trimmed = value.trim();

  return (
    <div className="flex flex-col gap-10 py-4">
      <div className="flex flex-col gap-2">
        <h2 className="animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both text-2xl font-semibold tracking-tight">
          Halo, saya Azzura
        </h2>
        <p className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-100 fill-mode-both text-sm text-muted-foreground">
          Sebelum mulai, boleh tau siapa namamu?
        </p>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-200 fill-mode-both flex flex-col gap-2">
        <Input
          autoFocus
          placeholder="Nama panggilanmu…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11"
        />
        <div className="min-h-[16px]">
          {trimmed.length >= 2 && (
            <p className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both text-xs text-muted-foreground">
              Halo,{" "}
              <span className="font-medium text-foreground">{trimmed}</span>!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
