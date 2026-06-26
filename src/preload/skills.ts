import { SKILL_CHANNELS, type SkillApi } from '@shared/skills'
import { invoke } from './invoke'

export const skillsApi: SkillApi = {
  listSkills: invoke<SkillApi['listSkills']>(SKILL_CHANNELS.list),
  getSkill: invoke<SkillApi['getSkill']>(SKILL_CHANNELS.get),
  setSkillEnabled: invoke<SkillApi['setSkillEnabled']>(SKILL_CHANNELS.setEnabled),
  installSkill: invoke<SkillApi['installSkill']>(SKILL_CHANNELS.install),
  uninstallSkill: invoke<SkillApi['uninstallSkill']>(SKILL_CHANNELS.uninstall),
  reloadSkills: invoke<SkillApi['reloadSkills']>(SKILL_CHANNELS.reload)
}

export type SkillsPreloadApi = typeof skillsApi
