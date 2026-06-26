import { useUsagePageController } from './model'
import { UsagePageView } from './ui/usage-page-view'

export default function UsagePage(): React.JSX.Element {
  const controller = useUsagePageController()
  return <UsagePageView controller={controller} />
}
