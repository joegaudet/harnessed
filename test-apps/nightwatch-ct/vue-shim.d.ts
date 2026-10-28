// The Vue stage and the Vue port's components are .vue files; tsc only needs
// to know they are components. The Vue port type-checks them itself (vue-tsc).
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent
  export default component
}
