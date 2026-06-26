import type { ContextSection } from '../section'

export const roleSection: ContextSection = {
  id: 'role',
  stability: 'stable',
  channel: 'system',
  order: 0,
  render: ({ def }) => {
    const prompt = def.systemPrompt?.trim()
    return prompt ? prompt : null
  }
}
