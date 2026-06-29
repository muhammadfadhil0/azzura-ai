"use client";

import { useCallback, useRef, useState } from "react";
import ReactCrop, {
  type Crop,
  centerCrop,
  makeAspectCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { IconCheck, IconRefresh } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SEEDS = [
  "Felix",
  "Aneka",
  "Destiny",
  "Scooter",
  "Mittens",
  "Zoe",
  "Shadow",
  "Gizmo",
  "Mochi",
  "Jasper",
  "Luna",
  "Cleo",
];
const dicebearUrl = (seed: string) =>
  `https://api.dicebear.com/9.x/notionists/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;

type UploadPhase = "idle" | "crop" | "done";

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
}

function centerAspectCrop(w: number, h: number): Crop {
  return centerCrop(makeAspectCrop({ unit: "%", width: 90 }, 1, w, h), w, h);
}

export function StepAvatar({ value, onChange }: Props) {
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle");
  const [imgSrc, setImgSrc] = useState("");
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  const [croppedPreview, setCroppedPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const previewSrc = croppedPreview ?? value;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Hanya file gambar yang diizinkan.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran file maksimal 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImgSrc(reader.result as string);
      setCrop(undefined);
      setCompletedCrop(undefined);
      setCroppedPreview(null);
      setUploadPhase("crop");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth, naturalHeight } = e.currentTarget;
      setCrop(centerAspectCrop(naturalWidth, naturalHeight));
    },
    [],
  );

  const handleApplyCrop = useCallback(() => {
    const image = imgRef.current;
    if (!image || !completedCrop) return;
    const canvas = document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const px = window.devicePixelRatio;
    const size = 256;
    canvas.width = size * px;
    canvas.height = size * px;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(px, px);
    ctx.imageSmoothingQuality = "high";
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      size,
      size,
    );
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCroppedPreview(dataUrl);
    onChange(dataUrl);
    setUploadPhase("done");
  }, [completedCrop, onChange]);

  const resetUpload = () => {
    setUploadPhase("idle");
    setImgSrc("");
    setCroppedPreview(null);
    onChange(null);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Heading */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          Pilih foto profil
        </h2>
        <p className="text-sm text-muted-foreground">
          Bisa diganti kapan saja di pengaturan.
        </p>
      </div>

      {/* Preview */}
      <div className="flex justify-center">
        <div className="relative size-28 rounded-full overflow-hidden border-2 border-border bg-muted">
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc}
              alt="Preview"
              className="size-full object-cover"
            />
          ) : (
            <div className="size-full flex items-center justify-center text-muted-foreground/40 text-3xl select-none">
              ?
            </div>
          )}
        </div>
      </div>

      {/* Crop UI */}
      {uploadPhase === "crop" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-center text-muted-foreground">
            Sesuaikan area crop
          </p>
          <div className="flex justify-center rounded-xl overflow-hidden bg-muted">
            <ReactCrop
              crop={crop}
              onChange={setCrop}
              onComplete={setCompletedCrop}
              aspect={1}
              circularCrop
              className="max-h-52"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={imgSrc}
                alt="Crop"
                onLoad={onImageLoad}
                className="max-h-52 object-contain"
              />
            </ReactCrop>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={resetUpload}>
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleApplyCrop}
              disabled={!completedCrop}
            >
              Crop &amp; Gunakan
            </Button>
          </div>
        </div>
      )}

      {/* Template grid */}
      {uploadPhase !== "crop" && (
        <div className="grid grid-cols-6 gap-2">
          {SEEDS.map((seed) => {
            const url = dicebearUrl(seed);
            const active = value === url && !croppedPreview;
            return (
              <button
                key={seed}
                type="button"
                onClick={() => {
                  onChange(url);
                  setCroppedPreview(null);
                  setUploadPhase("idle");
                }}
                className={cn(
                  "relative aspect-square rounded-xl overflow-hidden border-2 transition-all bg-muted",
                  active
                    ? "border-primary ring-2 ring-primary/20 scale-105"
                    : "border-border hover:border-primary/50 hover:scale-105",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={seed} className="size-full object-cover" />
                {active && (
                  <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                    <div className="rounded-full bg-primary p-0.5">
                      <IconCheck className="size-3 text-primary-foreground" />
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Upload & reset links */}
      {uploadPhase !== "crop" && (
        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="hover:text-foreground transition-colors underline underline-offset-2"
          >
            Aku ingin upload foto sendiri
          </button>
          {croppedPreview && (
            <>
              <span>·</span>
              <button
                type="button"
                onClick={resetUpload}
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <IconRefresh className="size-3" />
                Gunakan template
              </button>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
