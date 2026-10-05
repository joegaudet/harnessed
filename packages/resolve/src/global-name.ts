/**
 * Where the injected build installs itself on the page's `window`. A leaf
 * module with no imports, so the Node-side `inject` entry can name it without
 * pulling in the resolver and Testing Library, which only run in the page.
 */
export const PAGE_API_GLOBAL = '__harnessedResolve'
