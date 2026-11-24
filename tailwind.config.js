/** @type {import('tailwindcss').Config} */
export default {
    content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: '#F43F5E',
                // Per-theme values live in src/styles/global.scss
                console: {
                    bg: 'rgb(var(--console-bg) / <alpha-value>)',
                    panel: 'rgb(var(--console-panel) / <alpha-value>)',
                    line: 'rgb(var(--console-line) / <alpha-value>)',
                    green: 'rgb(var(--console-green) / <alpha-value>)'
                }
            }
        }
    }
};
