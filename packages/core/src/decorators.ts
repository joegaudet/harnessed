import type { ComponentHarness, ComponentHarnessConstructor } from './component-harness'
import type { HarnessHost } from './harness-host'
import type { HarnessOptions } from './host-meta'
import { setHostMeta } from './host-meta'
import type { Query } from './query'
import { createQuery } from './registry'
import { label, placeholder, role, testId, text } from './selector'
import type { RoleOptions, Selector } from './selector'

/** `{ global: true }` bypasses the host scope — for portals and overlays that
 *  render outside the component's own subtree. */
export interface ElementOptions {
  global?: boolean
}

/**
 * Declares a harness's host element.
 *
 * ```ts
 * @Harness({ host: testId('login-form') })
 * export class LoginFormHarness extends ComponentHarness { }
 * ```
 *
 * An abstract base may go undecorated and let each subclass supply its own host;
 * resolution walks the prototype chain and the nearest decorator wins.
 */
export function Harness(options: HarnessOptions) {
  return function decorate<T extends abstract new (...args: never[]) => unknown>(
    target: T,
    _context: ClassDecoratorContext,
  ): T {
    setHostMeta(target, options)
    return target
  }
}

function elementDecorator(selector: Selector, isGlobal: boolean) {
  return function decorate<This extends HarnessHost>(
    _target: ClassAccessorDecoratorTarget<This, Query>,
    _context: ClassAccessorDecoratorContext<This, Query>,
  ): ClassAccessorDecoratorResult<This, Query> {
    return {
      get(this: This): Query {
        // A fresh query on every access: nothing is cached, so a field declared
        // before the component rendered still resolves once it has.
        return createQuery(this._env, isGlobal ? [] : this._scope, selector)
      },
    }
  }
}

/** Highest-priority locator. Use it unless the accessible name is unstable or absent. */
export function ByRole(name: string, options?: RoleOptions & ElementOptions) {
  const { global: isGlobal = false, ...roleOptions } = options ?? {}
  const hasRoleOptions = Object.keys(roleOptions).length > 0
  return elementDecorator(role(name, hasRoleOptions ? roleOptions : undefined), isGlobal)
}

export function ByTestId(id: string | RegExp, options?: ElementOptions) {
  return elementDecorator(testId(id), options?.global ?? false)
}

export function ByLabel(value: string | RegExp, options?: ElementOptions) {
  return elementDecorator(label(value), options?.global ?? false)
}

export function ByText(value: string | RegExp, options?: ElementOptions) {
  return elementDecorator(text(value), options?.global ?? false)
}

export function ByPlaceholder(value: string | RegExp, options?: ElementOptions) {
  return elementDecorator(placeholder(value), options?.global ?? false)
}

/** A nested harness, inheriting the host's scope chain. */
export function ChildHarness<T extends ComponentHarness>(
  HarnessClass: ComponentHarnessConstructor<T>,
) {
  return function decorate<This extends HarnessHost>(
    _target: ClassAccessorDecoratorTarget<This, T>,
    _context: ClassAccessorDecoratorContext<This, T>,
  ): ClassAccessorDecoratorResult<This, T> {
    return {
      get(this: This): T {
        return new HarnessClass(this._env, this._scope)
      },
    }
  }
}
