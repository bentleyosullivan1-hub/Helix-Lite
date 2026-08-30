// POST /api/submit-form
// Optional Discord notification for applications/feedback.
// Supabase remains the source of truth; this endpoint only sends a notification.

function clean(value, max = 2000) {
  return String(value ?? '').trim().slice(0, max);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, fields } = req.body || {};
  if (typeof type !== 'string' || !/^[a-z0-9_-]{1,40}$/i.test(type) || !fields || typeof fields !== 'object' || Array.isArray(fields)) {
    return res.status(400).json({ error: 'Invalid submission.' });
  }

  const webhook = process.env.HELIX_SUBMIT_WEBHOOK_URL;
  if (!webhook) {
    return res.status(204).end();
  }

  const entries = Object.entries(fields).slice(0, 20).map(([key, value]) => ({
    name: clean(key, 100) || 'Field',
    value: clean(value, 1024) || '—',
    inline: false,
  }));

  try {
    const webhookRes = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Helix Applications',
        embeds: [{
          title: `New ${type} submission`,
          color: 0x6de1ff,
          fields: entries,
          timestamp: new Date().toISOString(),
        }],
      }),
    });

    if (!webhookRes.ok) {
      console.error('Submission webhook failed:', webhookRes.status);
      return res.status(502).json({ error: 'Notification delivery failed.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Submission webhook error:', err);
    return res.status(502).json({ error: 'Notification delivery failed.' });
  }
};
