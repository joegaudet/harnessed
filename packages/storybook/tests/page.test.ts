import { describe, expect, it } from 'vitest'
import { storyUrl } from '../src/page'

const stories = {
  default: { title: 'Forms/Login Form' },
  Default: {},
  WrongPassword: { args: { error: 'Bad credentials' } },
}

describe('storyUrl', () => {
  it('derives the id from the meta title and the export name', () => {
    expect(storyUrl(stories, 'WrongPassword')).toBe(
      '/iframe.html?id=forms-login-form--wrong-password&viewMode=story',
    )
  })

  it('prefers an explicit meta id', () => {
    expect(storyUrl({ default: { id: 'login', title: 'X' }, Default: {} }, 'Default')).toBe(
      '/iframe.html?id=login--default&viewMode=story',
    )
  })

  it('encodes args and globals in Storybook syntax', () => {
    expect(
      storyUrl(stories, 'Default', {
        args: { locked: true, email: 'ada' },
        globals: { theme: 'dark' },
      }),
    ).toBe(
      '/iframe.html?id=forms-login-form--default&viewMode=story&args=locked:!true;email:ada&globals=theme:dark',
    )
  })

  it('turns off play with embed=true, the switch Storybook itself reads', () => {
    expect(storyUrl(stories, 'Default', { play: false })).toBe(
      '/iframe.html?id=forms-login-form--default&viewMode=story&embed=true',
    )
  })

  it('refuses an arg value Storybook would silently drop from the URL', () => {
    expect(() => storyUrl(stories, 'Default', { args: { email: 'ada@example.com' } })).toThrow(
      /harnessed: arg `email` .*Storybook drops/s,
    )
  })

  it('refuses a string Storybook would turn into a number', () => {
    expect(() => storyUrl(stories, 'Default', { args: { zip: '02134' } })).toThrow(
      /harnessed: arg `zip` .*Storybook drops/s,
    )
  })

  it('passes plain decimal numbers through', () => {
    expect(storyUrl(stories, 'Default', { args: { count: -2, ratio: 0.5 } })).toBe(
      '/iframe.html?id=forms-login-form--default&viewMode=story&args=count:-2;ratio:0.5',
    )
  })

  it.each([NaN, Infinity, -Infinity, 1e21, 1e-7])(
    'refuses the number %s, which Storybook cannot read back from the URL',
    count => {
      expect(() => storyUrl(stories, 'Default', { args: { count } })).toThrow(
        new RegExp(
          `harnessed: arg \`count\` = ${String(count).replace('+', '\\+')} .*Storybook drops`,
          's',
        ),
      )
    },
  )

  it('refuses an arg name Storybook would drop, whatever its value', () => {
    expect(() => storyUrl(stories, 'Default', { args: { 'a&b': true } })).toThrow(
      /harnessed: arg `a&b`/,
    )
  })

  it('refuses a meta with neither title nor id, naming the fix', () => {
    expect(() => storyUrl({ default: {}, Default: {} }, 'Default')).toThrow(
      /harnessed: .*no `title`.*set `title` on the meta/s,
    )
  })
})
