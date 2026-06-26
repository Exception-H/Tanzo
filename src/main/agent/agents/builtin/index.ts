import { defFromMarkdown } from '../parse'
import type { AgentDefinition } from '../types'
import generalMd from './main/general.md?raw'
import exploreMd from './sub/explore.md?raw'
import verifyMd from './sub/verify.md?raw'
import reviewMd from './sub/review.md?raw'

export const BUILTIN_AGENTS: AgentDefinition[] = [
  defFromMarkdown(generalMd, 'tanzo', 'main'),
  defFromMarkdown(exploreMd, 'explore', 'subagent'),
  defFromMarkdown(verifyMd, 'verify', 'subagent'),
  defFromMarkdown(reviewMd, 'review', 'subagent')
]
