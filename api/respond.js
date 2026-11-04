import { getSupabase } from './_lib/supabase.js';
import { sendMail, esc } from './_lib/mail.js';
import { fmtTime, fmtDateLong } from '../src/lib/schedule.js';

const page = body =>
  `<body style="font-family:sans-serif;max-width:420px;margin:60px auto;text-align:center">${body}</body>`;

export default async function handler(req, res){
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const { token, action } = req.query;

  if (!/^[0-9a-f-]{36}$/i.test(token || '') || !['accept', 'decline'].includes(action))
    return res.status(400).end(page('Invalid link'));

  const db = getSupabase();
  if (!db) return res.status(503).end(page('Backend not configured'));

  const { data: b } = await db.from('bookings').select('*').eq('token', token).maybeSingle();
  if (!b) return res.status(404).end(page('Booking not found'));
  if (b.status !== 'pending')
    return res.end(page(`<h3>Already ${esc(b.status)}.</h3>No changes made.`));

  const when = fmtDateLong(b.booking_date) + ' at ' + fmtTime(b.start_min);

  if (req.method !== 'POST')
    return res.end(page(`
      <h3>${action === 'accept' ? 'Accept' : 'Decline'} booking ${esc(b.ref)}?</h3>
      <p>${esc(b.name)}<br>${esc(b.cut_name)}<br><b>${when}</b></p>
      <form method="POST"><button style="padding:12px 24px;font-size:16px">Confirm ${action}</button></form>`));

  const status = action === 'accept' ? 'confirmed' : 'declined';
  const { data: updated } = await db.from('bookings')
    .update({ status }).eq('id', b.id).eq('status', 'pending').select('id');
  if (!updated?.length) return res.end(page('Already handled.'));

  await sendMail({
    to: b.email,
    subject: status === 'confirmed' ? `✅ Booking confirmed (${b.ref})` : `Booking update (${b.ref})`,
    html: status === 'confirmed'
      ? `<p>Hi ${esc(b.name)}, your <b>${esc(b.cut_name)}</b> on <b>${when}</b> is confirmed. See you!</p>`
      : `<p>Hi ${esc(b.name)}, sorry, we can't do <b>${when}</b>. Please book another time.</p>`
  });

  res.end(page(`<h2>Booking ${status}.</h2>Customer notified.`));
}