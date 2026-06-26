import type { ToolSet } from 'ai'
import type { AgentDefinition } from '../agents/types'

export function providerTools(_def: AgentDefinition): ToolSet {
  void _def
  return {}
}
