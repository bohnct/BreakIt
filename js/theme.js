// Night (black background, white accents) or Day (the reverse). index.html applies the saved
// theme before first paint; this keeps it and the browser chrome colour in sync afterwards.
export function applyTheme(theme) {
  const day = theme === 'day';
  document.documentElement.dataset.theme = day ? 'day' : 'night';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', day ? '#ffffff' : '#000000');
}
