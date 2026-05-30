// functions/api/calendar/[slug].js
// GET /api/calendar/:slug — public iCalendar feed for a club

function pad(n) { return String(n).padStart(2, '0'); }

function fmtCompact(dateStr, timeStr) {
  const [y, mo, d] = dateStr.split('-');
  if (!timeStr) return `${y}${mo}${d}`;
  const [h, m] = timeStr.split(':');
  return `${y}${mo}${d}T${pad(h)}${pad(m)}00`;
}

function nextDay(dateStr) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, mo - 1, d + 1);
  return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}`;
}

function addTwoHours(dateStr, timeStr) {
  const [y, mo, d] = dateStr.split('-');
  const [h, m] = timeStr.split(':').map(Number);
  const endH = (h + 2) % 24;
  return `${y}${mo}${d}T${pad(endH)}${pad(m)}00`;
}

function escICS(str) {
  return String(str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// Fold long lines per RFC 5545 (max 75 octets)
function fold(line) {
  const out = [];
  while (line.length > 75) {
    out.push(line.slice(0, 75));
    line = ' ' + line.slice(75);
  }
  out.push(line);
  return out.join('\r\n');
}

function buildICS(club, meetings) {
  const now = new Date();
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth()+1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CubingClubs.net//Club Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    fold(`X-WR-CALNAME:${escICS(club.name)}`),
    fold(`X-WR-CALDESC:Meetings for ${escICS(club.name)} on CubingClubs.net`),
    'X-WR-TIMEZONE:America/New_York',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
  ];

  for (const m of meetings) {
    const allDay = !m.time;
    const dtstart = fmtCompact(m.date, m.time || null);
    let dtend;
    if (allDay) {
      dtend = nextDay(m.date);
    } else if (m.end_time) {
      dtend = fmtCompact(m.date, m.end_time);
    } else {
      dtend = addTwoHours(m.date, m.time);
    }

    const title = (m.meeting_type || 'Club Meeting') + ` — ${club.name}`;
    const locationParts = [m.location_name, m.address, m.address_line2, m.city, m.state, m.country].filter(Boolean);
    const location = locationParts.join(', ');
    const uid = `meeting-${m.id}@cubingclubs.net`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(allDay ? `DTSTART;VALUE=DATE:${dtstart}` : `DTSTART:${dtstart}`);
    lines.push(allDay ? `DTEND;VALUE=DATE:${dtend}` : `DTEND:${dtend}`);
    lines.push(fold(`SUMMARY:${escICS(title)}`));
    if (location) lines.push(fold(`LOCATION:${escICS(location)}`));
    if (m.notes) lines.push(fold(`DESCRIPTION:${escICS(m.notes)}`));
    const url = `https://cubingclubs.net/club/${club.slug}`;
    lines.push(`URL:${url}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export async function onRequestGet({ params, env }) {
  const slug = params.slug;
  if (!slug) return new Response('Not found', { status: 404 });

  const club = await env.DB.prepare(
    `SELECT id, name, slug, city, state, country
     FROM clubs WHERE slug = ? AND approved = 1 AND visible = 1`
  ).bind(slug).first();

  if (!club) return new Response('Club not found', { status: 404 });

  const { results: meetings } = await env.DB.prepare(
    `SELECT id, meeting_type, date, time, end_time,
            location_name, address, address_line2, city, state, country, notes
     FROM meetings
     WHERE club_id = ?
     ORDER BY date ASC, time ASC`
  ).bind(club.id).all();

  const ics = buildICS(club, meetings);

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'public, max-age=21600', // 6 hours
    },
  });
}
