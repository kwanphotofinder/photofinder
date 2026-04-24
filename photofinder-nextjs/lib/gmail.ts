import nodemailer from 'nodemailer';

export async function sendPhotoMatchSummaryEmail(
  toEmail: string,
  userName: string,
  eventName: string,
  matchCount: number,
  actionUrl: string
) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.warn('GMAIL_USER or GMAIL_APP_PASSWORD is missing. Skipping email notification.');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user,
      pass,
    },
  });

  const subject = `📸 We found ${matchCount} photo${matchCount === 1 ? '' : 's'} of you at ${eventName}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
      <h2 style="color: #2563eb; margin-top: 0;">Great news, ${userName}!</h2>
      <p style="font-size: 16px; line-height: 1.5;">
        We found <strong>${matchCount}</strong> new photo${matchCount === 1 ? '' : 's'} of you at <strong>${eventName}</strong>.
      </p>

      <div style="margin: 30px 0;">
        <a href="${actionUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; text-align: center;">
          View Your Photos
        </a>
      </div>

      <p style="color: #666; font-size: 14px; line-height: 1.5;">
        If the button above doesn't work, copy and paste this link into your browser:<br>
        <a href="${actionUrl}" style="color: #2563eb; word-break: break-all;">${actionUrl}</a>
      </p>

      <hr style="border: none; border-top: 1px solid #eaeaea; margin: 30px 0;">

      <p style="color: #888; font-size: 12px; text-align: center; line-height: 1.5;">
        You are receiving this email because you opted in to email notifications.<br>
        You can change your preferences at any time in your account settings.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Photo Finder" <${user}>`,
      to: toEmail,
      subject,
      html,
    });
    console.log(`[EMAIL] Sent summary to ${toEmail}`);
  } catch (error) {
    console.error('[EMAIL] Error sending email:', error);
  }
}
