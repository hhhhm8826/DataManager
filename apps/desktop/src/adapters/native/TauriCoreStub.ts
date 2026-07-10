export async function invoke<T>(
  _command: string,
  _arguments?: Record<string, unknown>
): Promise<T> {
  void _command
  void _arguments
  throw new Error('Tauri command invoked in browser verification mode.')
}
