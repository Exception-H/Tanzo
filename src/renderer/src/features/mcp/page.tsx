import { useMcpPageController } from './model'
import { McpPageView } from './ui/mcp-page-view'

export default function McpPage() {
  const controller = useMcpPageController()
  return <McpPageView controller={controller} />
}
