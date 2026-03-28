const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const MAX_SUB_RETRIES_FOR_REPORT = 14;

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

function subsToFlags(subtitlesSaved) {
  if (!subtitlesSaved || subtitlesSaved.length === 0) return '';
  const flags = [];
  for (const name of subtitlesSaved) {
    if (name.includes('.heb.')) flags.push('&#127470;&#127473;');
    else if (name.includes('.eng.')) flags.push('&#127468;&#127463;');
  }
  return flags.join(' ');
}

function buildReportHtml(results) {
  const downloaded = results.filter(r => r.outcome === 'downloaded');
  const downloadedNoSubs = results.filter(r => r.outcome === 'downloaded_no_subs');
  const subsRecovered = results.filter(r => r.outcome === 'subs_recovered');
  const subsSwapped = results.filter(r => r.outcome === 'subs_swapped');
  const subsStillMissing = results.filter(r => r.outcome === 'subs_still_missing');
  const subsGaveUp = results.filter(r => r.outcome === 'subs_gave_up');
  const failed = results.filter(r => r.outcome === 'failed');

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
      <td style="padding:6px 8px">${subsToFlags(r.subtitlesSaved)}</td>
    </tr>
  `);

  const downloadedNoSubsHtml = section('Downloaded (No Hebrew Subs Yet)', '&#9888;', downloadedNoSubs, (r) => `
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:6px 8px;font-weight:600">${r.show} ${r.key}</td>
      <td style="padding:6px 8px">${r.epName || ''}</td>
      <td style="padding:6px 8px;color:#666">seeders: ${r.seeders || '?'}</td>
      <td style="padding:6px 8px;color:#ff9800">Will retry subs daily</td>
    </tr>
  `);

  const subsRecoveredHtml = section('Hebrew Subs Recovered', '&#127881;', subsRecovered, (r) => `
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:6px 8px;font-weight:600">${r.show} ${r.key}</td>
      <td style="padding:6px 8px">${subsToFlags(r.subtitlesSaved)}</td>
    </tr>
  `);

  const subsSwappedHtml = section('Torrent Swapped for Hebrew Subs', '&#128260;', subsSwapped, (r) => `
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:6px 8px;font-weight:600">${r.show} ${r.key}</td>
      <td style="padding:6px 8px;color:#666">seeders: ${r.seeders || '?'}</td>
      <td style="padding:6px 8px">${subsToFlags(r.subtitlesSaved)}</td>
    </tr>
  `);

  const subsStillMissingHtml = section('Hebrew Subs Still Missing', '&#128269;', subsStillMissing, (r) => `
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:6px 8px;font-weight:600">${r.show} ${r.key}</td>
      <td style="padding:6px 8px;color:#999">Retry ${r.retries || '?'} of ${MAX_SUB_RETRIES_FOR_REPORT}</td>
    </tr>
  `);

  const subsGaveUpHtml = section('Hebrew Subs — Gave Up', '&#9940;', subsGaveUp, (r) => `
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:6px 8px;font-weight:600">${r.show} ${r.key}</td>
      <td style="padding:6px 8px;color:#999">${r.reason || 'Max retries reached'}</td>
    </tr>
  `);

  const failedHtml = section('Failed', '&#10060;', failed, (r) => `
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:6px 8px;font-weight:600">${r.show} ${r.key}</td>
      <td style="padding:6px 8px">${r.epName || ''}</td>
      <td style="padding:6px 8px;color:#999" colspan="2">${r.reason || 'Unknown error'}</td>
    </tr>
  `);

  const totalDownloaded = downloaded.length + downloadedNoSubs.length;
  const totalSubsFixes = subsRecovered.length + subsSwapped.length;

  return `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto">
      <h2 style="color:#00897b">WatchOffline Daily Report &mdash; ${date}</h2>
      <p style="color:#666;font-size:14px">
        &#128202; Summary: ${totalDownloaded} downloaded, ${totalSubsFixes} subs fixed, ${failed.length} failed
      </p>
      ${downloadedHtml}
      ${downloadedNoSubsHtml}
      ${subsRecoveredHtml}
      ${subsSwappedHtml}
      ${subsStillMissingHtml}
      ${subsGaveUpHtml}
      ${failedHtml}
      ${results.length === 0 ? '<p style="color:#999">No tracked seasons with pending episodes.</p>' : ''}
    </div>
  `;
}

module.exports = { sendReport, buildReportHtml };
