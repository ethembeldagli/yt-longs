const YOUTUBE = /^https:\/\/www\.youtube\.com\//;

browser.action.onClicked.addListener(async (tab) => {
  if (!YOUTUBE.test(tab.url || '')) {
    // Not on YouTube: open it and start Longs as soon as the page has videos.
    browser.tabs.create({ url: 'https://www.youtube.com/#yt-longs' });
    return;
  }
  try {
    await browser.tabs.sendMessage(tab.id, { type: 'yt-longs:toggle' });
  } catch {
    // The tab was open before the extension was installed or reloaded, so it has no content script yet.
    await browser.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/bridge.js'], world: 'MAIN' });
    await browser.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/content.js'] });
    await browser.tabs.sendMessage(tab.id, { type: 'yt-longs:toggle' });
  }
});
