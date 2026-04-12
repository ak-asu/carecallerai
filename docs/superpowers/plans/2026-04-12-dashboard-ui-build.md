# Dashboard UI Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the patient dashboard and clinician per-patient view with all UI sections needed to run every testing-guide scenario, plus fix language switching.

**Architecture:** Eleven focused tasks — language fix first (unblocks all translation verification), then translation keys, then API extensions, then components bottom-up (leaf components before pages), then wire-up tasks for each page. Every task ends with a TypeScript check and commit.

**Tech Stack:** Next.js 15 App Router, React 19, next-intl 4.9.1, Supabase JS v2, Tailwind CSS 4, TypeScript 5.

---

## File Map

**Created:**
- `src/components/shared/HtmlLang.tsx` — client component that sets `document.documentElement.lang`
- `src/app/api/messages/route.ts` — `POST /api/messages` for patient→clinician notes
- `src/components/dashboard/MessageBox.tsx` — patient message send UI
- `src/components/clinician/DoctorPanel.tsx` — associated doctors display
- `src/components/clinician/AppointmentEditor.tsx` — inline appointment reschedule UI
- `src/components/clinician/PatientMessages.tsx` — read-only patient messages list

**Modified:**
- `src/app/layout.tsx` — remove `<html>`/`<body>` (moved to locale layout)
- `src/app/[locale]/layout.tsx` — add `<html lang>`/`<body>`, add `HtmlLang`
- `src/components/shared/LanguageSwitcher.tsx` — full-page reload via `window.location.href`
- `messages/en.json` — new keys for dashboard + clinician sections
- `messages/es.json` — Spanish translations for new keys
- `src/types.ts` — add `AppointmentWithDoctor` interface
- `src/app/api/appointments/route.ts` — add `reschedule` and `cancel` actions
- `src/components/dashboard/AppointmentSection.tsx` — doctor name, cancel button, formatted datetime
- `src/app/[locale]/dashboard/[token]/page.tsx` — PIN sessionStorage cache, profile header, severity badge, MessageBox
- `src/app/[locale]/clinician/[id]/page.tsx` — doctors + messages queries, DoctorPanel, AppointmentEditor, PatientMessages

---

## Task 1: Fix Language Switching

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/[locale]/layout.tsx`
- Create: `src/components/shared/HtmlLang.tsx`
- Modify: `src/components/shared/LanguageSwitcher.tsx`

- [ ] **Step 1: Strip `<html>`/`<body>` from root layout**

Replace entire `src/app/layout.tsx` with:

```tsx
import "./globals.css";

// html/body live in [locale]/layout.tsx so lang attr can reflect locale
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
```

- [ ] **Step 2: Add `<html lang>`/`<body>` to locale layout**

Replace entire `src/app/[locale]/layout.tsx` with:

```tsx
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

import { HtmlLang } from "@/components/shared/HtmlLang";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <HtmlLang locale={locale} />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Create HtmlLang client component**

Create `src/components/shared/HtmlLang.tsx`:

```tsx
"use client";
import { useEffect } from "react";

export function HtmlLang({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
```

- [ ] **Step 4: Fix LanguageSwitcher to use full-page reload**

Replace entire `src/components/shared/LanguageSwitcher.tsx` with:

```tsx
"use client";
import { usePathname } from "@/i18n/navigation";

export function LanguageSwitcher({ currentLocale }: { currentLocale: string }) {
  const pathname = usePathname();

  function switchLocale(locale: string) {
    window.location.href = `/${locale}${pathname}`;
  }

  return (
    <div className="flex gap-2">
      {["en", "es"].map((locale) => (
        <button
          key={locale}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
            locale === currentLocale
              ? "bg-blue-500/30 text-blue-300 border border-blue-500/40"
              : "text-white/40 hover:text-white/70"
          }`}
          onClick={() => switchLocale(locale)}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Browser-verify language switching**

Start dev server (`pnpm dev`). Open `/en/dashboard/demo-patient-token-abc123`, enter PIN, click ES. Verify:
- URL changes to `/es/dashboard/demo-patient-token-abc123`
- Page reloads (full, not soft nav)
- PIN gate shows with Spanish text: "Ingresa tu PIN para continuar"
- After PIN entry, dashboard header shows "Tu Resumen de Atención"

- [ ] **Step 7: Commit**

```bash
git add src/app/layout.tsx src/app/[locale]/layout.tsx \
  src/components/shared/HtmlLang.tsx \
  src/components/shared/LanguageSwitcher.tsx
git commit -m "fix(i18n): full-page locale switch with dynamic html lang attr"
```

---

