// GET /api/discord-channels
//
// Returns the channels of a single fixed Discord server, grouped by
// category, using a bot token. The bot token never reaches the browser.
//
// Setup:
//   1. Create/reuse a Discord application at discord.com/developers,
//      add a Bot to it, and invite the bot to your server with at least
//      the "View Channels" permission.
//   2. Set these Vercel environment variables:
//        DISCORD_BOT_TOKEN  — the bot's token
//        DISCORD_GUILD_ID   — the ID of the server to list channels for

const TYPE_ICON = {
  0: "#",   // text
  2: "🔊",  // voice
  5: "📢",  // announcement
  13: "🎙️", // stage
  15: "🗂️", // forum
};

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!botToken || !guildId) {
    res.status(500).json({
      error: "Discord bot isn't configured on the server yet (missing DISCORD_BOT_TOKEN / DISCORD_GUILD_ID).",
    });
    return;
  }

  try {
    const channelsRes = await fetch(`https://discord.com/api/guilds/${guildId}/channels`, {
      headers: { Authorization: `Bot ${botToken}` },
    });

    const channels = await channelsRes.json();

    if (!channelsRes.ok) {
      res.status(channelsRes.status).json({ error: channels.message || "Could not fetch channels." });
      return;
    }

    const categories = channels
      .filter((c) => c.type === 4)
      .sort((a, b) => a.position - b.position);

    const rest = channels
      .filter((c) => c.type !== 4)
      .sort((a, b) => a.position - b.position);

    const groups = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      channels: rest
        .filter((c) => c.parent_id === cat.id)
        .map((c) => ({ id: c.id, name: c.name, type: c.type, icon: TYPE_ICON[c.type] || "#" })),
    }));

    const uncategorized = rest
      .filter((c) => !c.parent_id)
      .map((c) => ({ id: c.id, name: c.name, type: c.type, icon: TYPE_ICON[c.type] || "#" }));

    if (uncategorized.length) {
      groups.unshift({ id: "uncategorized", name: "Channels", channels: uncategorized });
    }

    res.status(200).json({ groups });
  } catch (err) {
    res.status(500).json({ error: "Unexpected error talking to Discord." });
  }
};
