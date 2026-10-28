import { GlobalRegistrator } from '@happy-dom/global-registrator'

// Bun's documented way to give `bun test` a DOM. Testing Library reads
// `document` when it is imported, so this runs as the first preload.
GlobalRegistrator.register({
  url: 'http://localhost/',
  // happy-dom loads no frame documents by default, not even about:blank;
  // the fixture renders into a same-origin frame, as an app might.
  settings: { enableIframePageLoading: true },
})
