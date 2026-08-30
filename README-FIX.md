# Helix-Lite fixes

Copy these files into the repository, replacing files with the same names. The API files MUST live under `/api` for Vercel serverless routing.

## Vercel environment variables

Required for Discord:
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`

Recommended:
- `PUBLIC_SITE_URL` = `https://helix-lite.vercel.app` (or your actual custom domain)

Optional:
- `HELIX_SUBMIT_WEBHOOK_URL` = a Discord webhook URL used only for application/feedback notifications

Never commit secrets to GitHub.

## Discord OAuth redirect

In the Discord Developer Portal, add:
`https://helix-lite.vercel.app/discord.html`

If you use a custom domain, add that exact `/discord.html` URL too.

## Supabase

Run `supabase-schema.sql` in Supabase SQL Editor. It replaces the recursive profile-admin checks with a SECURITY DEFINER helper and prevents ordinary users from changing `role`, `premium`, `email`, `id`, or `created_at`.

After creating your own account, manually promote it once with the SQL statement at the bottom of the schema.

## Files included

- `api/discord-config.js` — public client-ID config endpoint
- `api/discord-callback.js` — secure OAuth exchange
- `api/discord-channels.js` — server-side channel listing
- `api/submit-form.js` — optional Discord notification endpoint
- `supabase-schema.sql` — hardened RLS/policies
- `vercel.json` — Vercel routing/security headers
- `discord.html` — updated Discord page
