import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

export interface DeliveryRecipient {
  fullName: string;
  email: string | null;
  phone: string | null;
}

const appBaseUrl = env.APP_BASE_URL ?? env.WEB_ORIGIN;

const sendEmail = async (
  recipient: DeliveryRecipient,
  subject: string,
  text: string,
  actionUrl?: string,
) => {
  if (!recipient.email || !env.SMTP_HOST) return false;
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  await transport.sendMail({
    from: env.SMTP_FROM,
    to: recipient.email,
    subject,
    text: `${text}${actionUrl ? `\n\nContinue: ${actionUrl}` : ''}`,
  });
  return true;
};

const sendSms = async (recipient: DeliveryRecipient, text: string, actionUrl?: string) => {
  if (
    !recipient.phone ||
    !env.TWILIO_ACCOUNT_SID ||
    !env.TWILIO_AUTH_TOKEN ||
    !env.TWILIO_FROM_NUMBER
  )
    return false;
  const body = new URLSearchParams({
    To: recipient.phone,
    From: env.TWILIO_FROM_NUMBER,
    Body: `${text}${actionUrl ? ` ${actionUrl}` : ''}`,
  });
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    },
  );
  if (!response.ok) throw new Error(`SMS delivery failed with status ${response.status}.`);
  return true;
};

const deliver = async (
  recipient: DeliveryRecipient,
  subject: string,
  text: string,
  actionUrl?: string,
) => {
  try {
    const delivered = await Promise.all([
      sendEmail(recipient, subject, text, actionUrl),
      sendSms(recipient, text, actionUrl),
    ]);
    if (!delivered.some(Boolean) && env.NODE_ENV === 'production')
      console.warn('No external notification provider is configured for this recipient.');
  } catch (error) {
    console.error('External notification delivery failed.', error);
  }
};

export const deliveryService = {
  accountLink(
    recipient: DeliveryRecipient,
    subject: string,
    message: string,
    path: string,
    token: string,
  ) {
    const url = `${appBaseUrl}${path}?token=${encodeURIComponent(token)}`;
    return deliver(recipient, subject, message, url);
  },
  notification(
    recipient: DeliveryRecipient,
    subject: string,
    message: string,
    href?: string | null,
  ) {
    const url = href ? `${appBaseUrl}${href}` : undefined;
    return deliver(recipient, subject, message, url);
  },
};
