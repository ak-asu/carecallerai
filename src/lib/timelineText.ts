import type { TimelineEvent } from "@/types";

type TimelineTranslator = (
  key: any,
  values?: Record<string, string | number | Date>,
) => string;

function fallbackEventType(eventType: string) {
  return eventType.replace(/_/g, " ");
}

export function getTimelineEventLabel(
  eventType: string,
  t: TimelineTranslator,
) {
  switch (eventType) {
    case "call":
      return t("type.call");
    case "correction":
      return t("type.correction");
    case "appointment":
      return t("type.appointment");
    case "symptom_report":
      return t("type.symptom_report");
    case "escalation":
      return t("type.escalation");
    case "savings_found":
      return t("type.savings_found");
    default:
      return fallbackEventType(eventType);
  }
}

export function getTimelineEventContent(
  event: TimelineEvent,
  t: TimelineTranslator,
) {
  const content = event.content as Record<string, unknown>;

  switch (event.event_type) {
    case "savings_found": {
      const drug = (content.drugName as string) ?? t("content.medication");
      const count = (content.links as unknown[])?.length ?? 0;

      return t("content.savingsFound", { drug, count });
    }
    case "call":
      return (content.summary as string) ?? t("content.callCompleted");
    case "escalation":
      return (
        (content.reason as string) ??
        (content.summary as string) ??
        t("content.escalationTriggered")
      );
    case "correction":
      return (
        (content.summary as string) ??
        (content.description as string) ??
        t("content.correctionSubmitted")
      );
    case "appointment": {
      if (content.action === "confirmed")
        return t("content.appointmentConfirmed");
      if (content.action === "cancelled")
        return t("content.appointmentCancelled");
      if (content.action === "rescheduled") {
        return content.reason
          ? t("content.appointmentRescheduledWithReason", {
              reason: content.reason as string,
            })
          : t("content.appointmentRescheduled");
      }

      return (
        (content.summary as string) ??
        (content.description as string) ??
        t("content.appointmentUpdated")
      );
    }
    case "symptom_report":
      return (
        (content.summary as string) ??
        (content.description as string) ??
        t("content.symptomReported")
      );
    default:
      return (
        (content.summary as string) ??
        (content.description as string) ??
        (content.text as string) ??
        fallbackEventType(event.event_type)
      );
  }
}
