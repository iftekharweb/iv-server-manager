/** @type {import('tailwindcss').Config} */
// Dark is the default theme; `dark:` utilities apply when <html data-theme="dark">.
// Unprefixed utilities are the LIGHT values. The store flips data-theme at runtime.
// Color families: d = dark surfaces, l = light surfaces; plus fixed accent/status hues
// (…L variants are the light-theme-tuned versions).
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/**/*.{js,jsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        d: {
          bg: '#12141a', bg2: '#171a22', bg3: '#1e222c', bd: '#2a2f3a',
          tx: '#e6e9ef', dim: '#8b93a7', hv: '#262c38', ac: '#1a2130',
          term: '#0d0f14', abg: '#1a2338', atx: '#a9c2ff',
        },
        l: {
          bg: '#ffffff', bg2: '#f6f8fa', bg3: '#eef1f4', bd: '#d0d7de',
          tx: '#1f2328', dim: '#656d76', hv: '#e3e8ee', ac: '#dbeafe',
          term: '#ffffff', abg: '#dbeafe', atx: '#0550ae',
        },
        accent: '#5b8cff',
        accentL: '#0969da',
        ok: '#3fb950', amber: '#d29922', danger: '#f85149', gray: '#6e7681',
        okL: '#1a7f37', amberL: '#9a6700', dangerL: '#cf222e', grayL: '#8b949e',
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'system-ui', 'sans-serif'],
        mono: ['Consolas', '"Cascadia Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
