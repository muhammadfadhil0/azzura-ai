import type { Message } from '@/types/chat'

/**
 * Walk from `leafId` up via `parentId` and return messages in root→leaf order.
 */
export function buildActivePath(
  messages: Message[],
  leafId: string | null,
): Message[] {
  if (!leafId) return []
  const byId = new Map(messages.map((m) => [m.id, m]))
  const path: Message[] = []
  let curr: string | null = leafId
  while (curr) {
    const m = byId.get(curr)
    if (!m) break
    path.unshift(m)
    curr = m.parentId ?? null
  }
  return path
}

/**
 * Siblings of `target` are messages with the same `parentId` and same `role`.
 * Sorted by createdAt ascending so index 0 = original, last = most recent.
 */
export function getSiblings(messages: Message[], target: Message): Message[] {
  return messages
    .filter((m) => m.parentId === target.parentId && m.role === target.role)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/**
 * From `rootId`, walk down picking the most-recently-created child at each
 * level until reaching a leaf (no children). Returns the leaf id. If `rootId`
 * is already a leaf, returns it unchanged.
 */
export function latestLeafInSubtree(
  messages: Message[],
  rootId: string,
): string {
  const byParent = new Map<string, Message[]>()
  for (const m of messages) {
    if (!m.parentId) continue
    const arr = byParent.get(m.parentId) ?? []
    arr.push(m)
    byParent.set(m.parentId, arr)
  }
  let curr = rootId
  while (true) {
    const children = byParent.get(curr) ?? []
    if (children.length === 0) return curr
    children.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    curr = children[0].id
  }
}
