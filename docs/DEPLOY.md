# Deploy

Cloudflare Pages, free tier. Not connected yet — these are the settings to enter when it is.

## Cloudflare Pages project settings

1. Cloudflare dashboard → Workers & Pages → Create → Pages → connect to Git → select this repo.
2. Build settings:
   - Framework preset: **Astro**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `/`
3. Environment variables:
   - `NODE_VERSION` = `22`
4. Deploy. Cloudflare builds on every push to `main` and creates preview deployments for pull
   requests automatically — no extra config needed for that part.

## Domain

Domain is registered at Hostinger: `mustafahasnain.com`. After the Pages project exists, add it
as a custom domain in Cloudflare Pages, then point DNS at Cloudflare (Hostinger's nameservers
changed to Cloudflare's, or a CNAME/ALIAS record per Cloudflare's own instructions for the
project).
