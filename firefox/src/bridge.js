// Runs in YouTube's own page context ("world": "MAIN") so YT Longs can use YouTube's real player
// and its in-page navigation, which the extension's isolated content script can't call directly.
// It only accepts messages posted by the page itself (which includes the content script).
(() => {
  if (window.__ytLongsBridge) return;
  window.__ytLongsBridge = true;

  const PLAYER_METHODS = new Set(['playVideo', 'pauseVideo', 'seekTo', 'setVolume', 'mute', 'unMute']);
  const player = () => document.getElementById('movie_player');
  let reportTimer = 0;

  // Same event YouTube's own links fire, so the switch happens without reloading the page.
  function navigate(videoId, start = 0) {
    const t = Math.floor(start);
    const url = `/watch?v=${videoId}${t > 0 ? `&t=${t}s` : ''}`;
    const app = document.querySelector('ytd-app');
    if (!app) { location.assign(url); return; }
    app.dispatchEvent(new CustomEvent('yt-navigate', {
      bubbles: true,
      composed: true,
      detail: {
        endpoint: {
          commandMetadata: { webCommandMetadata: { url, webPageType: 'WEB_PAGE_TYPE_WATCH', rootVe: 3832 } },
          watchEndpoint: { videoId, ...(t > 0 && { startTimeSeconds: t }) },
        },
      },
    }));
  }

  function report() {
    const p = player();
    const error = p?.querySelector('.ytp-error');
    window.postMessage({
      ytLongs: 'state',
      state: {
        videoId: p?.getVideoData?.()?.video_id ?? null,
        playerState: p?.getPlayerState?.() ?? -1,
        time: p?.getCurrentTime?.() ?? 0,
        duration: p?.getDuration?.() ?? 0,
        volume: p?.getVolume?.() ?? 100,
        muted: p?.isMuted?.() ?? false,
        ad: !!p?.classList.contains('ad-showing'),
        error: !!error && error.getClientRects().length > 0,
        storyboard: p?.getPlayerResponse?.()?.storyboards?.playerStoryboardSpecRenderer?.spec ?? null,
      },
    }, location.origin);
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.data?.ytLongs !== 'command') return;
    const { name, args = [] } = e.data;
    if (name === 'navigate') {
      navigate(...args);
    } else if (name === 'report') {
      clearInterval(reportTimer);
      reportTimer = args[0] ? setInterval(report, 200) : 0;
    } else if (PLAYER_METHODS.has(name)) {
      player()?.[name]?.(...args);
    }
  });
})();
