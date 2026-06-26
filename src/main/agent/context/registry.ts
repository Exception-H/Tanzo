import type { ContextSection } from './section'
import { roleSection } from './sections/role'
import { envSection } from './sections/env'
import { createDatetimeSection, type ClockDeps } from './sections/datetime'
import { createTanzoSection, type TanzoInstructionsReader } from './sections/tanzo'
import { createSkillsIndexSection, type SkillIndexReader } from './sections/skills-index'
import { createGitStatusSection, type GitStatusReader } from './sections/git-status'
import { createGoalSection, type GoalSectionReader } from './sections/goal'
import { createPlanModeSection, type PlanModeSectionReader } from './sections/plan-mode'

export interface SectionDeps {
  clock: ClockDeps
  tanzoInstructions: TanzoInstructionsReader
  skillsIndex: SkillIndexReader
  gitStatus: GitStatusReader
  goal: GoalSectionReader
  policyMode: PlanModeSectionReader
}

export function createSectionRegistry(deps: SectionDeps): ContextSection[] {
  return [
    roleSection,
    createPlanModeSection(deps.policyMode),
    createTanzoSection(deps.tanzoInstructions),
    createSkillsIndexSection(deps.skillsIndex),
    envSection,
    createDatetimeSection(deps.clock),
    createGitStatusSection(deps.gitStatus),
    createGoalSection(deps.goal)
  ]
}
