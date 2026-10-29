/**
 * Builds dist/styles.css: only the utility classes the kit's components use.
 * No preflight (Tailwind's reset), so importing it does not restyle the app.
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  corePlugins: { preflight: false, container: false },
  theme: { extend: {} },
  plugins: [],
};
