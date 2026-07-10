interface OpenDialogOptions {
  defaultPath?: string
  directory?: boolean
  multiple?: boolean
  title?: string
}

export async function open(_options?: OpenDialogOptions): Promise<null> {
  void _options
  return null
}
