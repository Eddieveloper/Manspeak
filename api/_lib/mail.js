import nodemailer from 'nodemailer';

let transport = null;

export const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

/** Returns true if sent. Never throws, so a mail failure can't break a booking. */
export async function sendMail(opts){
  const user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass){ console.error('mail not configured'); return false; }
  if (!transport) transport = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  try { await transport.sendMail({ from: user, ...opts }); return true; }
  catch(e){ console.error('mail failed', e); return false; }
}