import { ByLabel, ByRole, ByTestId, ComponentHarness, Harness, testId } from '@harnessed-ts/core'
import type { Query, WaitOptions } from '@harnessed-ts/core'

/**
 * The data screen's harness. Every read that depends on a response waits for the
 * element that response renders, so a spec never races the network — and a
 * mocked delay or hang is observable as an element that is not there yet.
 */
@Harness({ host: testId('data-screen') })
export class DataScreenHarness extends ComponentHarness {
  @ByTestId('user-loading') private accessor userLoading!: Query
  @ByTestId('user-name') private accessor userNameLine!: Query
  @ByTestId('user-error') private accessor userErrorLine!: Query
  @ByRole('button', { name: 'Reload user' }) private accessor reloadButton!: Query

  @ByRole('button', { name: 'Load todos' }) private accessor todosButton!: Query
  @ByTestId('todos') private accessor todoList!: Query
  @ByTestId('todo') private accessor todoItem!: Query
  @ByTestId('todos-error') private accessor todosErrorLine!: Query

  @ByLabel('Query') private accessor queryInput!: Query
  @ByRole('button', { name: 'Search' }) private accessor searchButton!: Query
  @ByTestId('search-result') private accessor searchResultLine!: Query
  @ByTestId('search-error') private accessor searchErrorLine!: Query

  @ByRole('button', { name: 'Load profile' }) private accessor profileButton!: Query
  @ByTestId('profile-handle') private accessor profileHandleLine!: Query
  @ByTestId('profile-error') private accessor profileErrorLine!: Query

  @ByRole('button', { name: 'Open feed' }) private accessor feedButton!: Query
  @ByTestId('feed-event') private accessor feedEvent!: Query
  @ByTestId('feed-done') private accessor feedDoneLine!: Query

  @ByRole('button', { name: 'Connect' }) private accessor connectButton!: Query
  @ByRole('button', { name: 'Send ping' }) private accessor pingButton!: Query
  @ByTestId('socket-open') private accessor socketOpenLine!: Query
  @ByTestId('socket-message') private accessor socketMessage!: Query

  async userName(options?: WaitOptions): Promise<string> {
    await this.userNameLine.waitFor('visible', options)
    return this.userNameLine.text()
  }

  async userError(options?: WaitOptions): Promise<string> {
    await this.userErrorLine.waitFor('visible', options)
    return this.userErrorLine.text()
  }

  /** Immediate: whether the user request is still in flight. */
  async isUserLoading(): Promise<boolean> {
    return !(await this.userLoading.isAbsent())
  }

  async reloadUser(): Promise<void> {
    await this.reloadButton.click()
  }

  async loadTodos(): Promise<void> {
    await this.todosButton.click()
  }

  async todoTitles(): Promise<string[]> {
    await this.todoList.waitFor('visible')
    return this.todoItem.texts()
  }

  async todosError(): Promise<string> {
    await this.todosErrorLine.waitFor('visible')
    return this.todosErrorLine.text()
  }

  async search(query: string): Promise<void> {
    await this.queryInput.fill(query)
    await this.searchButton.click()
  }

  async searchResult(): Promise<string> {
    await this.searchResultLine.waitFor('visible')
    return this.searchResultLine.text()
  }

  async searchError(): Promise<string> {
    await this.searchErrorLine.waitFor('visible')
    return this.searchErrorLine.text()
  }

  async loadProfile(): Promise<void> {
    await this.profileButton.click()
  }

  async profileHandle(): Promise<string> {
    await this.profileHandleLine.waitFor('visible')
    return this.profileHandleLine.text()
  }

  async profileError(): Promise<string> {
    await this.profileErrorLine.waitFor('visible')
    return this.profileErrorLine.text()
  }

  async openFeed(): Promise<void> {
    await this.feedButton.click()
  }

  /** Waits for the first event, then reads how many have arrived so far. */
  async firstFeedEvent(): Promise<string> {
    await this.feedEvent.nth(0).waitFor('visible')
    return this.feedEvent.nth(0).text()
  }

  async feedEventCount(): Promise<number> {
    return this.feedEvent.count()
  }

  /** Waits for the stream to end, then reads every event. */
  async feedEvents(): Promise<string[]> {
    await this.feedDoneLine.waitFor('visible')
    return this.feedEvent.texts()
  }

  async connectSocket(): Promise<void> {
    await this.connectButton.click()
    await this.socketOpenLine.waitFor('visible')
  }

  async sendPing(): Promise<void> {
    await this.pingButton.click()
  }

  /** Waits until `count` messages have arrived, then reads them all. */
  async socketMessages(count: number): Promise<string[]> {
    await this.socketMessage.nth(count - 1).waitFor('visible')
    return this.socketMessage.texts()
  }
}
