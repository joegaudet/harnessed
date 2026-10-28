// tsc reads no .vue files; the Vue plugin compiles them for the dev server, and
// test-app-vue type-checks them with vue-tsc.
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent
  export default component
}
