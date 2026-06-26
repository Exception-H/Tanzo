import type { InstallSkillInput, SkillDetail, SkillScope, SkillSnapshot } from '@shared/skills'

export interface ResolvedSkill {
  name: string
  description: string
  skillDir: string
  body: string
  allowedTools: string[] | null
  scope: SkillScope
  modelRef?: string
  license?: string
  compatibility?: string
  metadata?: Record<string, string>
}

export interface SkillsStore {
  list(): ResolvedSkill[]
  get(name: string): ResolvedSkill | undefined
  listEnabled(): ResolvedSkill[]
  snapshot(): SkillSnapshot
  detail(name: string): SkillDetail | null
  setEnabled(name: string, enabled: boolean): SkillSnapshot
  install(input: InstallSkillInput): SkillSnapshot
  uninstall(name: string): SkillSnapshot
  reload(): SkillSnapshot
}
