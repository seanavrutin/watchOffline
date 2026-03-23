const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendReport(subject, html) {
  const to = process.env.MAIL_TO;
  if (!to) {
    console.warn('[mailer] MAIL_TO not configured, skipping email');
    return;
  }

  try {
    await resend.emails.send({
      from: 'WatchOffline <onboarding@resend.dev>',
      to,
      subject,
      html,
    });
    console.log(`[mailer] Report sent to ${to}`);
  } catch (err) {
    console.error('[mailer] Failed to send report:', err.message);
  }
}

function buildReportHtml(results) {
  const downloaded = results.filter(r => r.outcome === 'downloaded');
  const failed = results.filter(r => r.outcome === 'failed');
  const skipped = results.filter(r => r.outcome === 'not_aired');

  const date = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  const section = (title, emoji, items, renderItem) => {
    if (items.length === 0) return '';
    return `
      <h3 style="margin:16px 0 8px">${emoji} ${title} (${items.length})</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        ${items.map(renderItem).join('')}
      </table>
    `;
  };

  const downloadedHtml = section('Downloaded', '&#9989;', downloaded, (r) => `
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:6px 8px;font-weight:600">${r.show} ${r.key}</td>
      <td style="padding:6px 8px">${r.epName || ''}</td>
      <td style="padding:6px 8px;color:#666">seeders: ${r.seeders || '?'}</td>
      <td style="padding:6px 8px;color:${r.subtitlesSaved?.length ? '#4caf50' : '#f44336'}">
        ${r.subtitlesSaved?.length ? '&#128221; ' + r.subtitlesSaved.join(', ') : '&#9888; No Hebrew subs saved'}
      </td>
    </tr>
  `);

  const failedHtml = section('Failed', '&#10060;', failed, (r) => `
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:6px 8px;font-weight:600">${r.show} ${r.key}</td>
      <td style="padding:6px 8px">${r.epName || ''}</td>
      <td style="padding:6px 8px;color:#999" colspan="2">${r.reason || 'Unknown error'}</td>
    </tr>
  `);

  const skippedHtml = section('Not Yet Aired', '&#9197;', skipped, (r) => `
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:6px 8px;font-weight:600">${r.show} ${r.key}</td>
      <td style="padding:6px 8px">${r.epName || ''}</td>
      <td style="padding:6px 8px;color:#999" colspan="2">${r.airInfo || 'TBA'}</td>
    </tr>
  `);

  return `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto">
      <h2 style="color:#00897b">WatchOffline Daily Report &mdash; ${date}</h2>
      <p style="color:#666;font-size:14px">
        &#128202; Summary: ${downloaded.length} downloaded, ${failed.length} failed, ${skipped.length} not aired
      </p>
      ${downloadedHtml}
      ${failedHtml}
      ${skippedHtml}
      ${results.length === 0 ? '<p style="color:#999">No tracked seasons with pending episodes.</p>' : ''}
    </div>
  `;
}

module.exports = { sendReport, buildReportHtml };
