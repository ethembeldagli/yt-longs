const YOUTUBE = /^https:\/\/www\.youtube\.com\//;

chrome.action.onClicked.addListener(async (tab) => {
  if (!YOUTUBE.test(tab.url || '')) {
    // Not on YouTube: open it and start Longs as soon as the page has videos.
    chrome.tabs.create({ url: 'https://www.youtube.com/#yt-longs' });
    return;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'yt-longs:toggle' });
  } catch {
    // The tab was open before the extension was installed or reloaded, so it has no content script yet.
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/bridge.js'], world: 'MAIN' });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/content.js'] });
    await chrome.tabs.sendMessage(tab.id, { type: 'yt-longs:toggle' });
  }
});
