// Brevo transactional email — Vercel serverless function
// POST /api/send-rsvp
// Environment (set in Vercel dashboard):
//   BREVO_API_KEY     — required, from Brevo account
//   BREVO_TO_EMAIL    — required, where RSVPs land
//   BREVO_SENDER_EMAIL — optional, defaults to BREVO_TO_EMAIL

export default async function handler(req, res) {
  // CORS headers (allows testing from any origin)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fullname, email, attendance, message, lang } = req.body;

  // Basic validation
  if (!fullname || !email || !attendance) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const toEmail = process.env.BREVO_TO_EMAIL;
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey || !toEmail) {
    console.error('Missing BREVO_API_KEY or BREVO_TO_EMAIL env vars');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Language-dependent content
  const isSr = lang === 'sr' || attendance === 'da' || attendance === 'ne';
  const subject = isSr
    ? 'Helvetas — 10 godina u Srbiji — nova potvrda dolaska'
    : 'Helvetas — 10 years in Serbia — new RSVP';
  const title = isSr ? 'Potvrda dolaska' : 'RSVP';
  const nameLabel = isSr ? 'Ime i prezime' : 'Name';
  const emailLabel = isSr ? 'Email' : 'Email';
  const attendanceLabel = isSr ? 'Dolazak' : 'Attendance';
  const messageLabel = isSr ? 'Poruka' : 'Message';
  const yesLabel = isSr ? 'Da' : 'Yes';
  const noLabel = isSr ? 'Ne' : 'No';
  const fromName = isSr ? 'Helvetas RSVP obrazac' : 'Helvetas RSVP form';

  const attendanceText = (attendance === 'da' || attendance === 'yes') ? yesLabel : noLabel;

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#A62C32;padding:16px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:20px">${title}</h1>
      </div>
      <div style="padding:20px;background:#f9f9f9;border:1px solid #ddd">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:10px;border:1px solid #ddd;background:#005D87;color:#fff;font-weight:bold;width:40%">${nameLabel}</td>
            <td style="padding:10px;border:1px solid #ddd;background:#fff">${fullname}</td>
          </tr>
          <tr>
            <td style="padding:10px;border:1px solid #ddd;background:#005D87;color:#fff;font-weight:bold">${emailLabel}</td>
            <td style="padding:10px;border:1px solid #ddd;background:#fff">${email}</td>
          </tr>
          <tr>
            <td style="padding:10px;border:1px solid #ddd;background:#005D87;color:#fff;font-weight:bold">${attendanceLabel}</td>
            <td style="padding:10px;border:1px solid #ddd;background:#fff">${attendanceText}</td>
          </tr>
          ${message ? `
          <tr>
            <td style="padding:10px;border:1px solid #ddd;background:#005D87;color:#fff;font-weight:bold">${messageLabel}</td>
            <td style="padding:10px;border:1px solid #ddd;background:#fff">${message}</td>
          </tr>` : ''}
        </table>
      </div>
    </div>
  `;

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: fromName,
          email: process.env.BREVO_SENDER_EMAIL || toEmail,
        },
        to: [{ email: toEmail, name: 'Helvetas' }],
        subject,
        htmlContent,
        replyTo: { email, name: fullname },
      }),
    });

    const result = await response.json();

    if (response.ok) {
      console.log('Brevo success:', result.messageId);
      return res.status(200).json({
        success: true,
        messageId: result.messageId,
      });
    }

    // Pokaži tačnu Brevo grešku u logu
    console.error('Brevo API error:', response.status, JSON.stringify(result));
    return res.status(500).json({
      error: result.message || 'Failed to send email',
    });
  } catch (err) {
    console.error('RSVP send error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
