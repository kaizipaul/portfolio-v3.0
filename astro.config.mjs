import { defineConfig, envField } from 'astro/config';

import vercel from '@astrojs/vercel';

import tailwind from '@astrojs/tailwind';
import compress from 'astro-compress';
import sitemap from '@astrojs/sitemap';
import remarkToc from 'remark-toc';
import { rehypeAccessibleEmojis } from 'rehype-accessible-emojis';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';



export default defineConfig({

    markdown: {
        remarkPlugins: [ [remarkToc, { heading: "contents", maxDepth: 3 } ] ],
        rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, { behavior: 'append' }]],
        gfm: true,
        smartypants: true,
      },


    output: 'static',
    // Static by default; routes with `prerender = false` (e.g. /api/now-playing) run on Vercel functions
    adapter: vercel(),
    trailingSlash: 'always',
    site: 'https://devidev.io',

    env: {
        schema: {
            SPOTIFY_CLIENT_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
            SPOTIFY_CLIENT_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
            SPOTIFY_REFRESH_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
        },
    },

    // Single page, no prefetch needed
    prefetch: false,

    integrations: [

        tailwind(),
        sitemap(),
        compress({
            CSS: true,
            SVG: false,
            Image: false,
            HTML: {
                "html-minifier-terser": {
                    collapseWhitespace: true,
                    // collapseInlineTagWhitespace: true, // It breaks display-inline / flex-inline text
                    minifyCSS: true,
                    minifyJS: true,
                    removeComments: true,
                    removeEmptyAttributes: true,
                    // removeEmptyElements: true, // It removes sometimes SVGs
                    removeRedundantAttributes: true
                },
            },
            JavaScript: {
                'terser': {
                    compress: {
                        drop_console: true,
                        drop_debugger: true,
                    }
                }
            }
        })
    ]
});