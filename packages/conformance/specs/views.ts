import type { View } from './catalog'

/**
 * One place both runners agree on how a view is addressed, so the dom run and the
 * playwright run are looking at the same markup.
 */
export function viewSearch(view: View): string {
  switch (view) {
    case 'login':
      return '?view=login'
    case 'login-error':
      return `?view=login&error=${encodeURIComponent('Bad credentials')}`
    case 'login-late-duplicates':
      return '?view=login&late=1'
    case 'cards':
      return '?view=cards'
    case 'dialog':
      return '?view=dialog'
    case 'wizard':
      return '?view=wizard'
  }
}
