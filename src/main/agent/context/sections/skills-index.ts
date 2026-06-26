import type { ContextSection } from '../section'

export interface SkillIndexEntry {
  name: string
  description: string
}

export interface SkillIndexReader {
  list: () => SkillIndexEntry[]
}

export function createSkillsIndexSection(reader: SkillIndexReader): ContextSection {
  return {
    id: 'skills-index',
    stability: 'stable',
    channel: 'system',
    order: 30,
    render: () => {
      const skills = reader.list()
      if (skills.length === 0) return null
      const lines = skills.map((s) => `- ${s.name}: ${s.description}`)
      return [
        '<skills>',
        'Skills are specialized workflows you load with the `skill` tool when a task matches one. Load only skills listed here, by exact name — never guess a name.',
        ...lines,
        '</skills>'
      ].join('\n')
    }
  }
}
