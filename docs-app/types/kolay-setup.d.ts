// `kolay/setup` is a virtual module written by Kolay's Vite plugin, so it ships no types.
declare module 'kolay/setup' {
  import type { Manifest, SetupOptions } from 'kolay'

  export function setupKolay(context: object, options?: Partial<SetupOptions>): Promise<Manifest>
}
