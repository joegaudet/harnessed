/**
 * The test id of the node `harnessed()` adds once a story has rendered and its
 * play function has finished. `StoryPage` waits for it: Storybook's own
 * "rendered" signal is a channel event, which a runner outside the iframe's
 * realm cannot listen for, while a node is something every driver can count.
 */
export const STORY_READY_TEST_ID = 'harnessed-story-ready'

/** Set on that node when the play function threw, holding the error's message. */
export const PLAY_ERROR_ATTRIBUTE = 'data-harnessed-play-error'
