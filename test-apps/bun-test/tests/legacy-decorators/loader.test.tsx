import { dom } from '@harnessed-ts/dom'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'bun:test'
import { SearchHarness } from './search.harness'

it('a harness under an experimentalDecorators tsconfig keeps the standard decorator protocol', async () => {
  const { baseElement } = render(
    <div data-testid="search">
      <input type="search" aria-label="Search" />
    </div>,
  )
  const search = new SearchHarness(
    dom({ user: userEvent.setup({ document }), container: baseElement }),
  )
  await search.search('harness')
  expect(await search.box.inputValue()).toBe('harness')
})
