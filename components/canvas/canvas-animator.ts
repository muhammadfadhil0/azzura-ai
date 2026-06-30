function longestCommonPrefix(a: string, b: string): number {
  const len = Math.min(a.length, b.length)
  let i = 0
  while (i < len && a.charCodeAt(i) === b.charCodeAt(i)) i++
  return i
}

function step(remaining: number): number {
  return Math.max(4, Math.ceil(remaining / 10))
}

export class CanvasAnimator {
  private rafId = 0
  private displayed = ''
  private target = ''
  private commonLen = 0
  private phase: 'idle' | 'deleting' | 'typing' = 'idle'

  constructor(
    private readonly onTick: (s: string) => void,
    private readonly onDone: () => void,
  ) {}

  get isAnimating(): boolean {
    return this.phase !== 'idle'
  }

  animateTo(current: string, next: string): void {
    this.cancel()
    this.displayed = current
    this.target = next
    this.commonLen = longestCommonPrefix(current, next)
    if (current === next) {
      this.onTick(next)
      this.onDone()
      return
    }
    this.phase =
      this.displayed.length > this.commonLen ? 'deleting' : 'typing'
    this.rafId = requestAnimationFrame(this.tick)
  }

  cancel(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.rafId = 0
    this.phase = 'idle'
  }

  private tick = (): void => {
    if (this.phase === 'deleting') {
      const remaining = this.displayed.length - this.commonLen
      const remove = step(remaining)
      const nextLen = Math.max(this.commonLen, this.displayed.length - remove)
      this.displayed = this.displayed.slice(0, nextLen)
      this.onTick(this.displayed)
      if (this.displayed.length === this.commonLen) this.phase = 'typing'
    } else if (this.phase === 'typing') {
      const remaining = this.target.length - this.displayed.length
      const add = step(remaining)
      const nextLen = Math.min(this.target.length, this.displayed.length + add)
      this.displayed = this.target.slice(0, nextLen)
      this.onTick(this.displayed)
      if (this.displayed.length === this.target.length) {
        this.phase = 'idle'
        this.onDone()
        return
      }
    }
    this.rafId = requestAnimationFrame(this.tick)
  }
}
