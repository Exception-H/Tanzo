export class HeadTailBuffer {
  private head = ''
  private tail = ''
  private dropped = 0
  private readonly half: number

  constructor(max: number) {
    this.half = Math.max(1, Math.floor(max / 2))
  }

  push(chunk: string): void {
    if (!chunk) return
    let rest = chunk
    if (this.head.length < this.half) {
      const room = this.half - this.head.length
      this.head += rest.slice(0, room)
      rest = rest.slice(room)
    }
    if (!rest) return
    this.tail += rest
    if (this.tail.length > this.half) {
      this.dropped += this.tail.length - this.half
      this.tail = this.tail.slice(this.tail.length - this.half)
    }
  }

  toString(): string {
    if (this.dropped === 0) return this.head + this.tail
    return `${this.head}\n…<${this.dropped} chars truncated>…\n${this.tail}`
  }
}

export function truncateHead(text: string, max: number): { text: string; truncated: boolean } {
  if (text.length <= max) return { text, truncated: false }
  return { text: text.slice(0, max), truncated: true }
}
