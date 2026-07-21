import { createClient } from "@/lib/supabase/server";

function escapeICS(text: string): string {
  return text.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
}

function formatDate(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

export async function GET(request: Request, { params }: { params: { token: string } }) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_calendar_feed", { p_token: params.token });

  if (error || !data) {
    return new Response("Ungültiger Kalender-Link.", { status: 404 });
  }

  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const events = (data as any[])
    .map((d, i) => {
      const uid = `${params.token}-${i}@insolvenzflow`;
      const dt = formatDate(d.due_date);
      return [
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${now}`,
        `DTSTART;VALUE=DATE:${dt}`,
        `DTEND;VALUE=DATE:${dt}`,
        `SUMMARY:${escapeICS(d.title)} (${escapeICS(d.case_number ?? "")})`,
        "END:VEVENT",
      ].join("\r\n");
    })
    .join("\r\n");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//InsolvenzFlow//Fristenkalender//DE",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:InsolvenzFlow Fristen",
    events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="fristen.ics"',
    },
  });
}
