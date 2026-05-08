declare global {
  // eslint-disable-next-line no-var
  var __pendingToolResults: Map<string, (result: unknown) => void> | undefined
}

// Use global to survive Next.js per-bundle module isolation in development
const pending: Map<string, (result: unknown) => void> =
  globalThis.__pendingToolResults ??
  (globalThis.__pendingToolResults = new Map())

export function registerPending(toolCallId: string): Promise<unknown> {
  return new Promise(resolve => {
    pending.set(toolCallId, resolve)
  })
}

export function resolvePending(toolCallId: string, result: unknown): boolean {
  const resolve = pending.get(toolCallId)
  if (!resolve) return false
  pending.delete(toolCallId)
  resolve(result)
  return true
}