## Task 2: Add Translation Keys

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/es.json`

- [ ] **Step 1: Add English keys**

Replace entire `messages/en.json` with:

```json
{
  "dashboard": {
    "title": "Your Care Summary",
    "lastCall": "From your last call",
    "medications": "Your Medications",
    "appointments": "Upcoming Appointments",
    "alerts": "Important Alerts",
    "timeline": "Recent Activity",
    "confirm": "Confirm",
    "fix": "Fix",
    "noData": "No data yet",
    "loading": "Loading...",
    "savings": "Cost savings info",
    "emergency": "If you feel unsafe, call 911 immediately",
    "staffWillContact": "A staff member will contact you soon",
    "followUpScheduled": "A follow-up has been scheduled",
    "correct": "Correct",
    "cancel": "Cancel",
    "save": "Save",
    "saving": "Saving...",
    "source": {
      "stt_inferred": "system inferred",
      "context_enriched": "context matched",
      "patient_verified": "you confirmed",
      "clinician_verified": "doctor verified"
    },
    "profile": "Your Profile",
    "severityLabel": "Severity",
    "messageCareTeam": "Message Your Care Team",
    "messagePlaceholder": "Type a message for your care team...",
    "messageSend": "Send",
    "messageSent": "Message sent",
    "cancelAppt": "Cancel Appointment",
    "requestChange": "Request Change",
    "doctor": "Doctor",
    "specialty": "Specialty"
  },
  "pin": {
    "title": "Enter your PIN to continue",
    "placeholder": "PIN",
    "submit": "Continue",
    "error": "Incorrect PIN. Please try again."
  },
  "clinician": {
    "title": "Patient Timeline",
    "escalations": "Active Escalations",
    "transcript": "Call Transcript",
    "appointments": "Appointments",
    "doctors": "Care Team",
    "edit": "Edit",
    "cancelEdit": "Cancel",
    "reschedule": "Reschedule",
    "newDatetime": "New date & time",
    "reason": "Reason (optional)",
    "save": "Save",
    "saving": "Saving...",
    "messages": "Patient Messages",
    "noMessages": "No messages yet",
    "severity": "Severity"
  }
}
```

- [ ] **Step 2: Add Spanish keys**

Replace entire `messages/es.json` with:

```json
{
  "dashboard": {
    "title": "Tu Resumen de Atención",
    "lastCall": "De tu última llamada",
    "medications": "Tus Medicamentos",
    "appointments": "Próximas Citas",
    "alerts": "Alertas Importantes",
    "timeline": "Actividad Reciente",
    "confirm": "Confirmar",
    "fix": "Corregir",
    "noData": "Sin datos aún",
    "loading": "Cargando...",
    "savings": "Información de ahorro",
    "emergency": "Si no se siente seguro, llame al 911 inmediatamente",
    "staffWillContact": "Un miembro del personal se pondrá en contacto pronto",
    "followUpScheduled": "Se ha programado un seguimiento",
    "correct": "Corregir",
    "cancel": "Cancelar",
    "save": "Guardar",
    "saving": "Guardando...",
    "source": {
      "stt_inferred": "inferido por sistema",
      "context_enriched": "coincidencia contextual",
      "patient_verified": "confirmado por ti",
      "clinician_verified": "verificado por médico"
    },
    "profile": "Tu Perfil",
    "severityLabel": "Severidad",
    "messageCareTeam": "Mensaje a tu Equipo de Atención",
    "messagePlaceholder": "Escribe un mensaje para tu equipo de atención...",
    "messageSend": "Enviar",
    "messageSent": "Mensaje enviado",
    "cancelAppt": "Cancelar Cita",
    "requestChange": "Solicitar Cambio",
    "doctor": "Doctor",
    "specialty": "Especialidad"
  },
  "pin": {
    "title": "Ingresa tu PIN para continuar",
    "placeholder": "PIN",
    "submit": "Continuar",
    "error": "PIN incorrecto. Inténtalo de nuevo."
  },
  "clinician": {
    "title": "Historial del Paciente",
    "escalations": "Escalaciones Activas",
    "transcript": "Transcripción de Llamada",
    "appointments": "Citas",
    "doctors": "Equipo Médico",
    "edit": "Editar",
    "cancelEdit": "Cancelar",
    "reschedule": "Reprogramar",
    "newDatetime": "Nueva fecha y hora",
    "reason": "Motivo (opcional)",
    "save": "Guardar",
    "saving": "Guardando...",
    "messages": "Mensajes del Paciente",
    "noMessages": "Sin mensajes aún",
    "severity": "Severidad"
  }
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "feat(i18n): add dashboard and clinician translation keys for EN and ES"
```

---

## Task 3: Extend Types + Appointments API

**Files:**
- Modify: `src/types.ts`
- Modify: `src/app/api/appointments/route.ts`

- [ ] **Step 1: Add `AppointmentWithDoctor` to types**

Open `src/types.ts`. After the existing `Appointment` interface (line ~63), add:

```typescript
export interface AppointmentWithDoctor extends Appointment {
  doctors: { name: string; specialty: string } | null;
}
```

- [ ] **Step 2: Extend appointments API**

Replace entire `src/app/api/appointments/route.ts` with:

```typescript
import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";
import { fireEvent } from "@/lib/events";

export async function PATCH(req: NextRequest) {
  const { appointmentId, patientId, action, datetime, status, reason } =
    await req.json();
  // action: 'confirm' | 'request_change' | 'cancel' | 'reschedule'

  if (action === "confirm") {
    await supabaseAdmin
      .from("appointments")
      .update({ status: "confirmed", updated_at: new Date().toISOString() })
      .eq("id", appointmentId);

    await supabaseAdmin.from("patient_timeline").insert({
      patient_id: patientId,
      event_type: "appointment",
      content: { action: "confirmed", appointmentId },
      severity: 0,
      source: "patient_verified",
    });
  } else if (action === "cancel") {
    await supabaseAdmin
      .from("appointments")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", appointmentId);

    await supabaseAdmin.from("patient_timeline").insert({
      patient_id: patientId,
      event_type: "appointment",
      content: { action: "cancelled", appointmentId },
      severity: 0,
      source: "patient_verified",
    });

    await fireEvent({ type: "appointment.updated", appointmentId, patientId });
  } else if (action === "request_change") {
    await supabaseAdmin
      .from("appointments")
      .update({
        conflict_detected: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", appointmentId);

    await fireEvent({ type: "appointment.updated", appointmentId, patientId });
  } else if (action === "reschedule") {
    await supabaseAdmin
      .from("appointments")
      .update({
        datetime: datetime,
        status: status ?? "rescheduled",
        reschedule_reason: reason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", appointmentId);

    await supabaseAdmin.from("patient_timeline").insert({
      patient_id: patientId,
      event_type: "appointment",
      content: { action: "rescheduled", datetime, reason: reason ?? null, appointmentId },
      severity: 0,
      source: "clinician_verified",
    });

    await fireEvent({ type: "appointment.updated", appointmentId, patientId });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/app/api/appointments/route.ts
git commit -m "feat(api): add cancel and reschedule appointment actions + AppointmentWithDoctor type"
```

---

## Task 4: Messages API Route

**Files:**
- Create: `src/app/api/messages/route.ts`

- [ ] **Step 1: Create the messages route**

Create `src/app/api/messages/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { patientId, message } = await req.json();

  if (!patientId || !message?.trim()) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("notifications").insert({
    patient_id: patientId,
    type: "patient_message",
    message: message.trim(),
    status: "pending",
    language: "en",
  });

  if (error) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/messages/route.ts
git commit -m "feat(api): add POST /api/messages for patient-to-clinician notes"
```

---

## Task 5: Enhanced AppointmentSection (Patient Side)

**Files:**
- Modify: `src/components/dashboard/AppointmentSection.tsx`

- [ ] **Step 1: Rewrite AppointmentSection**

The dashboard API already returns `doctors` nested on each appointment via `select("*, doctors(name, specialty)")`. We just need to display it and add the cancel action.

Replace entire `src/components/dashboard/AppointmentSection.tsx` with:

```tsx
"use client";
import type { AppointmentWithDoctor } from "@/types";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { GlassCard } from "@/components/ui/GlassCard";
import { GlassBadge } from "@/components/ui/GlassBadge";
import { GlassButton } from "@/components/ui/GlassButton";
import { LiveBadge } from "@/components/shared/LiveBadge";
import { useRealtimeAppointment } from "@/hooks/useRealtimeAppointment";

const statusColor = {
  scheduled: "blue",
  confirmed: "emerald",
  rescheduled: "amber",
  cancelled: "red",
} as const;

function formatDatetime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AppointmentSection({
  appointments: initial,
  patientId,
}: {
  appointments: AppointmentWithDoctor[];
  patientId: string;
}) {
  const t = useTranslations("dashboard");
  const appointments = useRealtimeAppointment(
    patientId,
    initial,
  ) as AppointmentWithDoctor[];
  const [loading, setLoading] = useState<string | null>(null);

  if (!appointments.length) return null;

  async function handleAction(
    id: string,
    action: "confirm" | "request_change" | "cancel",
  ) {
    setLoading(id + action);
    await fetch("/api/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId: id, patientId, action }),
    });
    setLoading(null);
  }

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider">
          {t("appointments")}
        </h2>
        <LiveBadge />
      </div>
      <div className="flex flex-col gap-2">
        {appointments.map((appt) => (
          <GlassCard key={appt.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white">
                  {formatDatetime(appt.datetime)}
                </p>
                {appt.doctors && (
                  <p className="text-sm text-white/50 mt-0.5">
                    {appt.doctors.name}
                    {appt.doctors.specialty
                      ? ` · ${appt.doctors.specialty}`
                      : ""}
                  </p>
                )}
                {appt.reschedule_reason && (
                  <p className="text-xs text-amber-300 mt-0.5">
                    {appt.reschedule_reason}
                  </p>
                )}
                <div className="mt-1.5">
                  <GlassBadge color={statusColor[appt.status]}>
                    {appt.status}
                  </GlassBadge>
                </div>
              </div>
              {appt.status !== "cancelled" && (
                <div className="flex flex-col gap-1.5 shrink-0">
                  {appt.status === "scheduled" && (
                    <GlassButton
                      variant="success"
                      disabled={loading === appt.id + "confirm"}
                      onClick={() => handleAction(appt.id, "confirm")}
                    >
                      {t("confirm")}
                    </GlassButton>
                  )}
                  {(appt.status === "scheduled" ||
                    appt.status === "confirmed") && (
                    <GlassButton
                      variant="secondary"
                      disabled={loading === appt.id + "request_change"}
                      onClick={() => handleAction(appt.id, "request_change")}
                    >
                      {t("requestChange")}
                    </GlassButton>
                  )}
                  <GlassButton
                    variant="danger"
                    disabled={loading === appt.id + "cancel"}
                    onClick={() => handleAction(appt.id, "cancel")}
                  >
                    {t("cancelAppt")}
                  </GlassButton>
                </div>
              )}
            </div>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. If `useRealtimeAppointment` has a type mismatch, the cast `as AppointmentWithDoctor[]` handles it since `AppointmentWithDoctor extends Appointment`.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/AppointmentSection.tsx
git commit -m "feat(dashboard): appointment section with doctor name, cancel action, formatted datetime"
```

---

## Task 6: MessageBox Component

**Files:**
- Create: `src/components/dashboard/MessageBox.tsx`

- [ ] **Step 1: Create MessageBox**

Create `src/components/dashboard/MessageBox.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";

export function MessageBox({ patientId }: { patientId: string }) {
  const t = useTranslations("dashboard");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  async function handleSend() {
    if (!message.trim()) return;
    setStatus("sending");

    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId, message }),
    });

    if (res.ok) {
      setStatus("sent");
      setMessage("");
    } else {
      setStatus("error");
    }
  }

  return (
    <GlassCard>
      <h2 className="mb-3 text-sm font-medium text-white/50 uppercase tracking-wider">
        {t("messageCareTeam")}
      </h2>
      {status === "sent" ? (
        <p className="text-sm text-emerald-400">{t("messageSent")}</p>
      ) : (
        <>
          <textarea
            className="w-full rounded-xl border border-blue-500/20 bg-blue-950/30 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 resize-none"
            disabled={status === "sending"}
            placeholder={t("messagePlaceholder")}
            rows={3}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              if (status === "error") setStatus("idle");
            }}
          />
          {status === "error" && (
            <p className="mt-1 text-xs text-red-400">
              Failed to send. Please try again.
            </p>
          )}
          <div className="mt-2 flex justify-end">
            <GlassButton
              disabled={!message.trim() || status === "sending"}
              onClick={handleSend}
            >
              {status === "sending" ? "..." : t("messageSend")}
            </GlassButton>
          </div>
        </>
      )}
    </GlassCard>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/MessageBox.tsx
git commit -m "feat(dashboard): add MessageBox component for patient-to-clinician notes"
```

---

## Task 7: Dashboard Page — PIN Cache, Profile Header, Wire-up

**Files:**
- Modify: `src/app/[locale]/dashboard/[token]/page.tsx`

- [ ] **Step 1: Rewrite dashboard page**

Replace entire `src/app/[locale]/dashboard/[token]/page.tsx` with:

```tsx
"use client";
import type {
  Appointment,
  AppointmentWithDoctor,
  Escalation,
  Medication,
  TimelineEvent,
} from "@/types";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { PinGate } from "@/components/shared/PinGate";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";
import { AlertBanner } from "@/components/dashboard/AlertBanner";
import { CallSummarySection } from "@/components/dashboard/CallSummarySection";
import { MedicationSection } from "@/components/dashboard/MedicationSection";
import { AppointmentSection } from "@/components/dashboard/AppointmentSection";
import { TimelineSection } from "@/components/dashboard/TimelineSection";
import { SavingsCard } from "@/components/dashboard/SavingsCard";
import { MessageBox } from "@/components/dashboard/MessageBox";
import { useRealtimeAlerts } from "@/hooks/useRealtimeAlerts";
import { GlassBadge } from "@/components/ui/GlassBadge";

interface DashboardData {
  patient: {
    id: string;
    name_alias: string;
    language: string;
    severity_score: number;
  };
  medications: Medication[];
  appointments: AppointmentWithDoctor[];
  timeline: TimelineEvent[];
  escalations: Escalation[];
  lastCall: {
    summary: string;
    severity_score: number;
    ended_at: string;
  } | null;
}

function severityColor(score: number): "red" | "amber" | "emerald" {
  if (score >= 7) return "red";
  if (score >= 4) return "amber";
  return "emerald";
}

export default function DashboardPage() {
  const params = useParams();
  const token = params.token as string;
  const locale = params.locale as string;
  const t = useTranslations("dashboard");
  const [data, setData] = useState<DashboardData | null>(null);
  const autoVerified = useRef(false);

  const escalations = useRealtimeAlerts(
    data?.patient?.id ?? "",
    data?.escalations ?? [],
  );

  // Auto-verify using cached PIN (set after successful login, cleared on tab close)
  useEffect(() => {
    if (autoVerified.current || data) return;
    const cached = sessionStorage.getItem(`pin_${token}`);
    if (!cached) return;
    autoVerified.current = true;

    fetch(`/api/dashboard/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: cached }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d) setData(d as DashboardData);
        else sessionStorage.removeItem(`pin_${token}`);
      })
      .catch(() => sessionStorage.removeItem(`pin_${token}`));
  }, [token, data]);

  if (!data) {
    return (
      <PinGate
        token={token}
        onVerified={(d, pin) => {
          sessionStorage.setItem(`pin_${token}`, pin);
          setData(d as DashboardData);
        }}
      />
    );
  }

  const { patient, medications, appointments, timeline, lastCall } = data;

  const savingsEvents = timeline.filter(
    (e) => e.event_type === "savings_found",
  ) as Array<
    TimelineEvent & {
      content: { drugName: string; links: { url: string; title: string }[] };
    }
  >;

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-semibold text-white">{t("title")}</h1>
            <p className="text-sm text-white/40">{patient.name_alias}</p>
          </div>
          {patient.severity_score >= 4 && (
            <GlassBadge color={severityColor(patient.severity_score)}>
              {t("severityLabel")} {patient.severity_score}/10
            </GlassBadge>
          )}
        </div>
        <LanguageSwitcher currentLocale={locale} />
      </div>

      {/* Alert banner */}
      <div className="mb-4">
        <AlertBanner
          escalations={escalations}
          severity={patient.severity_score}
        />
      </div>

      <div className="flex flex-col gap-6">
        <CallSummarySection lastCall={lastCall} />
        <MedicationSection
          locale={locale}
          medications={medications}
          patientId={patient.id}
        />
        {savingsEvents.map((e) => (
          <SavingsCard
            key={e.id}
            drugName={e.content.drugName}
            links={e.content.links}
          />
        ))}
        <AppointmentSection
          appointments={appointments}
          patientId={patient.id}
        />
        <MessageBox patientId={patient.id} />
        <TimelineSection
          events={timeline.filter((e) => e.event_type !== "savings_found")}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update PinGate to pass pin back to onVerified**

The `onVerified` callback now receives a second argument `pin` so the page can cache it. Open `src/components/shared/PinGate.tsx` and update the interface and callback:

```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";

interface PinGateProps {
  token: string;
  onVerified: (data: unknown, pin: string) => void;
}

export function PinGate({ token, onVerified }: PinGateProps) {
  const t = useTranslations("pin");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch(`/api/dashboard/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });

    if (res.ok) {
      const data = await res.json();
      onVerified(data, pin);
    } else {
      setError(t("error"));
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <GlassCard className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-lg font-medium text-white/80">
          {t("title")}
        </h1>
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <input
            className="rounded-xl border border-blue-500/20 bg-blue-950/30 px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
            placeholder={t("placeholder")}
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <GlassButton disabled={loading || !pin} type="submit">
            {loading ? "..." : t("submit")}
          </GlassButton>
        </form>
      </GlassCard>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Browser-verify**

Open `/en/dashboard/demo-patient-token-abc123`, enter PIN (1234 for demo patient). Verify:
- Profile header shows patient name + severity badge if score ≥ 4
- Appointments show doctor name + specialty
- Confirm / Request Change / Cancel Appointment buttons present
- "Message Your Care Team" section at bottom with textarea + Send
- Switch to ES — page reloads, PIN auto-fills from sessionStorage, dashboard shows in Spanish

- [ ] **Step 5: Commit**

```bash
git add src/app/[locale]/dashboard/[token]/page.tsx \
  src/components/shared/PinGate.tsx
git commit -m "feat(dashboard): PIN sessionStorage cache, profile header, severity badge, MessageBox"
```

---

## Task 8: DoctorPanel Component (Clinician)

**Files:**
- Create: `src/components/clinician/DoctorPanel.tsx`

- [ ] **Step 1: Create DoctorPanel**

Create `src/components/clinician/DoctorPanel.tsx`:

```tsx
import type { Doctor } from "@/types";

import { GlassCard } from "@/components/ui/GlassCard";

export function DoctorPanel({ doctors }: { doctors: Doctor[] }) {
  if (!doctors.length) return null;

  return (
    <section className="mb-6">
      <h2 className="mb-3 text-sm font-medium text-white/50 uppercase tracking-wider">
        Care Team
      </h2>
      <div className="flex flex-wrap gap-3">
        {doctors.map((doc) => (
          <GlassCard key={doc.id} className="flex-1 min-w-[180px]">
            <p className="font-medium text-white">{doc.name}</p>
            {doc.specialty && (
              <p className="text-xs text-white/50 mt-0.5">{doc.specialty}</p>
            )}
            {doc.phone && (
              <p className="text-xs text-white/40 mt-1">{doc.phone}</p>
            )}
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/clinician/DoctorPanel.tsx
git commit -m "feat(clinician): add DoctorPanel component showing associated doctors"
```

---

## Task 9: AppointmentEditor Component (Clinician)

**Files:**
- Create: `src/components/clinician/AppointmentEditor.tsx`

- [ ] **Step 1: Create AppointmentEditor**

Create `src/components/clinician/AppointmentEditor.tsx`:

```tsx
"use client";
import type { AppointmentStatus, AppointmentWithDoctor } from "@/types";

import { useState } from "react";

import { GlassCard } from "@/components/ui/GlassCard";
import { GlassBadge } from "@/components/ui/GlassBadge";
import { GlassButton } from "@/components/ui/GlassButton";

const statusColor = {
  scheduled: "blue",
  confirmed: "emerald",
  rescheduled: "amber",
  cancelled: "red",
} as const;

function toDatetimeLocal(iso: string): string {
  // Convert ISO string to datetime-local input format (YYYY-MM-DDTHH:mm)
  return iso.slice(0, 16);
}

function formatDatetime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function AppointmentCard({
  appt,
  patientId,
}: {
  appt: AppointmentWithDoctor;
  patientId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [datetime, setDatetime] = useState(toDatetimeLocal(appt.datetime));
  const [status, setStatus] = useState<AppointmentStatus>(appt.status);
  const [reason, setReason] = useState(appt.reschedule_reason ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentId: appt.id,
        patientId,
        action: "reschedule",
        datetime: new Date(datetime).toISOString(),
        status,
        reason: reason.trim() || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  return (
    <GlassCard>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white">{formatDatetime(appt.datetime)}</p>
          {appt.doctors && (
            <p className="text-sm text-white/50 mt-0.5">
              {appt.doctors.name}
              {appt.doctors.specialty ? ` · ${appt.doctors.specialty}` : ""}
            </p>
          )}
          {appt.reschedule_reason && !editing && (
            <p className="text-xs text-amber-300 mt-0.5">{appt.reschedule_reason}</p>
          )}
          <div className="mt-1.5 flex items-center gap-2">
            <GlassBadge color={statusColor[appt.status]}>{appt.status}</GlassBadge>
            {saved && (
              <span className="text-xs text-emerald-400">Saved</span>
            )}
          </div>
        </div>
        {!editing && (
          <GlassButton variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </GlassButton>
        )}
      </div>

      {editing && (
        <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4">
          <div>
            <label className="text-xs text-white/40 uppercase tracking-wider mb-1 block">
              New date &amp; time
            </label>
            <input
              className="w-full rounded-xl border border-blue-500/20 bg-blue-950/30 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
              type="datetime-local"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-white/40 uppercase tracking-wider mb-1 block">
              Status
            </label>
            <select
              className="w-full rounded-xl border border-blue-500/20 bg-blue-950/30 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
              value={status}
              onChange={(e) => setStatus(e.target.value as AppointmentStatus)}
            >
              <option value="scheduled">Scheduled</option>
              <option value="confirmed">Confirmed</option>
              <option value="rescheduled">Rescheduled</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-white/40 uppercase tracking-wider mb-1 block">
              Reason (optional)
            </label>
            <textarea
              className="w-full rounded-xl border border-blue-500/20 bg-blue-950/30 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 resize-none"
              placeholder="e.g. Doctor unavailable, patient request..."
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <GlassButton
              variant="secondary"
              disabled={saving}
              onClick={() => setEditing(false)}
            >
              Cancel
            </GlassButton>
            <GlassButton
              variant="success"
              disabled={saving || !datetime}
              onClick={handleSave}
            >
              {saving ? "Saving..." : "Save"}
            </GlassButton>
          </div>
        </div>
      )}
    </GlassCard>
  );
}

export function AppointmentEditor({
  appointments,
  patientId,
}: {
  appointments: AppointmentWithDoctor[];
  patientId: string;
}) {
  if (!appointments.length) return null;

  return (
    <section className="mb-6">
      <h2 className="mb-3 text-sm font-medium text-white/50 uppercase tracking-wider">
        Appointments
      </h2>
      <div className="flex flex-col gap-2">
        {appointments.map((appt) => (
          <AppointmentCard key={appt.id} appt={appt} patientId={patientId} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/clinician/AppointmentEditor.tsx
git commit -m "feat(clinician): add AppointmentEditor with inline reschedule and status edit"
```

---

## Task 10: PatientMessages Component (Clinician)

**Files:**
- Create: `src/components/clinician/PatientMessages.tsx`

- [ ] **Step 1: Create PatientMessages**

Create `src/components/clinician/PatientMessages.tsx`:

```tsx
import { GlassCard } from "@/components/ui/GlassCard";

interface PatientMessage {
  id: string;
  message: string;
  status: string;
  created_at: string;
}

export function PatientMessages({ messages }: { messages: PatientMessage[] }) {
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-sm font-medium text-white/50 uppercase tracking-wider">
        Patient Messages
      </h2>
      {!messages.length ? (
        <p className="text-sm text-white/30">No messages yet</p>
      ) : (
        <div className="flex flex-col gap-2">
          {messages.map((msg) => (
            <GlassCard key={msg.id} className="flex items-start gap-3">
              {msg.status === "pending" && (
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-400" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/80">{msg.message}</p>
                <p className="text-xs text-white/30 mt-0.5">
                  {new Date(msg.created_at).toLocaleString()}
                </p>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/clinician/PatientMessages.tsx
git commit -m "feat(clinician): add PatientMessages read-only inbox component"
```

---

## Task 11: Clinician Page — Queries + New Sections

**Files:**
- Modify: `src/app/[locale]/clinician/[id]/page.tsx`

- [ ] **Step 1: Rewrite clinician page**

Replace entire `src/app/[locale]/clinician/[id]/page.tsx` with:

```tsx
import type {
  AppointmentWithDoctor,
  Call,
  Doctor,
  Escalation,
  Patient,
  TimelineEvent,
} from "@/types";

import { supabaseAdmin } from "@/lib/supabase";
import { TimelineFeed } from "@/components/clinician/TimelineFeed";
import { EscalationCard } from "@/components/clinician/EscalationCard";
import { CallTranscriptView } from "@/components/clinician/CallTranscriptView";
import { DoctorPanel } from "@/components/clinician/DoctorPanel";
import { AppointmentEditor } from "@/components/clinician/AppointmentEditor";
import { PatientMessages } from "@/components/clinician/PatientMessages";
import { GlassBadge } from "@/components/ui/GlassBadge";

function severityColor(score: number): "red" | "amber" | "emerald" {
  if (score >= 7) return "red";
  if (score >= 4) return "amber";
  return "emerald";
}

interface PatientMessage {
  id: string;
  message: string;
  status: string;
  created_at: string;
}

export default async function ClinicianPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;

  const [patientRes, timelineRes, escalationsRes, callsRes, apptsRes, messagesRes] =
    await Promise.all([
      supabaseAdmin.from("patients").select("*").eq("id", id).single(),
      supabaseAdmin
        .from("patient_timeline")
        .select("*")
        .eq("patient_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("escalations")
        .select("*")
        .eq("patient_id", id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("calls")
        .select("*")
        .eq("patient_id", id)
        .eq("status", "completed")
        .order("ended_at", { ascending: false })
        .limit(5),
      supabaseAdmin
        .from("appointments")
        .select("*, doctors(*)")
        .eq("patient_id", id)
        .order("datetime"),
      supabaseAdmin
        .from("notifications")
        .select("id, message, status, created_at")
        .eq("patient_id", id)
        .eq("type", "patient_message")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  const patient = patientRes.data as Patient | null;
  const timeline = (timelineRes.data ?? []) as TimelineEvent[];
  const escalations = (escalationsRes.data ?? []) as Escalation[];
  const calls = (callsRes.data ?? []) as Call[];
  const appointments = (apptsRes.data ?? []) as AppointmentWithDoctor[];
  const messages = (messagesRes.data ?? []) as PatientMessage[];

  // Deduplicate doctors by id
  const doctorMap = new Map<string, Doctor>();
  for (const appt of appointments) {
    if (appt.doctors && appt.doctor_id && !doctorMap.has(appt.doctor_id)) {
      doctorMap.set(appt.doctor_id, appt.doctors as unknown as Doctor);
    }
  }
  const doctors = Array.from(doctorMap.values());

  if (!patient)
    return <div className="p-8 text-white/50">Patient not found</div>;

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-3xl mx-auto">
      {/* Patient header */}
      <div className="mb-6 flex items-start gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">
            {patient.name_alias}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <GlassBadge color={severityColor(patient.severity_score)}>
              Severity {patient.severity_score}/10
            </GlassBadge>
            <span className="text-sm text-white/40">
              Last call:{" "}
              {patient.last_call_at
                ? new Date(patient.last_call_at).toLocaleString()
                : "never"}
            </span>
          </div>
        </div>
      </div>

      {/* Associated doctors */}
      <DoctorPanel doctors={doctors} />

      {/* Active escalations */}
      {escalations.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-medium text-red-400 uppercase tracking-wider">
            Active Escalations
          </h2>
          <div className="flex flex-col gap-2">
            {escalations.map((e) => (
              <EscalationCard key={e.id} escalation={e} />
            ))}
          </div>
        </section>
      )}

      {/* Appointment editor */}
      <AppointmentEditor appointments={appointments} patientId={id} />

      {/* Patient messages */}
      <PatientMessages messages={messages} />

      {/* Timeline */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-white/50 uppercase tracking-wider">
          Patient Timeline
        </h2>
        <TimelineFeed events={timeline} />
      </section>

      {/* Recent calls */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-white/50 uppercase tracking-wider">
          Recent Calls
        </h2>
        <div className="flex flex-col gap-4">
          {calls.map((call) => (
            <CallTranscriptView
              key={call.id}
              summary={call.summary ?? ""}
              transcript={call.transcript ?? ""}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. If `appt.doctors` has a type conflict from the Supabase select join, cast with `as unknown as Doctor` is already in the deduplication loop.

- [ ] **Step 3: Browser-verify clinician view**

Open `/en/clinician/00000000-0000-0000-0000-000000000002`. Verify:
- Patient header shows name + severity badge
- Care Team section shows associated doctor(s) with name/specialty/phone
- Appointments section shows each appointment with Edit button
- Clicking Edit reveals datetime picker, status dropdown, reason textarea, Save/Cancel
- Patient Messages section shows "No messages yet" (or messages if any sent)
- Timeline shows formatted event text (no raw JSON)
- Recent Calls shows transcripts

- [ ] **Step 4: Verify message flow end-to-end**

1. Open patient dashboard `/en/dashboard/demo-patient-token-abc123`, enter PIN
2. Scroll to "Message Your Care Team", type "Test message from patient", click Send
3. Confirm "Message sent" appears
4. Open clinician view `/en/clinician/[patient-id]`
5. Verify "Test message from patient" appears in Patient Messages with blue dot

- [ ] **Step 5: Commit**

```bash
git add src/app/[locale]/clinician/[id]/page.tsx
git commit -m "feat(clinician): add DoctorPanel, AppointmentEditor, PatientMessages sections"
```

---

## Final Type-Check

- [ ] **Run full type-check**

```bash
npx tsc --noEmit
```

Expected: zero errors across all modified and created files.

- [ ] **Verify testing-guide scenarios are reachable via UI**

| Scenario | Where to check |
|----------|---------------|
| Dashboard shows in Spanish after locale switch | EN→ES switch, verify "Tu Resumen de Atención" |
| Severity badge appears when score ≥ 4 | Patient header |
| Savings cards not duplicated in timeline | Timeline section has no savings_found entries |
| Patient confirms appointment | Appointments → Confirm button |
| Patient requests change | Appointments → Request Change button |
| Patient cancels appointment | Appointments → Cancel Appointment button |
| Patient sends message | Message box → Send → clinician sees it |
| Clinician reschedules appointment | Edit → change datetime → Save |
| Timeline shows readable text | No `{"links":...}` raw JSON visible |
| Escalation alert banner | Trigger via DB insert into escalations |
