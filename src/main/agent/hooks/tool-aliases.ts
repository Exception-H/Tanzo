const TOOL_ALIASES: Record<string, readonly string[]> = {
  shell: ['Bash'],
  shellStart: ['Bash'],
  shellWrite: ['Bash'],
  fileEdit: ['Edit'],
  multiEdit: ['MultiEdit', 'Edit'],
  fileWrite: ['Write'],
  fileRead: ['Read'],
  Glob: ['Glob'],
  Grep: ['Grep']
}

export function matchNamesForTool(toolName: string): string[] {
  const aliases = TOOL_ALIASES[toolName] ?? []
  return [toolName, ...aliases]
}
