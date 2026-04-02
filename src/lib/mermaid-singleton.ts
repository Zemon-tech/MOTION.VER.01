/**
 * Module-level singleton for mermaid.
 * Guarantees initialize() is called exactly once regardless of how many
 * MermaidNode components mount simultaneously.
 */

type MermaidModule = typeof import("mermaid")["default"]

let instance: MermaidModule | null = null
// Single shared promise — all concurrent callers await the same one.
let initPromise: Promise<MermaidModule> | null = null

export function getMermaid(): MermaidModule | null {
  return instance
}

export function ensureMermaid(): Promise<MermaidModule> {
  if (instance) return Promise.resolve(instance)
  if (initPromise) return initPromise

  initPromise = (async () => {
    const mod = await import("mermaid")
    const m = (mod as any).default ?? mod as unknown as MermaidModule
    m.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme:
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "default",
    })
    instance = m
    return m
  })()

  return initPromise
}
