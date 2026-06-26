import type { ServerTemplate } from '@/common/contracts'

export const SERVER_TEMPLATES: readonly ServerTemplate[] = [
  {
    id: 'filesystem',
    name: 'File System',
    description: 'Access local file system',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', './']
  },
  {
    id: 'chrome-devtools',
    name: 'Chrome DevTools',
    description: 'Browser automation via Chrome DevTools Protocol',
    transport: 'stdio',
    command: 'npx',
    args: ['chrome-devtools-mcp@latest']
  },
  {
    id: 'everything',
    name: 'Everything',
    description: 'Reference server with prompts, resources, tools and completion support',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-everything'],
    github: 'https://github.com/modelcontextprotocol/servers/tree/main/src/everything'
  }
] as const
