// GET /api/discord-channels
// Returns channels for the configured Discord guild using the server-side bot token.

const TYPE_ICON = {
  0: '#',
  2: '🔊',
  5: '📢',
  13: '🎙️',
  15: '🗂️',
};

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!botToken || !guildId) {
    return res.status(500).json({ error: 'Discord bot is not configured on the server yet.' });
  }

  try {
    const channelsRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    const channels = await channelsRes.json();
    if (!channelsRes.ok) {
      return res.status(channelsRes.status).json({ error: channels.message || 'Could not fetch channels.' });
    }

    const categories = channels.filter(c => c.type === 4).sort((a, b) => a.position - b.position);
    const rest = channels.filter(c => c.type !== 4).sort((a, b) => a.position - b.position);
    const groups = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      channels: rest.filter(c => c.parent_id === cat.id).map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        icon: TYPE_ICON[c.type] || '#',
      })),
    }));

    const uncategorized = rest.filter(c => !c.parent_id).map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      icon: TYPE_ICON[c.type] || '#',
    }));

    if (uncategorized.length) groups.unshift({ id: 'uncategorized', name: 'Channels', channels: uncategorized });

    res.setHeader('Cache-Control', 'private, max-age=30');
    return res.status(200).json({ groups });
  } catch (err) {
    console.error('Discord channel error:', err);
    return res.status(500).json({ error: 'Unexpected error talking to Discord.' });
  }
};
