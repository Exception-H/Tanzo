import { useSkillsPageController } from './model'
import { SkillsPageView } from './ui/skills-page-view'

export default function SkillsPage(): React.ReactElement {
  const controller = useSkillsPageController()
  return <SkillsPageView controller={controller} />
}
