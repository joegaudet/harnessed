import { modifier } from 'ember-modifier'
import { createElement, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'

/**
 * Mounts a React component into the element, so a guide example can show the React
 * fixture next to its Ember twin. The root unmounts when Ember tears the element down.
 */
export const reactIsland = modifier(
  <P extends object>(element: Element, [Component, props]: [ComponentType<P>, P?]) => {
    const root = createRoot(element)
    // Synchronous, so the harness finds the DOM as soon as Ember's render settles.
    flushSync(() => root.render(createElement(Component, props ?? ({} as P))))
    return () => root.unmount()
  },
)
