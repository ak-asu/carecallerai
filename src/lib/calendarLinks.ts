interface CalendarLinkOptions {
  title: string;
  details?: string;
  startAt: string;
  endAt?: string;
}

function toGoogleCalendarDate(value: string) {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

export function buildGoogleCalendarLink({
  title,
  details,
  startAt,
  endAt,
}: CalendarLinkOptions) {
  const end = endAt
    ? endAt
    : new Date(new Date(startAt).getTime() + 30 * 60 * 1000).toISOString();

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${toGoogleCalendarDate(startAt)}/${toGoogleCalendarDate(end)}`,
  });

  if (details) {
    params.set("details", details);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
