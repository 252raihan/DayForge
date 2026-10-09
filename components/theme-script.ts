/* Inline pre-paint script: sets the `dark` class on <html> before the browser
   paints, so a dark-mode user never sees a white flash on load.
   Kept dependency-free and deliberately small. `suppressHydrationWarning` on
   <html> tells React this attribute is changed outside of React. */
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = stored ? stored === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  } catch (e) {
    /* localStorage unavailable (private mode) - fall back to light. */
  }
})();
`;

export default themeScript;
