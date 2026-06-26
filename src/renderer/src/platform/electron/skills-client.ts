import type {
  InstallSkillInput,
  SetSkillEnabledInput,
  SkillApi,
  SkillDetail,
  SkillSnapshot
} from '@shared/skills'
import { TanzoIntegrationError } from '@shared/errors'
import { withDecodedIpcErrors } from './ipc-errors'

function requireSkillsApi(): SkillApi {
  const skillsApi = window.electron?.skills
  if (!skillsApi) {
    throw new TanzoIntegrationError(
      'ELECTRON_SKILLS_API_UNAVAILABLE',
      'Electron skills API is not available'
    )
  }
  return withDecodedIpcErrors(skillsApi)
}

export const skillsClient = {
  listSkills(): Promise<SkillSnapshot> {
    return requireSkillsApi().listSkills()
  },
  getSkill(name: string): Promise<SkillDetail | null> {
    return requireSkillsApi().getSkill(name)
  },
  setSkillEnabled(input: SetSkillEnabledInput): Promise<SkillSnapshot> {
    return requireSkillsApi().setSkillEnabled(input)
  },
  installSkill(input: InstallSkillInput): Promise<SkillSnapshot> {
    return requireSkillsApi().installSkill(input)
  },
  uninstallSkill(name: string): Promise<SkillSnapshot> {
    return requireSkillsApi().uninstallSkill(name)
  },
  reloadSkills(): Promise<SkillSnapshot> {
    return requireSkillsApi().reloadSkills()
  }
}
