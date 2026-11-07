/**
 * A tiny stand-in for the supabase-js query builder. Every chained call is recorded; awaiting the builder
 * (or calling .single()/.maybeSingle()/.returns()) resolves to whatever `handler` returns for that call.
 * It does NOT interpret filters: tests assert on which filters were requested, and the real SQL is covered
 * by scripts/db-integration.
 */
export type Result = { data?: unknown; error?: { message: string; code?: string } | null; count?: number | null }
export type Op = [method: string, args: unknown[]]
export type Call = { kind: "from" | "rpc"; name: string; args?: unknown; ops: Op[] }
export type Handler = (call: Call) => Result | Promise<Result>

export const has = (call: Call, method: string, ...args: unknown[]) =>
  call.ops.some(([m, a]) => m === method && args.every((x, i) => JSON.stringify(a[i]) === JSON.stringify(x)))

export function fakeSupabase(handler: Handler, user: { id: string } | null = null) {
  const calls: Call[] = []
  const builder = (call: Call) => {
    calls.push(call)
    const b: Record<string, unknown> = {
      then: (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(handler(call)).then((r) => ({ data: null, error: null, ...r })).then(resolve, reject),
    }
    // each builder chains to ITSELF (a shared "latest builder" broke chaining after another query was started)
    const self: unknown = new Proxy(b, {
      get(target, prop: string) {
        if (prop in target) return target[prop]
        return (...args: unknown[]) => {
          call.ops.push([prop, args])
          return self
        }
      },
    })
    return self as never
  }
  const make = (call: Call) => builder(call)
  return {
    calls,
    client: {
      from: (name: string) => make({ kind: "from", name, ops: [] }),
      rpc: (name: string, args?: unknown) => make({ kind: "rpc", name, args, ops: [] }),
      auth: { getUser: async () => ({ data: { user } }) },
    },
  }
}
