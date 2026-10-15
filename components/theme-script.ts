/* Inline pre-paint script: sets the `dark` class on <html> before the browser
   paints, so a dark-mode user never sees a white flash on load.
   Kept dependency-free and deliberately small. `suppressHydrationWarning` on
   <html> tells React this attribute is changed outside of React. */
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    // "system" (or nothing stored at all) follows the OS setting. The Settings
    // page writes 'light' / 'dark' / removes the key, so all three choices are
    // expressed with this single key.
    var isDark = stored === 'dark' || (stored !== 'light' && prefersDark);
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  } catch (e) {
    /* localStorage unavailable (private mode) - fall back to the OS setting. */
    try {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      }
    } catch (inner) {
      /* nothing more we can do */
    }
  }
})();
`;

export default themeScript;
