// Save an unfinished game whenever it might be lost: the app going to the background or being
// closed (phones often kill backgrounded apps without warning), or leaving the game screen.
// Returns a cleanup function; call it from the game's unmount.
export function autosave(saveFn) {
  const onHide = () => { if (document.visibilityState === 'hidden') saveFn(); };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', saveFn);
  return () => {
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', saveFn);
    saveFn();
  };
}
