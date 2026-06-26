import { useProvidersPageController } from './model'
import { ProvidersPageView } from './ui/providers-page-view'

export default function ProvidersPage(): React.JSX.Element {
  const controller = useProvidersPageController()
  return <ProvidersPageView controller={controller} />
}
