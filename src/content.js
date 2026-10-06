// YT Longs: scroll the normal videos YouTube recommends to you, one at a time, the way Shorts work.
//
// Videos come from your Home feed (the same recommendations, fetched with your YouTube session)
// and keep coming through the feed's "load more" continuation. Playback uses YouTube's real
// player: each video is opened as a normal watch page underneath (through YouTube's own in-page
// navigation, see bridge.js), the rest of that page is hidden, and the player is placed inside a
// Shorts-style layout drawn on top. YouTube doesn't allow its embeddable player on youtube.com.
(() => {
  // After an extension reload, an orphaned copy of this script may still own the old UI.
  document.getElementById('yt-longs')?.remove();
  document.getElementById('yt-longs-page-style')?.remove();
  document.querySelectorAll('.yt-longs-guide-entry').forEach((el) => el.remove());

  const ORIGIN = 'https://www.youtube.com';
  const CSS_URL = chrome.runtime.getURL('src/overlay.css');
  const ID_RE = /^[\w-]{11}$/;
  const LOAD_MORE_AT = 6; // fetch more recommendations when this few are left
  const SLIDE_MS = 400; // keep in sync with .track transition in overlay.css
  const SKIP_DOM = [
    'ytd-ad-slot-renderer', 'ytd-in-feed-ad-layout-renderer', 'ytd-promoted-video-renderer',
    'ytd-miniplayer', '#movie_player', 'ytd-comments', '#description',
  ].join(',');
  const html = document.documentElement;

  // ---------- Icons (Material Symbols) ----------

  const PATHS = {
    play: 'M8 5v14l11-7z',
    pause: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
    vol: 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z',
    mute: 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z',
    more: 'M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
    fs: 'M21 11V3h-8l3.29 3.29-10 10L3 13v8h8l-3.29-3.29 10-10z',
    fsExit: 'M22 3.41 16.71 8.7 20 12h-8V4l3.29 3.29L20.59 2 22 3.41zM3.41 22l5.29-5.29L12 20v-8H4l3.29 3.29L2 20.59 3.41 22z',
    cc: 'M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z',
    settings: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
    heart: 'M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z',
    heartFill: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
    comment: 'M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM20 4v13.17L18.83 16H4V4h16zM6 12h12v2H6zm0-3h12v2H6zm0-3h12v2H6z',
    share: 'M21 11l-6-6v5H8c-2.76 0-5 2.24-5 5v4h2v-4c0-1.65 1.35-3 3-3h7v5l6-6z',
    watch: 'M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z',
    link: 'M3.9 12a3.1 3.1 0 0 1 3.1-3.1h4V7H7a5 5 0 0 0 0 10h4v-1.9H7A3.1 3.1 0 0 1 3.9 12zM8 13h8v-2H8v2zm9-6h-4v1.9h4a3.1 3.1 0 1 1 0 6.2h-4V17h4a5 5 0 0 0 0-10z',
    autoplay: 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z',
    close: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
    up: 'M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z',
    down: 'M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z',
    thumb: 'M9 21h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.58 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2zM9 9l4.34-4.34L12 10h9v2l-3 7H9V9zM1 9h4v12H1z',
    longs: 'M6 2h12v1.6H6zm0 18.4h12V22H6zM20 5H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 12H4V7h16v10zM10 9.5v5l4.5-2.5z',
  };
  const icon = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${PATHS[name]}"/></svg>`;

  // ---------- State ----------

  const queue = []; // [{ id, title, channel, channelUrl, avatar, details }]
  const seen = new Set();
  const relatedTried = new Set();
  const slides = new Map(); // queue index -> slide element
  const feed = { token: null, refetchesLeft: 3, initial: null };
  let index = 0;
  let isOpen = false;
  let direction = 1;
  let moving = false;
  let loadingMore = null;
  let waitingForMore = false;
  let settings = { autoNext: true };

  // What YouTube's player reports (see bridge.js), and the video we asked it to show.
  const player = {
    id: null, state: -1, time: 0, timeAt: 0, duration: 0, volume: 100, muted: false, ad: false, error: false, storyboard: null,
  };
  let target = null;
  let ownNavigation = false;
  let ownNavigationTimer = 0;
  let traversal = null; // the last Back/Forward: { id, longs, at }
  let longsFirstEntry = -1; // index (navigation.entries()) of this Longs session's first history entry
  let exitingTo = null; // key of the history entry Back is skipping to
  let autonavWasOn = false;
  let loadTimer = 0;
  let stallTimer = 0;
  let toastTimer = 0;
  let uiTimer = 0;
  let resizeTimer = 0;
  let nativeMenuAt = 0;

  chrome.storage.local.get({ autoNext: true }).then((stored) => { settings = stored; });

  // ---------- YouTube data helpers ----------

  const runsText = (t) => t?.simpleText ?? t?.runs?.map((r) => r.text).join('') ?? (typeof t?.content === 'string' ? t.content : '');

  function find(node, key) {
    if (!node || typeof node !== 'object') return undefined;
    if (!Array.isArray(node) && Object.hasOwn(node, key)) return node[key];
    for (const value of Object.values(node)) {
      const found = find(value, key);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  function findAll(node, key, out = []) {
    if (!node || typeof node !== 'object') return out;
    if (!Array.isArray(node) && Object.hasOwn(node, key)) out.push(node[key]);
    for (const value of Object.values(node)) findAll(value, key, out);
    return out;
  }

  // Parse the JSON object that starts at text[start] === '{'.
  function jsonAt(text, start) {
    let depth = 0;
    let inString = false;
    for (let i = start; i < text.length; i++) {
      const c = text[i];
      if (inString) {
        if (c === '\\') i++;
        else if (c === '"') inString = false;
      } else if (c === '"') {
        inString = true;
      } else if (c === '{') {
        depth++;
      } else if (c === '}' && --depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; }
      }
    }
    return null;
  }

  function jsonAfter(text, marker) {
    const at = text.indexOf(marker);
    if (at < 0) return null;
    const start = text.indexOf('{', at + marker.length);
    return start < 0 ? null : jsonAt(text, start);
  }

  function parseYtcfg(text) {
    const cfg = {};
    for (let at = text.indexOf('ytcfg.set({'); at !== -1; at = text.indexOf('ytcfg.set({', at + 10)) {
      const part = jsonAt(text, at + 10);
      if (part) Object.assign(cfg, part);
    }
    return cfg;
  }

  // YouTube's page config (API context, client version, sign-in state) from the page's own scripts.
  let ytcfg = null;
  function getConfig() {
    if (!ytcfg) {
      const cfg = {};
      for (const script of document.querySelectorAll('script:not([src])')) {
        if (script.textContent.includes('ytcfg.set({')) Object.assign(cfg, parseYtcfg(script.textContent));
      }
      if (cfg.INNERTUBE_CONTEXT) ytcfg = cfg;
    }
    return ytcfg;
  }

  const loggedIn = () => !!getConfig()?.LOGGED_IN;

  async function fetchPage(path) {
    const res = await fetch(path, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    const html = await res.text();
    if (!getConfig()) {
      const cfg = parseYtcfg(html);
      if (cfg.INNERTUBE_CONTEXT) ytcfg = cfg;
    }
    return jsonAfter(html, 'var ytInitialData = ') || jsonAfter(html, 'window["ytInitialData"] = ');
  }

  async function sha1(text) {
    const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // The same "SAPISIDHASH" authorization YouTube's own web client sends with API requests.
  async function authorization(cfg, withUser) {
    const cookies = Object.fromEntries(document.cookie.split('; ').map((c) => {
      const eq = c.indexOf('=');
      return [c.slice(0, eq), c.slice(eq + 1)];
    }));
    const sync = (cfg.DATASYNC_ID || '').split('||');
    const user = withUser ? cfg.USER_SESSION_ID || sync[1] || sync[0] || '' : '';
    const ts = Math.floor(Date.now() / 1000);
    const parts = [];
    for (const [cookie, scheme] of [['SAPISID', 'SAPISIDHASH'], ['__Secure-1PAPISID', 'SAPISID1PHASH'], ['__Secure-3PAPISID', 'SAPISID3PHASH']]) {
      const sid = cookies[cookie];
      if (!sid) continue;
      const hash = await sha1([...(user ? [user] : []), ts, sid, ORIGIN].join(' '));
      parts.push(`${scheme} ${ts}_${hash}${user ? '_u' : ''}`);
    }
    return parts.join(' ');
  }

  let authMode = null;
  async function innertube(endpoint, body, { write = false } = {}) {
    const cfg = getConfig();
    if (!cfg) throw new Error('YouTube config not found');
    let modes = ['user', 'plain'].sort((a, b) => (b === authMode) - (a === authMode));
    if (!loggedIn()) modes = [];
    if (!write || !modes.length) modes.push('none');
    let error;
    for (const mode of modes) {
      const headers = {
        'Content-Type': 'application/json',
        'X-Youtube-Client-Name': String(cfg.INNERTUBE_CONTEXT_CLIENT_NAME ?? 1),
        'X-Youtube-Client-Version': cfg.INNERTUBE_CLIENT_VERSION ?? cfg.INNERTUBE_CONTEXT?.client?.clientVersion ?? '',
        'X-Origin': ORIGIN,
      };
      if (cfg.VISITOR_DATA) headers['X-Goog-Visitor-Id'] = cfg.VISITOR_DATA;
      if (mode !== 'none') {
        headers.Authorization = await authorization(cfg, mode === 'user');
        headers['X-Goog-AuthUser'] = String(cfg.SESSION_INDEX ?? 0);
        if (cfg.DELEGATED_SESSION_ID) headers['X-Goog-PageId'] = cfg.DELEGATED_SESSION_ID;
      }
      const res = await fetch(`/youtubei/v1/${endpoint}?prettyPrint=false`, {
        method: 'POST',
        credentials: 'same-origin',
        headers,
        body: JSON.stringify({ context: cfg.INNERTUBE_CONTEXT, ...body }),
      });
      if (res.ok) {
        if (mode !== 'none') authMode = mode;
        return res.json();
      }
      error = new Error(`${endpoint}: HTTP ${res.status}`);
      if (res.status !== 401 && res.status !== 403) break;
    }
    throw error;
  }

  // ---------- Finding videos ----------

  const SKIP_KEYS = new Set([
    'adSlotRenderer', 'promotedVideoRenderer', 'reelShelfRenderer', 'reelItemRenderer', 'shortsLockupViewModel',
    'endScreenVideoRenderer', 'playerOverlays', 'feedFilterChipBarRenderer',
  ]);

  // A regular video from one renderer, null for one to drop (Shorts), undefined for "not a video".
  function videoFrom(key, v) {
    if ((key === 'videoRenderer' || key === 'compactVideoRenderer' || key === 'gridVideoRenderer') && v?.videoId) {
      if (v.navigationEndpoint?.reelWatchEndpoint) return null;
      const owner = v.longBylineText || v.shortBylineText || v.ownerText;
      return {
        id: v.videoId,
        title: runsText(v.title),
        channel: runsText(owner),
        channelUrl: find(owner, 'canonicalBaseUrl'),
        avatar: find(v.channelThumbnailSupportedRenderers ?? v.channelThumbnail, 'thumbnails')?.[0]?.url,
      };
    }
    if (key === 'lockupViewModel' && v?.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO' && v.contentId) {
      const meta = v.metadata?.lockupMetadataViewModel;
      return {
        id: v.contentId,
        title: meta?.title?.content,
        channel: meta?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text?.content,
        channelUrl: find(meta?.image, 'canonicalBaseUrl'),
        avatar: find(meta?.image, 'sources')?.[0]?.url,
      };
    }
    return undefined;
  }

  function videosFromData(node) {
    const out = [];
    const walk = (n) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { n.forEach(walk); return; }
      for (const [key, value] of Object.entries(n)) {
        if (SKIP_KEYS.has(key)) continue;
        const video = videoFrom(key, value);
        if (video === undefined) walk(value);
        else if (video) out.push(video);
      }
    };
    walk(node);
    return out;
  }

  function addVideos(list) {
    let added = 0;
    for (const v of list) {
      if (!v || !ID_RE.test(v.id) || seen.has(v.id)) continue;
      seen.add(v.id);
      queue.push({ id: v.id, title: v.title || '', channel: v.channel || '', channelUrl: v.channelUrl, avatar: v.avatar });
      added++;
    }
    return added;
  }

  // Videos already showing in the Home feed, in the order you see them.
  function collectFromPage() {
    const found = new Map();
    const scope = document.querySelector('ytd-page-manager') || document.body;
    for (const a of scope.querySelectorAll('a[href*="/watch?v="]')) {
      if (a.closest(SKIP_DOM) || !a.getClientRects().length) continue;
      let id;
      try { id = new URL(a.href, location.href).searchParams.get('v'); } catch { continue; }
      if (ID_RE.test(id || '') && !found.has(id)) found.set(id, { id, title: a.getAttribute('title') || '' });
    }
    return [...found.values()];
  }

  const gridToken = (items) => find(items?.at?.(-1)?.continuationItemRenderer, 'continuationCommand')?.token ?? null;

  async function loadHomePage() {
    const data = await fetchPage('/');
    const grid = find(data, 'richGridRenderer');
    feed.token = gridToken(grid?.contents);
    return videosFromData(grid?.contents ?? []);
  }

  async function loadMoreHome() {
    if (feed.token) {
      try {
        const res = await innertube('browse', { continuation: feed.token });
        // Signed in but answered as signed out: the API didn't accept our session, so these
        // aren't your recommendations. Fall back to reloading the Home page instead.
        const wrongAccount = loggedIn() && res.responseContext?.mainAppWebResponseContext?.loggedOut;
        const items = findAll(res, 'appendContinuationItemsAction').flatMap((a) => a.continuationItems ?? []);
        feed.token = wrongAccount ? null : gridToken(items);
        if (!wrongAccount && addVideos(videosFromData(items))) return true;
      } catch {
        feed.token = null;
      }
    }
    // YouTube reshuffles Home on every load, so a fresh copy brings new recommendations.
    while (feed.refetchesLeft > 0) {
      feed.refetchesLeft--;
      try { if (addVideos(await loadHomePage())) return true; } catch { /* try again */ }
    }
    return false;
  }

  // Last resort when Home runs dry (or you're signed out): videos related to what you're watching.
  async function loadRelated() {
    for (const item of [queue[index], ...queue.slice(-3).reverse()]) {
      if (!item || relatedTried.has(item.id)) continue;
      relatedTried.add(item.id);
      const details = await getDetails(item.id);
      if (details && addVideos(details.related)) return true;
    }
    return false;
  }

  function loadMore() {
    loadingMore ??= (async () => {
      await feed.initial; // the first Home fetch may still be on its way
      return (queue.length - index > LOAD_MORE_AT) || (await loadMoreHome()) || (await loadRelated());
    })()
      .catch(() => false)
      .finally(() => {
        loadingMore = null;
        if (isOpen) renderSlides();
      });
    return loadingMore;
  }

  // ---------- Per-video details (likes, channel, comments) ----------

  const detailCache = new Map();

  function getDetails(id) {
    if (!detailCache.has(id)) {
      const details = fetchPage(`/watch?v=${id}`)
        .then((data) => (data ? parseDetails(data) : null))
        .catch(() => null)
        .then((result) => {
          if (!result) detailCache.delete(id); // let a later look try again
          return result;
        });
      detailCache.set(id, details);
      while (detailCache.size > 40) detailCache.delete(detailCache.keys().next().value);
    }
    return detailCache.get(id);
  }

  function parseDetails(data) {
    const primary = find(data, 'videoPrimaryInfoRenderer');
    const owner = find(data, 'videoOwnerRenderer');
    const likeButton = find(data, 'likeButtonViewModel');
    const dislikeButton = find(data, 'dislikeButtonViewModel');
    const likeEndpoints = findAll(likeButton, 'likeEndpoint');
    const subscribeButton = find(data, 'subscribeButtonRenderer');
    const commentsPanel = findAll(data, 'engagementPanelSectionListRenderer')
      .find((p) => p.panelIdentifier === 'engagement-panel-comments-section' || p.targetId === 'engagement-panel-comments-section');
    const commentsSection = findAll(data, 'itemSectionRenderer').find((s) => s.sectionIdentifier === 'comment-item-section');
    return {
      title: runsText(primary?.title),
      channel: runsText(owner?.title),
      channelUrl: owner?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl,
      avatar: owner?.thumbnail?.thumbnails?.at(-1)?.url,
      likeStatus: find(likeButton, 'likeStatusEntity')?.likeStatus ?? find(data, 'likeStatusEntity')?.likeStatus ?? 'INDIFFERENT',
      likeLabel: find(likeButton, 'defaultButtonViewModel')?.buttonViewModel?.title,
      likedLabel: find(likeButton, 'toggledButtonViewModel')?.buttonViewModel?.title,
      likeEndpoint: likeEndpoints.find((e) => e.status === 'LIKE'),
      unlikeEndpoint: likeEndpoints.find((e) => e.status === 'INDIFFERENT'),
      dislikeEndpoint: findAll(dislikeButton, 'likeEndpoint').find((e) => e.status === 'DISLIKE'),
      subscribed: find(data, 'subscriptionStateEntity')?.subscribed ?? subscribeButton?.subscribed ?? false,
      subscribeEndpoint: find(data, 'subscribeEndpoint'),
      unsubscribeEndpoint: find(data, 'unsubscribeEndpoint'),
      commentCount: runsText(commentsPanel?.header?.engagementPanelTitleHeaderRenderer?.contextualInfo)
        || runsText(find(data, 'commentsEntryPointHeaderRenderer')?.commentCount),
      commentsToken: find(commentsSection, 'continuationCommand')?.token,
      related: videosFromData(find(data, 'secondaryResults') ?? []),
    };
  }

  // ---------- UI ----------

  // Styles for YouTube's own page while Longs is open: hide the page, keep the top bar and
  // sidebar, and put the real player where the current video's frame is.
  const pageStyle = document.createElement('style');
  pageStyle.id = 'yt-longs-page-style';
  pageStyle.textContent = `
    html.yt-longs-on { overflow: hidden !important; }
    html.yt-longs-on ytd-page-manager,
    html.yt-longs-on ytd-miniplayer { visibility: hidden !important; }
    html.yt-longs-on #movie_player {
      visibility: visible !important;
      position: fixed !important;
      left: var(--yt-longs-x) !important;
      top: var(--yt-longs-y) !important;
      width: var(--yt-longs-w) !important;
      height: var(--yt-longs-h) !important;
      z-index: 2018 !important;
      overflow: hidden !important;
      border-radius: 12px !important;
      background: #000 !important;
    }
    html.yt-longs-on #movie_player:not(.ad-showing) :is(.ytp-chrome-top, .ytp-chrome-bottom,
      .ytp-gradient-top, .ytp-gradient-bottom, .ytp-large-play-button) { display: none !important; }
    html.yt-longs-on #movie_player :is(.ytp-pause-overlay, .ytp-pause-overlay-container, .ytp-watermark,
      .ytp-ce-element, .ytp-ce-shadow, .ytp-endscreen-content, .ytp-autonav-endscreen,
      .ytp-autonav-endscreen-countdown-overlay, .ytp-cards-teaser, .ytp-cards-button, .ytp-paid-content-overlay,
      .ytp-suggested-action, .ytp-bezel, .ytp-bezel-text-wrapper, .ytp-tooltip, .ytp-contextmenu,
      .ytp-doubletap-ui-legacy, .ytp-fullerscreen-edu-button, .iv-branding) { display: none !important; }
    html.yt-longs-on.yt-longs-guide-full tp-yt-app-drawer#guide {
      visibility: visible !important;
      pointer-events: none !important; /* the drawer itself spans the whole window */
    }
    html.yt-longs-on.yt-longs-guide-full tp-yt-app-drawer#guide #contentContainer {
      transform: none !important;
      visibility: visible !important;
      pointer-events: auto !important;
    }
    html.yt-longs-on.yt-longs-guide-full tp-yt-app-drawer#guide #scrim { display: none !important; }
    html.yt-longs-on.yt-longs-guide-mini ytd-mini-guide-renderer {
      display: block !important;
      visibility: visible !important;
    }
    /* Keep subtitles clear of the channel name and title drawn over the bottom of the video. */
    html.yt-longs-on #movie_player .caption-window.ytp-caption-window-bottom { margin-bottom: 64px !important; }
    /* Longs' full screen: just the feed, edge to edge. */
    html.yt-longs-on.yt-longs-fs #masthead-container,
    html.yt-longs-on.yt-longs-fs tp-yt-app-drawer#guide,
    html.yt-longs-on.yt-longs-fs tp-yt-app-drawer#guide #contentContainer,
    html.yt-longs-on.yt-longs-fs ytd-mini-guide-renderer { visibility: hidden !important; }
    html.yt-longs-on.yt-longs-fs #movie_player { border-radius: 0 !important; }
    /* The page being full screen makes YouTube add its full-screen title bar and "more videos" grid. */
    html.yt-longs-on #movie_player :is(.ytp-fullscreen-metadata, .ytp-overlay-top-left, .ytp-fullscreen-grid,
      .ytp-fullscreen-grid-buttons-container, .ytp-fullscreen-grid-peeking) { display: none !important; }
    /* YouTube's settings menu opens under Longs' gear button at the top, not at the bottom. */
    html.yt-longs-on #movie_player .ytp-settings-menu {
      top: 72px !important;
      bottom: auto !important;
      right: 16px !important;
    }`;
  (document.head || html).append(pageStyle);

  const host = document.createElement('div');
  host.id = 'yt-longs';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <link rel="stylesheet" href="${CSS_URL}">
    <div class="root" hidden>
      <div class="stage">
        <div class="backdrop"></div>
        <div class="track"></div>
        <div class="bezel">${icon('play', 'i-play')}${icon('pause', 'i-pause')}</div>
        <div class="nav">
          <button class="prev" title="Previous video" aria-label="Previous video">${icon('up')}</button>
          <button class="next" title="Next video" aria-label="Next video">${icon('down')}</button>
        </div>
        <div class="panel" hidden>
          <div class="panel-head">
            <h2>Comments</h2><span class="count"></span>
            <button class="panel-close" title="Close" aria-label="Close comments">${icon('close')}</button>
          </div>
          <div class="panel-body"><div class="comments"></div><div class="panel-status"></div></div>
        </div>
        <div class="menu" role="menu" hidden>
          <button role="menuitem" data-menu="watch">${icon('watch')}Watch full video</button>
          <button role="menuitem" data-menu="copy">${icon('link')}Copy link</button>
          <button role="menuitemcheckbox" data-menu="autonext" aria-checked="true">${icon('autoplay')}Auto-scroll<span class="switch"></span></button>
          <button role="menuitem" data-menu="close">${icon('close')}Close Longs</button>
        </div>
        <div class="spinner" hidden></div>
        <div class="message" hidden></div>
        <div class="toast" role="status"></div>
      </div>
    </div>`;
  (document.body || html).append(host);

  const SLIDE_HTML = `
    <div class="frame">
      <img class="thumb" alt="" decoding="async">
      <div class="overlay">
        <div class="controls">
          <div class="ctl-group">
            <button class="ctl" data-ctl="play" aria-label="Play or pause (k)">${icon('play', 'i-play')}${icon('pause', 'i-pause')}</button>
            <div class="vol">
              <button class="ctl" data-ctl="mute" aria-label="Mute (m)">${icon('vol', 'i-vol')}${icon('mute', 'i-mute')}</button>
              <input type="range" min="0" max="100" step="1" data-ctl="volume" aria-label="Volume">
            </div>
          </div>
          <div class="ctl-group">
            <button class="ctl" data-ctl="captions" aria-label="Subtitles/closed captions (c)" aria-pressed="false" hidden>${icon('cc')}</button>
            <button class="ctl" data-ctl="settings" aria-label="Settings: quality, subtitles, audio track, speed">${icon('settings')}</button>
            <button class="ctl plain" data-ctl="menu" aria-label="More actions">${icon('more')}</button>
            <button class="ctl" data-ctl="fullscreen" aria-label="Full screen (f)">${icon('fs', 'i-fs')}${icon('fsExit', 'i-fs-exit')}</button>
          </div>
        </div>
        <div class="meta">
          <div class="channel-bar">
            <a class="avatar-link" data-ctl="channel"><img class="avatar" alt=""></a>
            <a class="handle" data-ctl="channel"></a>
            <button class="subscribe" data-ctl="subscribe">Subscribe</button>
          </div>
          <div class="title"></div>
        </div>
        <div class="progress" data-ctl="progress">
          <div class="preview"><div class="preview-frame"><div class="preview-img"></div></div><span class="preview-time"></span></div>
          <div class="bar"><div class="hovered"></div><div class="played"></div><div class="head"></div></div>
        </div>
      </div>
    </div>
    <div class="actions">
      <div class="action"><button data-ctl="like" aria-pressed="false" aria-label="Like">${icon('heart', 'i-heart')}${icon('heartFill', 'i-heart-fill')}</button><span class="label like-label">Like</span></div>
      <div class="action"><button data-ctl="comments" aria-label="Comments">${icon('comment')}</button><span class="label comment-label">Comments</span></div>
      <div class="action"><button data-ctl="share" aria-label="Share">${icon('share')}</button><span class="label">Share</span></div>
      <div class="action"><button data-ctl="watch" aria-label="Watch full video">${icon('watch')}</button><span class="label">Full video</span></div>
    </div>`;

  const $ = (sel) => shadow.querySelector(sel);
  const root = $('.root');
  const stage = $('.stage');
  const backdrop = $('.backdrop');
  const track = $('.track');
  const bezel = $('.bezel');
  const prevBtn = $('.prev');
  const menu = $('.menu');
  const panel = $('.panel');
  const panelBody = $('.panel-body');
  const commentList = $('.comments');
  const panelStatus = $('.panel-status');
  const spinner = $('.spinner');
  const message = $('.message');
  const toastEl = $('.toast');

  const currentTheme = () => (html.hasAttribute('dark') ? 'dark' : 'light');
  new MutationObserver(() => {
    root.dataset.theme = currentTheme();
    ensureGuideEntries();
  }).observe(html, { attributes: true, attributeFilter: ['dark'] });
  root.dataset.theme = currentTheme();

  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2500);
  }

  // Cover YouTube's content area, leaving its top bar and sidebar visible like the Shorts page does.
  function placeRoot() {
    if (stage.classList.contains('fs')) {
      root.style.top = '0px';
      root.style.left = '0px';
      return;
    }
    const right = (sel) => document.querySelector(sel)?.getBoundingClientRect().right ?? 0;
    let left = 0;
    if (html.classList.contains('yt-longs-guide-full')) left = right('tp-yt-app-drawer#guide #contentContainer');
    else if (html.classList.contains('yt-longs-guide-mini')) left = right('ytd-mini-guide-renderer');
    // Height, not position: the top bar slides back in after full screen.
    root.style.top = `${document.querySelector('#masthead-container')?.offsetHeight || 56}px`;
    root.style.left = `${Math.max(0, left)}px`;
  }
  window.addEventListener('resize', () => { if (isOpen) placeRoot(); });

  // Keep the same sidebar you had: YouTube drops it on watch pages, so it's pinned open with CSS.
  function rememberGuide() {
    const app = document.querySelector('ytd-app');
    const onWatch = location.pathname === '/watch' || location.pathname.startsWith('/longs/');
    const full = app?.hasAttribute('guide-persistent-and-visible') || (onWatch && innerWidth >= 1312);
    const mini = !full && app?.hasAttribute('mini-guide-visible');
    html.classList.toggle('yt-longs-guide-full', !!full);
    html.classList.toggle('yt-longs-guide-mini', !!mini);
  }

  // ---------- Slides ----------

  const thumbUrl = (id, name) => `https://i.ytimg.com/vi/${id}/${name}.jpg`;
  const activeSlide = () => slides.get(index);

  function makeSlide(i) {
    const el = document.createElement('div');
    el.className = 'slide paused';
    el.innerHTML = SLIDE_HTML;
    el.style.setProperty('--i', i);
    el.dataset.index = i;
    const thumb = el.querySelector('.thumb');
    // hq720 doesn't exist for older videos; YouTube answers with a tiny placeholder or a 404.
    const fallback = () => {
      if (!thumb.src.includes('/hqdefault')) thumb.src = thumbUrl(el.dataset.id, 'hqdefault');
    };
    thumb.addEventListener('error', fallback);
    thumb.addEventListener('load', () => { if (thumb.naturalWidth <= 120) fallback(); });
    const progress = el.querySelector('.progress');
    progress.addEventListener('pointermove', (e) => showPreview(progress, e.clientX));
    return el;
  }

  const formatTime = (seconds) => {
    const t = Math.max(0, Math.floor(seconds));
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = String(t % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
  };

  // YouTube's storyboard: sprite sheets of small frames across the video, used for hover previews.
  // Spec: "<url with $L/$N>|w#h#count#cols#rows#interval#name#sigh|..." one level per size.
  let storyboardCache = { spec: null, value: null };
  function storyboard() {
    const spec = player.storyboard;
    if (spec !== storyboardCache.spec) {
      const [base, ...levels] = (spec || '').split('|');
      const parsed = levels.map((level, L) => {
        const [w, h, count, cols, rows, , name, sigh] = level.split('#');
        return { L, w: +w, h: +h, count: +count, cols: +cols, rows: +rows, name, sigh };
      }).filter((l) => l.w && l.count && l.cols && l.rows && l.name);
      const level = parsed.filter((l) => l.w <= 160).at(-1) ?? parsed[0];
      storyboardCache = { spec, value: base && level ? { base, ...level } : null };
    }
    return storyboardCache.value;
  }

  function showPreview(progress, clientX) {
    if (!progress.closest('.slide.active') || !player.duration) return;
    const rect = progress.querySelector('.bar').getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const t = fraction * player.duration;
    progress.querySelector('.hovered').style.width = `${fraction * 100}%`;
    const preview = progress.querySelector('.preview');
    preview.style.left = `${Math.min(rect.width - 84, Math.max(84, fraction * rect.width))}px`;
    preview.querySelector('.preview-time').textContent = formatTime(t);
    const box = preview.querySelector('.preview-frame');
    const sb = storyboard();
    box.hidden = !sb;
    if (!sb) return;
    const frame = Math.min(sb.count - 1, Math.floor((t / player.duration) * sb.count));
    const perSheet = sb.cols * sb.rows;
    const sheet = Math.floor(frame / perSheet);
    const cell = frame % perSheet;
    const url = `${sb.base.replace('$L', sb.L).replace('$N', sb.name.replace('$M', sheet))}&sigh=${sb.sigh}`;
    const img = box.firstElementChild;
    const scale = 160 / sb.w;
    box.style.height = `${Math.round(sb.h * scale)}px`;
    Object.assign(img.style, {
      width: `${sb.w}px`,
      height: `${sb.h}px`,
      transform: `scale(${scale})`,
      backgroundImage: `url("${url}")`,
      backgroundPosition: `-${(cell % sb.cols) * sb.w}px -${Math.floor(cell / sb.cols) * sb.h}px`,
    });
  }

  const handleOf = (url) => (url?.startsWith('/@') ? decodeURIComponent(url.slice(1)) : '');

  function fillSlide(el, item) {
    if (el.dataset.id !== item.id) {
      el.dataset.id = item.id;
      el.querySelector('.thumb').src = thumbUrl(item.id, 'hq720');
    }
    const d = item.details;
    el.querySelector('.title').textContent = d?.title || item.title || '';
    const channelUrl = d?.channelUrl || item.channelUrl;
    el.querySelector('.handle').textContent = handleOf(channelUrl) || d?.channel || item.channel || '';
    for (const link of el.querySelectorAll('[data-ctl="channel"]')) {
      if (channelUrl) link.href = channelUrl; else link.removeAttribute('href');
    }
    const avatar = el.querySelector('.avatar');
    const avatarUrl = d?.avatar || item.avatar;
    if (avatarUrl && avatar.getAttribute('src') !== avatarUrl) avatar.src = avatarUrl;
    avatar.hidden = !avatarUrl;

    const subscribe = el.querySelector('.subscribe');
    if (!subscribe.dataset.confirming) {
      subscribe.textContent = d?.subscribed ? 'Subscribed' : 'Subscribe';
      subscribe.classList.toggle('subscribed', !!d?.subscribed);
    }
    const liked = d?.likeStatus === 'LIKE';
    el.querySelector('[data-ctl="like"]').setAttribute('aria-pressed', String(liked));
    el.querySelector('.like-label').textContent = (liked ? d?.likedLabel : d?.likeLabel) || 'Like';
    el.querySelector('.comment-label').textContent = d?.commentCount || 'Comments';
  }

  function refreshSlidesFor(item) {
    for (const el of slides.values()) if (el.dataset.id === item.id) fillSlide(el, item);
  }

  function renderSlides() {
    const keep = new Set();
    for (let i = index - 1; i <= index + 2; i++) {
      const item = queue[i];
      if (!item) continue;
      keep.add(i);
      let el = slides.get(i);
      if (!el) {
        el = makeSlide(i);
        track.append(el);
        slides.set(i, el);
      }
      el.classList.toggle('active', i === index);
      if (i !== index) el.classList.remove('live');
      fillSlide(el, item);
      if (i >= index && i <= index + 1 && !item.details) {
        getDetails(item.id).then((details) => {
          if (details) {
            item.details = details;
            refreshSlidesFor(item);
          }
          if (comments.open && queue[index] === item && !comments.loaded) {
            if (details) loadComments(true);
            else panelStatus.textContent = "Couldn't load comments.";
          }
        });
      }
    }
    for (const [i, el] of slides) {
      if (!keep.has(i)) { el.remove(); slides.delete(i); }
    }
    prevBtn.disabled = index <= 0;
    syncPlayerUi();
  }

  function clearSlides() {
    for (const el of slides.values()) el.remove();
    slides.clear();
  }

  function setIndex(i, animate = true) {
    track.classList.toggle('instant', !animate);
    track.style.setProperty('--index', i);
    if (!animate) {
      void track.offsetHeight;
      track.classList.remove('instant');
    }
  }

  // Cut a hole in the backdrop where the current video is and move YouTube's player under it.
  // Runs every frame while open so the player follows slides and the comments-panel resize.
  let lastHole = '';
  let ticking = false;
  function tick() {
    if (!isOpen) { ticking = false; return; }
    const frame = activeSlide()?.querySelector('.frame');
    if (frame) {
      const f = frame.getBoundingClientRect();
      const r = root.getBoundingClientRect();
      const key = [f.left, f.top, f.width, f.height, r.left, r.top, r.width, r.height].map(Math.round).join();
      if (key !== lastHole) {
        const sizeChanged = lastHole.split(',').slice(2, 4).join() !== key.split(',').slice(2, 4).join();
        lastHole = key;
        const R = stage.classList.contains('fs') ? 0 : 12;
        const [x, y, w, h] = [f.left - r.left, f.top - r.top, f.width, f.height];
        backdrop.style.clipPath = `path(evenodd, "M0 0H${r.width}V${r.height}H0Z M${x + R} ${y}H${x + w - R}A${R} ${R} 0 0 1 ${x + w} ${y + R}V${y + h - R}A${R} ${R} 0 0 1 ${x + w - R} ${y + h}H${x + R}A${R} ${R} 0 0 1 ${x} ${y + h - R}V${y + R}A${R} ${R} 0 0 1 ${x + R} ${y}Z")`;
        html.style.setProperty('--yt-longs-x', `${f.left}px`);
        html.style.setProperty('--yt-longs-y', `${f.top}px`);
        html.style.setProperty('--yt-longs-w', `${f.width}px`);
        html.style.setProperty('--yt-longs-h', `${f.height}px`);
        // YouTube's player re-measures itself on window resize.
        if (sizeChanged) {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
        }
      }
      if (player.duration > 0) {
        const pct = `${(Math.min(1, Math.max(0, currentTime() / player.duration)) * 100).toFixed(3)}%`;
        activeSlide().querySelector('.played').style.width = pct;
        activeSlide().querySelector('.head').style.left = pct;
      }
    }
    requestAnimationFrame(tick);
  }

  // ---------- Player (YouTube's own, through bridge.js) ----------

  function command(name, args = []) {
    window.postMessage({ ytLongs: 'command', name, args }, location.origin);
  }

  const isPlaying = () => player.state === 1 || player.state === 3;
  const onTarget = () => !!target && player.id === target;

  function currentTime() {
    const elapsed = player.state === 1 ? (performance.now() - player.timeAt) / 1000 : 0;
    return Math.min(player.time + elapsed, player.duration || Infinity);
  }

  function setLive(on) {
    activeSlide()?.classList.toggle('live', on);
  }

  // The video the address bar points at: /watch?v=ID, or /longs/ID once Longs has renamed it.
  function pageVideoId() {
    if (location.pathname === '/watch') return new URLSearchParams(location.search).get('v');
    return location.pathname.match(/^\/longs\/([\w-]{11})/)?.[1] ?? null;
  }

  function loadCurrent(start = 0) {
    moving = false;
    const item = queue[index];
    if (!item) return;
    target = item.id;
    Object.assign(player, { state: -1, time: start, timeAt: performance.now(), duration: 0, error: false });
    setLive(false);
    stage.classList.remove('ad');
    const alreadyThere = pageVideoId() === item.id;
    if (longsFirstEntry < 0 && window.navigation) {
      longsFirstEntry = navigation.currentEntry.index + (alreadyThere ? 0 : 1);
    }
    if (alreadyThere) {
      command('playVideo'); // already there (or Back/Forward is taking YouTube there)
      showLongsUrl();
    } else {
      markOwnNavigation();
      command('navigate', [item.id, start]);
    }
    // A video that never starts (removed, region-locked, sign-in only) gets skipped.
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => {
      if (isOpen && target === item.id && !onTarget()) skipBroken();
    }, 15000);
    syncPlayerUi();
    if (comments.open) loadComments(true);
  }

  function syncPlayerUi() {
    const slide = activeSlide();
    if (slide) slide.classList.toggle('paused', !(onTarget() && isPlaying()));
    stage.classList.toggle('muted', player.muted || player.volume === 0);
    const volume = slide?.querySelector('[data-ctl="volume"]');
    if (volume && shadow.activeElement !== volume) {
      volume.value = player.muted ? 0 : player.volume;
      volume.style.setProperty('--vol', `${volume.value}%`);
    }
  }

  function onPlayerState(state) {
    if (moving || state === player.state) return;
    player.state = state;
    if (state === 1) setLive(true);
    syncPlayerUi();
    if (state === 0 && settings.autoNext) go(1);
  }

  function skipBroken() {
    const item = queue[index];
    if (!isOpen || moving || !item) return;
    toast("This video can't be played, skipping");
    queue.splice(index, 1);
    if (direction < 0 && index > 0) index--;
    if (index >= queue.length) index = Math.max(0, queue.length - 1);
    target = null;
    clearSlides();
    setIndex(index, false);
    renderSlides();
    clearTimeout(loadTimer);
    if (queue.length - index <= LOAD_MORE_AT) loadMore().then(() => { if (isOpen && !target) loadCurrent(); });
    if (queue[index]) loadTimer = setTimeout(loadCurrent, 600);
  }

  window.addEventListener('message', (e) => {
    if (!isOpen || e.source !== window || e.data?.ytLongs !== 'state') return;
    const s = e.data.state;
    player.id = s.videoId;
    player.volume = s.volume;
    player.muted = s.muted;
    if (!onTarget()) { syncPlayerUi(); return; } // still the previous video, or still loading
    player.duration = s.duration;
    player.storyboard = s.storyboard;
    syncNativeControls();
    if (!scrub.active) {
      player.time = s.time;
      player.timeAt = performance.now();
    }
    stage.classList.toggle('ad', s.ad);
    if (s.ad) setLive(true);
    if (s.error && !player.error) skipBroken();
    player.error = s.error;
    onPlayerState(s.playerState);
  });

  const scrub = { active: false };

  function seekTo(seconds) {
    const t = Math.max(0, Math.min(seconds, player.duration || seconds));
    command('seekTo', [t, true]);
    player.time = t;
    player.timeAt = performance.now();
  }

  function togglePlay() {
    // Ask the video itself: the player's status reports arrive every 200ms and may lag behind.
    const video = document.querySelector('#movie_player video');
    const wasPlaying = video ? !video.paused : isPlaying();
    command(wasPlaying ? 'pauseVideo' : 'playVideo');
    player.state = wasPlaying ? 2 : 1;
    syncPlayerUi();
    bezel.querySelector('.i-play').style.display = wasPlaying ? 'none' : '';
    bezel.querySelector('.i-pause').style.display = wasPlaying ? '' : 'none';
    bezel.classList.remove('pop');
    void bezel.offsetWidth;
    bezel.classList.add('pop');
  }

  function toggleMute() {
    if (player.muted || player.volume === 0) {
      command('unMute');
      if (player.volume === 0) command('setVolume', [50]);
      player.muted = false;
      if (player.volume === 0) player.volume = 50;
    } else {
      command('mute');
      player.muted = true;
    }
    syncPlayerUi();
  }

  // Full screen keeps you in Longs: the whole page goes full screen (so YouTube's player, which
  // lives in the page, comes along) and the layout switches to edge-to-edge.
  const isFullscreen = () => document.fullscreenElement === html;

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else html.requestFullscreen?.().catch(() => toast("Couldn't go full screen"));
  }

  document.addEventListener('fullscreenchange', () => {
    const fs = isOpen && isFullscreen();
    stage.classList.toggle('fs', fs);
    html.classList.toggle('yt-longs-fs', fs);
    if (fs && comments.open) closeComments();
    if (isOpen) {
      placeRoot();
      setTimeout(() => { if (isOpen) placeRoot(); }, 400); // YouTube re-lays out its sidebar after full screen
    }
  });

  // Subtitles, audio track, quality and speed use YouTube's own controls inside the player.
  const nativeButton = (name) => document.querySelector(`#movie_player .ytp-${name}-button`);
  const nativeMenuOpen = () => {
    const menu = document.querySelector('#movie_player .ytp-settings-menu');
    return !!menu && menu.style.display !== 'none' && menu.getClientRects().length > 0;
  };

  function syncNativeControls() {
    const slide = activeSlide();
    const cc = nativeButton('subtitles');
    const ours = slide?.querySelector('[data-ctl="captions"]');
    if (ours) {
      ours.hidden = !cc || cc.style.display === 'none';
      ours.setAttribute('aria-pressed', String(cc?.getAttribute('aria-pressed') === 'true'));
    }
    // Leave a moment for the menu to open after we asked for it.
    if (performance.now() - nativeMenuAt > 400) stage.classList.toggle('native-menu', nativeMenuOpen());
  }

  function toggleCaptions() {
    const cc = nativeButton('subtitles');
    if (!cc || cc.style.display === 'none') { toast('No subtitles for this video'); return; }
    cc.click();
    setTimeout(syncNativeControls, 100);
  }

  function openNativeSettings() {
    const button = nativeButton('settings');
    if (!button) return;
    nativeMenuAt = performance.now();
    stage.classList.add('native-menu');
    // After this click finishes, or YouTube treats it as a click outside its menu and closes it.
    setTimeout(() => button.click(), 0);
  }

  function closeNativeSettings() {
    if (nativeMenuOpen()) nativeButton('settings')?.click();
    stage.classList.remove('native-menu');
  }

  // While Longs is open, YouTube's autoplay would jump to its own pick when a video ends.
  function disableAutonav() {
    const toggle = document.querySelector('#movie_player .ytp-autonav-toggle-button');
    if (toggle?.getAttribute('aria-checked') === 'true') {
      toggle.click();
      autonavWasOn = true;
    }
  }

  function restoreAutonav() {
    const toggle = document.querySelector('#movie_player .ytp-autonav-toggle-button');
    if (autonavWasOn && toggle?.getAttribute('aria-checked') === 'false') toggle.click();
    autonavWasOn = false;
  }

  // ---------- Navigation ----------

  function go(delta) {
    if (!isOpen || !delta) return;
    const next = index + delta;
    if (next < 0) return;
    if (next >= queue.length) {
      if (waitingForMore) return;
      waitingForMore = true;
      spinner.hidden = false;
      loadMore().then(() => {
        waitingForMore = false;
        spinner.hidden = true;
        if (!isOpen) return;
        if (next < queue.length) go(delta);
        else toast('No more recommendations right now');
      });
      return;
    }
    closeMenu();
    direction = Math.sign(delta);
    index = next;
    moving = true;
    command('pauseVideo');
    stage.classList.remove('ad');
    renderSlides();
    setIndex(index);
    clearTimeout(loadTimer);
    loadTimer = setTimeout(loadCurrent, SLIDE_MS);
    if (queue.length - index <= LOAD_MORE_AT) loadMore();
  }

  // A trackpad flick fires a long stream of wheel events; treat each stream as a single swipe.
  const wheel = { sum: 0, last: 0, lockedUntil: 0 };
  function onWheel(deltaX, deltaY, deltaMode) {
    if (Math.abs(deltaX) > Math.abs(deltaY)) return;
    const dy = deltaMode === 1 ? deltaY * 40 : deltaMode === 2 ? deltaY * innerHeight : deltaY;
    const now = performance.now();
    const gap = now - wheel.last;
    wheel.last = now;
    if (now < wheel.lockedUntil) {
      if (gap < 120) wheel.lockedUntil = Math.max(wheel.lockedUntil, now + 120); // momentum still going
      return;
    }
    if (gap > 250) wheel.sum = 0;
    wheel.sum += dy;
    if (Math.abs(wheel.sum) >= 40) {
      go(wheel.sum > 0 ? 1 : -1);
      wheel.sum = 0;
      wheel.lockedUntil = now + 450;
    }
  }

  // Scrolling anywhere over the feed switches videos; the top bar, sidebar, comments and menus
  // still scroll normally.
  function onPageWheel(e) {
    const path = e.composedPath();
    if (path.includes(panel) || path.includes(menu)) return;
    if (path.some((el) => el instanceof Element && el.matches('#masthead-container, ytd-guide-renderer, ytd-mini-guide-renderer, ytd-popup-container, tp-yt-iron-dropdown, .ytp-popup'))) return;
    e.preventDefault();
    onWheel(e.deltaX, e.deltaY, e.deltaMode);
  }

  let touchY = null;
  stage.addEventListener('touchstart', (e) => {
    touchY = e.touches.length === 1 && !panel.contains(e.target) ? e.touches[0].clientY : null;
  }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (touchY === null) return;
    const dy = touchY - e.changedTouches[0].clientY;
    touchY = null;
    if (Math.abs(dy) > 50) go(dy > 0 ? 1 : -1);
  });

  // Show the video controls while the mouse moves, like Shorts.
  document.addEventListener('mousemove', () => {
    if (!isOpen) return;
    stage.classList.add('ui');
    clearTimeout(uiTimer);
    uiTimer = setTimeout(() => stage.classList.remove('ui'), 2500);
  });

  const KEYS = {
    ArrowDown: () => go(1),
    PageDown: () => go(1),
    ArrowUp: () => go(-1),
    PageUp: () => go(-1),
    ' ': togglePlay,
    k: togglePlay,
    m: toggleMute,
    f: toggleFullscreen,
    c: toggleCaptions,
    ArrowRight: () => seekTo(currentTime() + 5),
    ArrowLeft: () => seekTo(currentTime() - 5),
    l: () => seekTo(currentTime() + 10),
    j: () => seekTo(currentTime() - 10),
    Escape: () => {
      if (!menu.hidden) closeMenu();
      else if (comments.open) closeComments();
      else if (!document.fullscreenElement) close();
      else document.exitFullscreen();
    },
  };
  const NAV_KEYS = new Set(['ArrowDown', 'PageDown', 'ArrowUp', 'PageUp']);
  const keyName = (e) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);

  // While Longs is open, keys go to Longs and never reach YouTube's own shortcuts underneath,
  // except while you're typing in YouTube's search box.
  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.composedPath()[0];
    const typing = target instanceof HTMLElement
      && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
    if (typing && !shadow.contains(target)) return;
    if (stage.classList.contains('native-menu')) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeNativeSettings(); }
      return;
    }
    e.stopImmediatePropagation();
    if (typing && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return; // moving the volume slider
    const action = KEYS[keyName(e)];
    if (!action) return;
    e.preventDefault();
    if (e.repeat && NAV_KEYS.has(e.key)) return;
    action();
  }

  // The key release of a key Longs handled goes nowhere: YouTube's player and focused buttons
  // (Space "clicks" a focused button on release) would otherwise act on it a second time.
  function onKeyRelease(e) {
    if (e.metaKey || e.ctrlKey || e.altKey || stage.classList.contains('native-menu')) return;
    const target = e.composedPath()[0];
    const typing = target instanceof HTMLElement
      && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
    if (typing && !shadow.contains(target)) return;
    if (!KEYS[keyName(e)]) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  // ---------- Buttons ----------

  prevBtn.addEventListener('click', () => go(-1));
  $('.next').addEventListener('click', () => go(1));

  track.addEventListener('click', (e) => {
    const slide = e.target.closest('.slide');
    if (!slide) return;
    const slideIndex = Number(slide.dataset.index);
    if (slideIndex !== index) { go(slideIndex - index); return; } // clicked the peeking next video
    const control = e.target.closest('[data-ctl]');
    const item = queue[index];
    if (!item) return;
    if (!control) {
      closeMenu();
      if (e.target.closest('.frame')) togglePlay();
      return;
    }
    switch (control.dataset.ctl) {
      case 'play': togglePlay(); break;
      case 'mute': toggleMute(); break;
      case 'fullscreen': toggleFullscreen(); break;
      case 'captions': toggleCaptions(); break;
      case 'settings': e.stopPropagation(); closeMenu(); openNativeSettings(); break;
      case 'menu': e.stopPropagation(); toggleMenu(control); break;
      case 'like': toggleLike(item); break;
      case 'comments': comments.open ? closeComments() : openComments(); break;
      case 'share': copyLink(item); break;
      case 'watch': watchFull(item); break;
      case 'subscribe': toggleSubscribe(item, control); break;
      case 'channel':
        e.preventDefault();
        if (control.getAttribute('href')) { close(); location.assign(control.getAttribute('href')); }
        break;
    }
  });
  track.addEventListener('dblclick', (e) => {
    if (e.target.closest('.slide.active .frame') && !e.target.closest('[data-ctl]')) toggleFullscreen();
  });

  track.addEventListener('input', (e) => {
    if (e.target.dataset.ctl !== 'volume') return;
    const volume = Number(e.target.value);
    command('setVolume', [volume]);
    command(volume === 0 ? 'mute' : 'unMute');
    player.volume = volume;
    player.muted = volume === 0;
    e.target.style.setProperty('--vol', `${volume}%`);
    stage.classList.toggle('muted', player.muted);
  });

  // Click or drag on the progress bar to seek.
  track.addEventListener('pointerdown', (e) => {
    const bar = e.target.closest('.progress');
    if (!bar || !player.duration) return;
    e.preventDefault();
    bar.setPointerCapture(e.pointerId);
    bar.classList.add('dragging');
    scrub.active = true;
    const rect = bar.getBoundingClientRect();
    const timeAt = (x) => Math.min(1, Math.max(0, (x - rect.left) / rect.width)) * player.duration;
    const move = (ev) => {
      player.time = timeAt(ev.clientX);
      player.timeAt = performance.now();
    };
    const up = (ev) => {
      bar.removeEventListener('pointermove', move);
      bar.classList.remove('dragging');
      scrub.active = false;
      seekTo(timeAt(ev.clientX));
    };
    move(e);
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up, { once: true });
    bar.addEventListener('pointercancel', up, { once: true });
  });

  function toggleMenu(button) {
    if (!menu.hidden) { closeMenu(); return; }
    menu.querySelector('[data-menu="autonext"]').setAttribute('aria-checked', String(settings.autoNext));
    const b = button.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    menu.hidden = false;
    menu.style.top = `${b.bottom - s.top + 8}px`;
    menu.style.left = `${Math.max(8, b.right - s.left - menu.offsetWidth)}px`;
  }

  function closeMenu() {
    menu.hidden = true;
  }

  menu.addEventListener('click', (e) => {
    const choice = e.target.closest('[data-menu]')?.dataset.menu;
    const item = queue[index];
    if (choice === 'autonext') {
      settings.autoNext = !settings.autoNext;
      chrome.storage.local.set({ autoNext: settings.autoNext });
      e.target.closest('[data-menu]').setAttribute('aria-checked', String(settings.autoNext));
      return;
    }
    closeMenu();
    if (choice === 'watch' && item) watchFull(item);
    if (choice === 'copy' && item) copyLink(item);
    if (choice === 'close') close();
  });

  stage.addEventListener('click', (e) => {
    if (!menu.hidden && !menu.contains(e.target)) closeMenu();
  });

  // Closing Longs leaves the current video's normal watch page in place.
  function watchFull(item) {
    const ready = watchPageIs(item.id);
    close();
    if (!ready) command('navigate', [item.id]);
  }

  async function copyLink(item) {
    try {
      await navigator.clipboard.writeText(`https://youtu.be/${item.id}`);
      toast('Link copied to clipboard');
    } catch {
      toast("Couldn't copy the link");
    }
  }

  // The watch page underneath is the current video, so Like and Subscribe press YouTube's own
  // buttons there, exactly as if you clicked them on the normal page.
  const watchPageIs = (id) => document.querySelector('ytd-watch-flexy')?.getAttribute('video-id') === id;
  const pageLikeButton = () => document.querySelector('ytd-watch-flexy ytd-watch-metadata like-button-view-model button');
  const pageSubscribeButton = () => document.querySelector('ytd-watch-flexy ytd-watch-metadata #subscribe-button button');

  async function toggleLike(item) {
    if (!loggedIn()) { toast('Sign in to YouTube to like videos'); return; }
    const d = item.details ?? (item.details = await getDetails(item.id));
    if (!d) return;
    const liked = d.likeStatus === 'LIKE';
    const button = watchPageIs(item.id) && pageLikeButton();
    if (button) {
      button.click();
      d.likeStatus = liked ? 'INDIFFERENT' : 'LIKE';
      refreshSlidesFor(item);
      setTimeout(() => {
        // Read back what YouTube actually did.
        d.likeStatus = button.getAttribute('aria-pressed') === 'true' ? 'LIKE' : 'INDIFFERENT';
        const count = button.textContent.trim();
        if (count) d[d.likeStatus === 'LIKE' ? 'likedLabel' : 'likeLabel'] = count;
        refreshSlidesFor(item);
      }, 600);
      return;
    }
    const endpoint = liked ? d.unlikeEndpoint : d.likeEndpoint;
    if (!endpoint) { toast('Wait for the video to start, then try again'); return; }
    d.likeStatus = liked ? 'INDIFFERENT' : 'LIKE';
    refreshSlidesFor(item);
    try {
      const params = endpoint.removeLikeParams ?? endpoint.likeParams;
      await innertube(liked ? 'like/removelike' : 'like/like', { target: endpoint.target, ...(params && { params }) }, { write: true });
    } catch {
      d.likeStatus = liked ? 'LIKE' : 'INDIFFERENT';
      refreshSlidesFor(item);
      toast("Couldn't update your like. Try again from the full video");
    }
  }

  async function toggleSubscribe(item, button) {
    if (!loggedIn()) { toast('Sign in to YouTube to subscribe'); return; }
    const d = item.details ?? (item.details = await getDetails(item.id));
    if (!d) return;
    if (!d.subscribed) {
      const pageButton = watchPageIs(item.id) && pageSubscribeButton();
      d.subscribed = true;
      refreshSlidesFor(item);
      if (pageButton) { pageButton.click(); return; }
      try {
        await innertube('subscription/subscribe', {
          channelIds: d.subscribeEndpoint.channelIds,
          ...(d.subscribeEndpoint.params && { params: d.subscribeEndpoint.params }),
        }, { write: true });
        toast('Subscription added');
      } catch {
        d.subscribed = false;
        refreshSlidesFor(item);
        toast("Couldn't subscribe here. Try again from the full video");
      }
      return;
    }
    // Unsubscribing takes a second click, so a stray click can't drop a channel.
    if (!button.dataset.confirming) {
      button.dataset.confirming = '1';
      button.textContent = 'Unsubscribe?';
      setTimeout(() => { delete button.dataset.confirming; refreshSlidesFor(item); }, 3000);
      return;
    }
    delete button.dataset.confirming;
    const endpoint = d.unsubscribeEndpoint;
    if (!endpoint?.channelIds) { toast('Unsubscribe from the full video page'); refreshSlidesFor(item); return; }
    d.subscribed = false;
    refreshSlidesFor(item);
    try {
      await innertube('subscription/unsubscribe', {
        channelIds: endpoint.channelIds,
        ...(endpoint.params && { params: endpoint.params }),
      }, { write: true });
      toast('Subscription removed');
    } catch {
      d.subscribed = true;
      refreshSlidesFor(item);
      toast("Couldn't unsubscribe here. Try again from the full video");
    }
  }

  // ---------- Comments panel ----------

  const comments = { open: false, videoId: null, token: null, loading: false, loaded: false };

  function animateLayout() {
    stage.classList.add('resizing');
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => stage.classList.remove('resizing'), 320);
  }

  function openComments() {
    comments.open = true;
    animateLayout();
    stage.classList.add('with-panel');
    panel.hidden = false;
    loadComments(true);
  }

  function closeComments() {
    comments.open = false;
    animateLayout();
    stage.classList.remove('with-panel');
    panel.hidden = true;
  }

  $('.panel-close').addEventListener('click', closeComments);
  panelBody.addEventListener('scroll', () => {
    if (panelBody.scrollTop + panelBody.clientHeight > panelBody.scrollHeight - 400) loadComments(false);
  });

  function parseComments(res) {
    const actions = [...findAll(res, 'reloadContinuationItemsCommand'), ...findAll(res, 'appendContinuationItemsAction')];
    const items = actions.flatMap((a) => a.continuationItems ?? []);
    const entities = new Map(findAll(res, 'commentEntityPayload').map((p) => [p.key, p]));
    const list = [];
    let next = null;
    for (const it of items) {
      if (it.commentThreadRenderer) {
        const entity = entities.get(find(it.commentThreadRenderer, 'commentKey'));
        if (entity) {
          list.push({
            author: entity.author?.displayName,
            avatar: entity.author?.avatarThumbnailUrl,
            text: entity.properties?.content?.content,
            time: entity.properties?.publishedTime,
            likes: entity.toolbar?.likeCountNotliked?.trim(),
          });
        } else {
          const c = find(it.commentThreadRenderer, 'commentRenderer');
          if (c) {
            list.push({
              author: runsText(c.authorText),
              avatar: c.authorThumbnail?.thumbnails?.at(-1)?.url,
              text: runsText(c.contentText),
              time: runsText(c.publishedTimeText),
              likes: runsText(c.voteCount),
            });
          }
        }
      } else if (it.continuationItemRenderer) {
        next = find(it.continuationItemRenderer, 'continuationCommand')?.token ?? null;
      }
    }
    return { list, next };
  }

  function renderComment(c) {
    const el = document.createElement('div');
    el.className = 'comment';
    el.innerHTML = `<img alt="" loading="lazy"><div><div class="who"><b></b><span></span></div>
      <div class="text"></div><div class="likes">${icon('thumb')}<span></span></div></div>`;
    if (c.avatar) el.querySelector('img').src = c.avatar;
    el.querySelector('b').textContent = c.author || '';
    el.querySelector('.who span').textContent = c.time || '';
    el.querySelector('.text').textContent = c.text || '';
    el.querySelector('.likes span').textContent = c.likes || '';
    return el;
  }

  async function loadComments(reset) {
    const item = queue[index];
    if (!item || !comments.open) return;
    if (reset) {
      comments.videoId = item.id;
      comments.token = null;
      comments.loaded = false;
      commentList.textContent = '';
      panelBody.scrollTop = 0;
      $('.panel-head .count').textContent = item.details?.commentCount ?? '';
      panelStatus.textContent = 'Loading…';
      if (!item.details) return; // renderSlides() calls back once the details arrive
      comments.loaded = true;
      comments.token = item.details.commentsToken;
      if (!comments.token) { panelStatus.textContent = 'Comments are turned off.'; return; }
    }
    if (!comments.token || comments.loading || comments.videoId !== item.id) return;
    comments.loading = true;
    try {
      const res = await innertube('next', { continuation: comments.token });
      if (comments.videoId !== item.id) return;
      const { list, next } = parseComments(res);
      comments.token = next;
      commentList.append(...list.map(renderComment));
      panelStatus.textContent = next ? 'Loading…' : (commentList.childElementCount ? '' : 'No comments yet.');
    } catch {
      if (comments.videoId === item.id) panelStatus.textContent = "Couldn't load comments.";
    } finally {
      comments.loading = false;
    }
  }

  // ---------- Open / close ----------

  async function open({ startId = null } = {}) {
    if (isOpen) return;
    isOpen = true;
    queue.length = 0;
    seen.clear();
    relatedTried.clear();
    Object.assign(feed, { token: null, refetchesLeft: 3, initial: null });
    clearSlides();
    index = 0;
    direction = 1;
    target = null;
    lastHole = '';
    longsFirstEntry = -1;
    exitingTo = null;
    setIndex(0, false);

    if (!startId) document.querySelectorAll('video').forEach((video) => video.pause());
    document.activeElement?.blur?.();
    rememberGuide();
    html.classList.add('yt-longs-on');
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKeyRelease, true);
    window.addEventListener('keypress', onKeyRelease, true);
    window.addEventListener('wheel', onPageWheel, { capture: true, passive: false });
    command('report', [true]);
    disableAutonav();
    placeRoot();
    root.dataset.theme = currentTheme();
    root.hidden = false;
    spinner.hidden = false;
    message.hidden = true;
    ensureGuideEntries();
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(tick);
    }

    // On Home, start right away with the recommendations already on screen and fetch the rest of
    // the feed meanwhile. Anywhere else, wait for the feed.
    if (startId) addVideos([{ id: startId }]);
    if (location.pathname === '/') addVideos(collectFromPage());
    feed.initial = loadHomePage()
      .then((videos) => { if (isOpen && addVideos(videos) && queue.length > 1) renderSlides(); })
      .catch(() => {});
    if (!queue.length) await feed.initial;
    if (!isOpen) return;
    if (!queue.length) {
      // Signed out with no watch history, Home is empty. Use whatever this page shows instead.
      addVideos(collectFromPage());
      if (queue.length) toast('Sign in to YouTube to get your recommendations here');
    }
    spinner.hidden = true;
    if (!queue.length) {
      message.hidden = false;
      message.textContent = 'YouTube has no recommendations for you yet. Sign in or watch a few videos, then try again.';
      return;
    }
    renderSlides();
    loadCurrent();
    if (queue.length <= LOAD_MORE_AT) loadMore();
  }

  // Leaves you on the normal watch page of the video you were on. When you navigate away instead,
  // the /longs/ID address stays in history so Back brings you into Longs again.
  function close({ keepUrl = false } = {}) {
    if (!isOpen) return;
    isOpen = false;
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('keyup', onKeyRelease, true);
    window.removeEventListener('keypress', onKeyRelease, true);
    window.removeEventListener('wheel', onPageWheel, { capture: true });
    command('report', [false]);
    clearTimeout(loadTimer);
    clearTimeout(stallTimer);
    restoreAutonav();
    if (isFullscreen()) document.exitFullscreen();
    stage.classList.remove('fs', 'native-menu');
    if (comments.open) closeComments();
    closeMenu();
    clearSlides();
    root.hidden = true;
    html.classList.remove('yt-longs-on', 'yt-longs-guide-full', 'yt-longs-guide-mini', 'yt-longs-fs');
    const id = location.pathname.match(/^\/longs\/([\w-]{11})/)?.[1];
    if (id && !keepUrl) history.replaceState(history.state, '', `/watch?v=${id}`);
    window.dispatchEvent(new Event('resize')); // let the player fit back into the page
    ensureGuideEntries();
  }

  // Our own switches between videos are YouTube navigations too; anything else (top bar, sidebar,
  // a link) means you're leaving Longs.
  // Navigations Longs causes itself (its own video switches, Back/Forward inside Longs) must not
  // close it. The flag clears when YouTube finishes, or after a few seconds as a safety net.
  function markOwnNavigation() {
    ownNavigation = true;
    clearTimeout(ownNavigationTimer);
    ownNavigationTimer = setTimeout(() => { ownNavigation = false; }, 5000);
  }

  document.addEventListener('yt-navigate-start', () => {
    if (exitingTo && location.pathname.startsWith('/longs/')) return; // passing through on the way out
    if (ownNavigation || followTraversal()) return;
    close({ keepUrl: true });
  });
  document.addEventListener('yt-navigate-finish', () => {
    ownNavigation = false;
    if (!isOpen) return;
    showLongsUrl();
    disableAutonav();
    placeRoot();
    ensureGuideEntries();
  });

  // Show youtube.com/longs/ID in the address bar, like /shorts/ID. Only the visible address
  // changes; YouTube keeps its own page state. rules.json sends /longs/ID links back here.
  function showLongsUrl() {
    if (isOpen && target && location.pathname === '/watch' && pageVideoId() === target) {
      history.replaceState(history.state, '', `/longs/${target}`);
    }
  }

  const videoIdInUrl = (url) => (url.pathname === '/watch'
    ? url.searchParams.get('v')
    : url.pathname.match(/^\/longs\/([\w-]{11})/)?.[1] ?? null);

  // Back and Forward step through the videos you scrolled past (each is a history entry, as with
  // Shorts). The browser announces where Back/Forward is going before YouTube reacts or changes
  // the address, so this works whichever happens first, and whether the entry reads /longs/ID or
  // /watch?v=ID.
  window.navigation?.addEventListener('navigate', (e) => {
    if (e.navigationType !== 'traverse') return;
    const url = new URL(e.destination.url);
    traversal = { id: videoIdInUrl(url), longs: url.pathname.startsWith('/longs/'), at: performance.now() };
    // Back from inside Longs leaves Longs in one step, like leaving the Shorts page, instead of
    // stepping through every video: skip to the entry before Longs (usually Home).
    const to = e.destination.index;
    if (isOpen && !exitingTo && longsFirstEntry >= 0 && to >= longsFirstEntry && to < navigation.currentEntry.index) {
      const exit = navigation.entries()[longsFirstEntry - 1];
      if (!exit) return;
      exitingTo = exit.key;
      if (e.cancelable) {
        e.preventDefault();
        navigation.traverseTo(exit.key);
      } // otherwise the popstate handler below continues the jump
    }
  });
  window.addEventListener('popstate', () => {
    if (exitingTo) {
      if (navigation.currentEntry.key !== exitingTo) {
        markOwnNavigation();
        navigation.traverseTo(exitingTo);
        return;
      }
      exitingTo = null;
      close({ keepUrl: true });
      return;
    }
    if (!traversal || performance.now() - traversal.at > 2000) {
      traversal = { id: videoIdInUrl(location), longs: location.pathname.startsWith('/longs/'), at: performance.now() };
    }
    // Back/Forward to anything else leaves Longs. YouTube restores some pages from its cache
    // without announcing a navigation, so don't wait for yt-navigate-start.
    if (!followTraversal()) close({ keepUrl: true });
  }, true);

  // A Back/Forward that lands on a video from this Longs session (or a /longs/ address) stays in
  // Longs. Returns whether it did.
  function followTraversal() {
    const t = traversal && performance.now() - traversal.at < 2000 ? traversal : null;
    if (!t?.id) return false;
    if (isOpen && queue.some((v) => v.id === t.id)) {
      followHistory(t.id);
      return true;
    }
    if (!isOpen && t.longs) {
      markOwnNavigation();
      open({ startId: t.id });
      return true;
    }
    return false;
  }

  function followHistory(id) {
    markOwnNavigation();
    if (queue[index]?.id === id) return;
    const i = queue.findIndex((v) => v.id === id);
    if (i === -1) return;
    direction = Math.sign(i - index) || 1;
    index = i;
    moving = true;
    command('pauseVideo');
    stage.classList.remove('ad');
    renderSlides();
    setIndex(index);
    clearTimeout(loadTimer);
    loadTimer = setTimeout(loadCurrent, SLIDE_MS);
  }

  document.addEventListener('click', (e) => {
    if (!isOpen) return;
    const path = e.composedPath();
    if (path.some((el) => el instanceof Element && el.classList.contains('yt-longs-guide-entry'))) return;
    if (path.some((el) => el instanceof Element && el.matches('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer'))) close({ keepUrl: true });
  }, true);

  // ---------- "Longs" in YouTube's sidebar, right under Shorts ----------

  function makeGuideEntry(kind) {
    const entry = document.createElement('div');
    entry.className = 'yt-longs-guide-entry';
    entry.dataset.kind = kind;
    const entryShadow = entry.attachShadow({ mode: 'open' });
    entryShadow.innerHTML = `<link rel="stylesheet" href="${CSS_URL}">
      <a class="guide guide-${kind}" href="/longs" title="Longs" aria-label="Longs">${icon('longs')}<span>Longs</span></a>`;
    entryShadow.querySelector('a').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      open();
    });
    return entry;
  }

  // The full sidebar's Shorts link has no href, so match it by title too, and if YouTube renames
  // it, use the entry right after Home.
  function findShortsEntry(selector) {
    const entries = [...document.querySelectorAll(selector)];
    return entries.find((el) => el.querySelector(':scope > a[href^="/shorts"], :scope > a[title="Shorts"]'))
      ?? entries.find((el) => el.querySelector(':scope > a[href="/"]'))?.nextElementSibling;
  }

  function ensureGuideEntries() {
    const theme = currentTheme();
    for (const [kind, selector] of [['full', 'ytd-guide-entry-renderer'], ['mini', 'ytd-mini-guide-entry-renderer']]) {
      const shorts = findShortsEntry(selector);
      if (!shorts || shorts.classList.contains('yt-longs-guide-entry')) continue;
      let entry = shorts.nextElementSibling;
      if (!entry?.classList.contains('yt-longs-guide-entry')) {
        document.querySelectorAll(`.yt-longs-guide-entry[data-kind="${kind}"]`).forEach((el) => el.remove());
        entry = makeGuideEntry(kind);
        shorts.after(entry);
      }
      entry.dataset.theme = theme;
      entry.shadowRoot.querySelector('a').classList.toggle('active', isOpen);
    }
  }
  setInterval(() => {
    ensureGuideEntries();
    if (isOpen && !ownNavigation) showLongsUrl();
  }, 1000);
  ensureGuideEntries();

  // ---------- Toolbar button / shortcut ----------

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'yt-longs:toggle') isOpen ? close() : open();
  });

  // youtube.com/longs/ID links (redirected by rules.json) and the toolbar button on another site
  // arrive as #yt-longs or #yt-longs=ID. Wait for YouTube's sidebar so the layout matches.
  const startHash = location.hash.match(/^#yt-longs(?:=([\w-]{11}))?$/);
  if (startHash) {
    history.replaceState(history.state, '', location.pathname + location.search);
    const startedAt = Date.now();
    const waitForApp = setInterval(() => {
      const app = document.querySelector('ytd-app');
      const ready = app?.hasAttribute('guide-persistent-and-visible') || app?.hasAttribute('mini-guide-visible');
      if (ready || Date.now() - startedAt > 4000) {
        clearInterval(waitForApp);
        open({ startId: startHash[1] ?? null });
      }
    }, 200);
  }
})();
