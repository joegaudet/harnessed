/** A module bundled into one script and imported as its text; see tsup.config.ts. */
declare module '*?bundle' {
  const code: string
  export default code
}
