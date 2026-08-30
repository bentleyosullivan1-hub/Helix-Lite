// POST /api/discord-callback
// Body: { code, redirect_uri }
//
// Exchanges the OAuth2 "code" for an access token and fetches the user's
// Discord profile. The client secret never leaves the server.
//
// Required Vercel environment variables:
//   DISCORD_CLIENT_ID
//   DISCORD_CLIENT_SECRET

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { code, redirect_uri } = req.body || {};

  if (!code || !redirect_uri) {
    res.status(400).json({ error: "Missing code or redirect_uri" });
    return;
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    res.status(500).json({
      error: "Discord isn't configured on the server yet (missing DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET).",
    });
    return;
  }

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      res.status(400).json({ error: tokenData.error_description || "Token exchange failed." });
      return;
    }

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const user = await userRes.json();

    if (!userRes.ok) {
      res.status(400).json({ error: "Could not fetch your Discord profile." });
      return;
    }

    const avatar = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith("a_") ? "gif" : "png"}`
      : `https://cdn.discordapp.com/embed/avatars/${Number(user.discriminator || "0") % 5}.png`;

    res.status(200).json({
      id: user.id,
      username: user.username,
      global_name: user.global_name || null,
      discriminator: user.discriminator,
      avatar,
    });
  } catch (err) {
    res.status(500).json({ error: "Unexpected error talking to Discord." });
  }
};
