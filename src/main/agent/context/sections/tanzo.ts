import type { ContextSection } from '../section'

const TANZO_INSTRUCTIONS_PREAMBLE = `These are binding Tanzo workspace instructions loaded from instruction files.
They apply to every step of this run.
Follow them unless a higher-priority system or developer instruction conflicts.
If the user request conflicts with these instructions, preserve these instructions and explain the conflict briefly.`

export interface TanzoInstructionsReader {
  read: (cwd: string) => string | null
}

export function createTanzoSection(reader: TanzoInstructionsReader): ContextSection {
  return {
    id: 'tanzo',
    stability: 'stable',
    channel: 'system',
    order: 20,
    render: ({ cwd }) => {
      const content = reader.read(cwd)?.trim()
      if (!content) return null
      return [
        '<tanzo-instructions priority="binding">',
        TANZO_INSTRUCTIONS_PREAMBLE,
        '',
        content,
        '</tanzo-instructions>'
      ].join('\n')
    }
  }
}
