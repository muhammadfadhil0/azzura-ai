// Per-model-family prompt variants. Different model families respond best to
// different prompting styles:
// - Claude (sonnet/opus): polite, collaborative tone with examples. Forceful
//   "WAJIB/DILARANG" language can trigger safety reflexes.
// - Gemini / OpenAI / others: more direct, list-based instructions. Less
//   responsive to nuance, benefit from explicit rules and capitalization.
//
// To add a new family: extend `ModelFamily`, add detection in `getModelFamily`,
// and register a `PromptVariant` in `VARIANTS`.

export type ModelFamily = 'claude' | 'gemini' | 'openai' | 'default'

export function getModelFamily(
  modelId: string | null | undefined,
): ModelFamily {
  if (!modelId) return 'default'
  const m = modelId.toLowerCase()
  if (m.includes('claude')) return 'claude'
  if (m.includes('gemini')) return 'gemini'
  if (
    m.startsWith('gpt-') ||
    m.startsWith('o1-') ||
    m.startsWith('o3-') ||
    m.startsWith('o4-')
  ) {
    return 'openai'
  }
  return 'default'
}

interface CanvasBlockOpts {
  hasCanvasContent: boolean
}

export interface PromptVariant {
  canvasBlock: (opts: CanvasBlockOpts) => string
}

// ============================================================================
// CLAUDE — polite, collaborative, example-driven.
// ============================================================================
function claudeCanvasBlock({ hasCanvasContent }: CanvasBlockOpts): string {
  const revisionNote = hasCanvasContent
    ? 'Canvas sudah ada isinya (lihat blok CURRENT CANVAS di bawah). Untuk revisi gunakan mode "patch" dan kirim ulang FULL content dengan revisi sudah diterapkan.'
    : 'Canvas masih kosong. Penulisan pertama gunakan mode "initial" dan sertakan parameter "title".'
  return `TOOL: \`write_canvas(title, content, mode)\` — Canvas panel sedang aktif untuk percakapan ini.

Kapan menggunakannya:
- Saat user minta konten panjang seperti artikel, esai, makalah, dokumen, draft, surat, ringkasan panjang, daftar panjang, atau kode panjang.
- Saat user minta revisi terhadap canvas yang sudah ada.
- Patokan kasar: kalau jawabanmu akan ≥ ~100 kata, lebih baik tulis di canvas daripada chat.

Cara menggunakannya:
1. Panggil tool write_canvas dengan parameter content berisi konten lengkap dalam markdown.
2. Di balasan chat-mu (assistant content), tulis konfirmasi singkat 1–2 kalimat saja. Contoh: "Esainya sudah saya tulis di canvas.", "Sudah saya tambahkan kesimpulan."
3. Hindari menyalin atau mengulangi isi canvas di chat — itu redundan dan mengganggu user. Chat hanya untuk konfirmasi singkat.

Contoh penulisan baru:
  User: "tulis esai 500 kata tentang gunung api"
  Asisten memanggil write_canvas dengan title, content lengkap, mode="initial".
  Asisten membalas di chat: "Esai 500 kata tentang gunung api sudah ada di canvas."

Contoh revisi:
  User: "ubah paragraf 2 jadi lebih ringkas"
  Asisten memanggil write_canvas dengan content baru (utuh, paragraf 2 sudah diringkas), mode="patch".
  Asisten membalas di chat: "Paragraf 2 sudah saya ringkas."

${revisionNote}

Jangan gunakan write_canvas untuk obrolan biasa: sapaan, klarifikasi singkat, pertanyaan factual dengan jawaban pendek. Itu cukup dibalas di chat seperti biasa.`
}

// ============================================================================
// FORCEFUL — direct, rule-heavy. Cocok untuk model yang kurang responsif
// terhadap instruksi halus (Gemini, GPT/OpenAI, default fallback).
// ============================================================================
function forcefulCanvasBlock({ hasCanvasContent }: CanvasBlockOpts): string {
  const revisionNote = hasCanvasContent
    ? 'Canvas SUDAH PUNYA ISI sebelumnya (lihat blok CURRENT CANVAS di bawah). Mode default untuk revisi: "patch".'
    : 'Canvas masih KOSONG. Penulisan pertama: mode="initial", WAJIB isi parameter "title".'
  return `TOOL: \`write_canvas(title, content, mode)\` — TERSEDIA. Canvas panel AKTIF.

ATURAN MUTLAK (PRIORITAS TERTINGGI):
1. Untuk konten long-form (artikel, esai, makalah, dokumen, draft, surat, kode panjang, daftar panjang, ringkasan panjang ≥ ~100 kata): WAJIB panggil write_canvas. DILARANG menulis isi konten itu di balasan chat — sama sekali, walau sebagian.
2. Balasan chat saat memanggil write_canvas HARUS PENDEK: maksimal 1–2 kalimat Bahasa Indonesia, hanya konfirmasi (contoh: "Saya tulis di canvas, lihat panel kanan."). DILARANG menyalin, mengutip, atau merangkum ulang isi canvas di chat. DILARANG menulis pembuka tipe "Berikut esainya:" lalu menempel content.
3. Kalau user minta revisi terhadap canvas, panggil write_canvas LAGI dengan content baru. Balasan chat tetap pendek (contoh: "Sudah saya revisi paragraf 2.").

${revisionNote}

MODE:
- "initial": canvas kosong, isi dari nol. WAJIB title.
- "replace": tulis ulang seluruh isi.
- "patch": revisi lokal. TETAP kirim FULL content baru (utuh) — UI yang handle diff dan animasi.

PENGECUALIAN — JANGAN panggil write_canvas untuk:
- Sapaan, basa-basi, klarifikasi singkat.
- Pertanyaan factual pendek (jawaban < 100 kata).
- Permintaan yang BUKAN minta dokumen/teks panjang.
Untuk kasus ini, balas normal di chat.`
}

const VARIANTS: Record<ModelFamily, PromptVariant> = {
  claude: { canvasBlock: claudeCanvasBlock },
  gemini: { canvasBlock: forcefulCanvasBlock },
  openai: { canvasBlock: forcefulCanvasBlock },
  default: { canvasBlock: forcefulCanvasBlock },
}

export function getPromptVariant(
  modelId: string | null | undefined,
): PromptVariant {
  return VARIANTS[getModelFamily(modelId)]
}
