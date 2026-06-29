import type { Conversation, DateBucket } from '@/types/chat'

const BUCKETS: DateBucket[] = [
  'Today',
  'Yesterday',
  'Previous 7 Days',
  'Previous 30 Days',
  'Older',
]

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function bucketFor(updatedAt: string, now: Date): DateBucket {
  const updated = new Date(updatedAt).getTime()
  const today = startOfDay(now)
  const day = 86_400_000
  if (updated >= today) return 'Today'
  if (updated >= today - day) return 'Yesterday'
  if (updated >= today - 7 * day) return 'Previous 7 Days'
  if (updated >= today - 30 * day) return 'Previous 30 Days'
  return 'Older'
}

export function bucketConversations(
  conversations: Conversation[],
  now: Date = new Date(),
): { bucket: DateBucket; items: Conversation[] }[] {
  const map = new Map<DateBucket, Conversation[]>()
  for (const b of BUCKETS) map.set(b, [])

  const sorted = [...conversations].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )

  for (const conv of sorted) {
    map.get(bucketFor(conv.updatedAt, now))!.push(conv)
  }

  return BUCKETS.map((bucket) => ({ bucket, items: map.get(bucket)! })).filter(
    (g) => g.items.length > 0,
  )
}
