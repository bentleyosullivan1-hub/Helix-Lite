// POST /api/discord-callback
// Body: { code, redirect_uri }
// Exchanges a Discord OAuth2 authorization code server-side.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, redirect_uri } = req.body || {};
  if (typeof code !== 'string' || !code || typeof redirect_uri !== 'string' || !redirect_uri) {
    return res.status(400).json({ error: 'Missing code or redirect_uri' });
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Discord is not configured on the server yet.' });
  }

  // Only allow callbacks back to this Vercel deployment (or an explicitly
  // configured public site URL). This prevents arbitrary redirect URIs.
  const allowedOrigin = process.env.PUBLIC_SITE_URL || `https://${req.headers.host}`;
  let redirect;
  let allowed;
  try {
    redirect = new URL(redirect_uri);
    allowed = new URL(allowedOrigin);
  } catch {
    return res.status(400).json({ error: 'Invalid redirect URI.' });
  }
  if (redirect.origin !== allowed.origin) {
    return res.status(400).json({ error: 'Redirect URI is not allowed.' });
  }

  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      return res.status(400).json({ error: tokenData.error_description || 'Token exchange failed.' });
    }

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const user = await userRes.json();
    if (!userRes.ok) {
      return res.status(400).json({ error: 'Could not fetch your Discord profile.' });
    }

    const avatar = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith('a_') ? 'gif' : 'png'}`
      : `https://cdn.discordapp.com/embed/avatars/${Number(user.discriminator || '0') % 5}.png`;

    return res.status(200).json({
      id: user.id,
      username: user.username,
      global_name: user.global_name || null,
      discriminator: user.discriminator,
      avatar,
    });
  } catch (err) {
    console.error('Discord OAuth error:', err);
    return res.status(500).json({ error: 'Unexpected error talking to Discord.' });
  }
};
