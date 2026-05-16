/**
 * Email sending via Nodemailer (SMTP).
 *
 * Configuration is entirely environment-based — no SDK vendor lock-in.
 * To switch providers (Mailgun, SendGrid, etc.), just change env vars.
 *
 * Required environment variables:
 *   SMTP_HOST      — SMTP server hostname
 *   SMTP_PORT      — SMTP port (usually 587 for TLS)
 *   SMTP_USER      — SMTP username / email
 *   SMTP_PASS      — SMTP password
 *   SMTP_FROM      — From: header address
 */

import nodemailer from 'nodemailer';

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

/**
 * Initialize the email transporter lazily (on first use).
 * Throws if required environment variables are missing.
 */
function ensureTransporter() {
	if (transporter) return transporter;

	const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

	if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
		throw new Error(
			'Email not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM'
		);
	}

	transporter = nodemailer.createTransport({
		host: SMTP_HOST,
		port: parseInt(SMTP_PORT),
		secure: parseInt(SMTP_PORT) === 465,
		auth: {
			user: SMTP_USER,
			pass: SMTP_PASS
		}
	});

	return transporter;
}

/**
 * Send an email.
 *
 * @param to       — Recipient email address
 * @param subject  — Email subject
 * @param html     — Email body (HTML)
 * @returns        — Message ID if successful, null if email not configured (dev mode)
 */
export async function sendEmail(
	to: string,
	subject: string,
	html: string
): Promise<string | null> {
	// In development without email config, log instead
	if (!process.env.SMTP_HOST && process.env.NODE_ENV !== 'production') {
		console.log(`[email:dev] To: ${to}\nSubject: ${subject}\n\n${html}\n`);
		return null;
	}

	const transport = ensureTransporter();

	const result = await transport.sendMail({
		from: process.env.SMTP_FROM!,
		to,
		subject,
		html,
		text: html.replace(/<[^>]*>/g, '') // Strip HTML tags for plain text fallback
	});

	return result.messageId;
}

/**
 * Test the email configuration.
 * Sends a test email to a given address.
 * Useful for setup validation.
 */
export async function testEmail(to: string): Promise<boolean> {
	try {
		await sendEmail(
			to,
			'Test Email — bsBB Forum',
			'<p>If you received this, email is configured correctly.</p>'
		);
		return true;
	} catch (err) {
		console.error('[email] test failed:', err);
		return false;
	}
}
