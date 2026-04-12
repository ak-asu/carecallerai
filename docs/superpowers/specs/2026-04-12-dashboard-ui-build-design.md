# CareCaller Dashboard UI Build — Design Spec
**Date:** 2026-04-12
**Scope:** Patient dashboard completion + clinician per-patient view completion

---

## 1. Problem Statement

The patient dashboard and clinician view are structurally wired to the backend but missing key UI sections needed to test the flows in the testing guide. Specific gaps:

- Language switching navigates to `/es/` URL but content stays in English
- Patient dashboard missing: profile header, doctor name on appointments, cancel/request-change appointment actions, message box to care team
- Clinician view missing: associated doctors panel, appointment editor (reschedule date/time + status), patient message inbox
- Raw JSON still appearing in timeline in clinician view (formatContent fix already applied to patient side)
- Duplicate savings cards rendered (fix already applied)

---

## 2. Architecture & Data Flow

### Existing routes (extended)

**`POST /api/dashboard/[token]`**
- Currently returns: `patient`, `medications`, `appointments`, `timeline`, `escalations`, `lastCall`
- Add: join `doctors` table on each appointment so each appointment includes `doctor_name` and `doctor_specialty`
- No changes to the response shape beyond doctor join

**`PATCH /api/appointments`**
- Currently handles: `confirm`, `request_change`
- Add action: `reschedule` — accepts `datetime` (new ISO string), `status` (AppointmentStatus), `reason` (optional string)
- On `reschedule`: updates `appointments.datetime`, `appointments.status`, `appointments.reschedule_reason`, inserts `patient_timeline` event `{ event_type: 'appointment', content: { action: 'rescheduled', datetime, reason } }`
- On `cancel` (patient side): updates `appointments.status = 'cancelled'`, fires `appointment.updated` event, inserts timeline event

**`POST /api/messages`**
- New route
- Body: `{ patientId: string, message: string }`
- Inserts row into `notifications` table: `{ patient_id, type: 'patient_message', message, status: 'pending', language: 'en' }`
- Returns `{ ok: true }`

### Clinician page (server component — no new route)
- Add second parallel query: distinct doctors joined via appointments for this patient
- Add query: messages from `notifications` where `patient_id = id AND type = 'patient_message'` ordered newest first, limit 20

---

## 3. Language Fix

### Root layout (`app/layout.tsx`)
- Remove hardcoded `<html lang="en">`
- Move `<html>` and `<body>` tags into `[locale]/layout.tsx` so locale is dynamic

### LanguageSwitcher (`components/shared/LanguageSwitcher.tsx`)
- Replace `router.replace(pathname, { locale })` with `window.location.href = \`/\${locale}\${pathname}\``
- Full page reload guarantees server re-executes `[locale]/layout.tsx` with correct messages
- Remove dependency on `@/i18n/navigation` (no longer needed)

### Dashboard PIN cache (`app/[locale]/dashboard/[token]/page.tsx`)
- On successful PIN verification: `sessionStorage.setItem(\`pin_\${token}\`, pin)`
- On component mount: if `sessionStorage.getItem(\`pin_\${token}\`)` exists, auto-submit silently (skip PIN gate UI)
- If auto-submit fails (PIN changed or expired): clear sessionStorage, show PIN gate normally
- sessionStorage clears automatically on tab close — no persistent security risk

---

## 4. Patient Dashboard

### Section order (top to bottom, single column, max-w-2xl)

1. **Header** — patient `name_alias` (xl semibold), language switcher (top right), severity badge if `severity_score >= 5` (amber/red pill)
2. **Alert banner** — existing, unchanged
3. **Last call summary** — existing, add severity dot (green/amber/red) next to date
4. **Medications** — existing EntityCard list with confirm/correct, unchanged
5. **Upcoming appointments** — enhanced (see below)
6. **Cost savings cards** — existing, deduplicated (already fixed)
7. **Message your care team** — new section (see below)
8. **Recent activity** — existing TimelineSection, savings_found filtered out (already fixed)

### Appointments section enhancements
- Show `doctor_name` + `doctor_specialty` on each card (from joined data)
- Format datetime as locale-aware long format: "Tuesday, Apr 15 at 2:00 PM"
- Status badge colors: scheduled=blue, confirmed=emerald, rescheduled=amber, cancelled=red
- Actions for `scheduled` status: **Confirm** (existing) + **Request Change** (existing, renamed from "Fix") + **Cancel** (new — sets status cancelled)
- Actions for `confirmed` status: **Cancel** only
- No date/time picker on patient side — patient cannot set new datetime

### Message your care team (new section)
- GlassCard with section header using `t("messageCareTeam")`
- `<textarea>` with placeholder `t("messagePlaceholder")`, 3 rows, glass styling
- Send button — disabled when empty or after send
- On send: `POST /api/messages` with `patientId` + message text
- On success: replace textarea with `t("messageSent")` confirmation inline (no page reload)
- On error: show error text in red/amber

---

## 5. Clinician View

### Section order (top to bottom, max-w-3xl)

1. **Patient header** — `name_alias`, severity score with color (green <4, amber 4–6, red >6), last call date
2. **Associated doctors panel** — horizontal row of GlassCards, one per distinct doctor from appointments. Each: doctor name (bold), specialty, phone
3. **Active escalations** — existing EscalationCard list, unchanged
4. **Appointments editor** — new section (see below)
5. **Patient messages** — new section (see below)
6. **Patient timeline** — existing TimelineFeed with formatContent fix applied
7. **Recent calls** — existing CallTranscriptView list, unchanged

### Appointments editor (new section)
- Section header: `"Appointments"` / `"Citas"`
- Each appointment card shows: doctor name + specialty, formatted datetime, status badge
- **Edit button** per card — toggles inline edit mode (no modal)
- In edit mode:
  - `<input type="datetime-local">` pre-filled with current datetime
  - Status `<select>`: scheduled / confirmed / rescheduled / cancelled
  - `<textarea>` for reschedule reason (optional, 2 rows)
  - **Save** + **Cancel edit** buttons
- Save calls `PATCH /api/appointments` with `{ appointmentId, action: 'reschedule', datetime, status, reason }`
- Optimistic UI: update card immediately, revert on error
- The clinician page is a server component — the appointment editor sub-component is `"use client"`

### Patient messages (new section)
- Section header: `"Patient Messages"` / `"Mensajes del Paciente"`
- Read-only list of messages from `notifications` table, newest first
- Each: message text, timestamp (locale-aware), grey dot for `status = 'pending'`
- If no messages: muted text `t("noMessages")`
- No reply UI on clinician side in this iteration

---

## 6. New Components

| Component | Location | Type |
|-----------|----------|------|
| `MessageBox` | `components/dashboard/MessageBox.tsx` | client |
| `AppointmentEditor` | `components/clinician/AppointmentEditor.tsx` | client |
| `DoctorPanel` | `components/clinician/DoctorPanel.tsx` | server-safe (no hooks) |
| `PatientMessages` | `components/clinician/PatientMessages.tsx` | server-safe |

Existing components modified:
- `AppointmentSection.tsx` — add doctor info, cancel action, better date format
- `LanguageSwitcher.tsx` — full reload approach
- `TimelineFeed.tsx` — formatContent already applied
- `[locale]/layout.tsx` — move html/body here
- `app/layout.tsx` — remove html/body
- `dashboard/[token]/page.tsx` — PIN sessionStorage cache, profile header, message section
- `clinician/[id]/page.tsx` — doctors query, messages query, new sections

---

## 7. Translation Keys

### en.json additions
```json
"dashboard": {
  "profile": "Your Profile",
  "messageCareTeam": "Message Your Care Team",
  "messagePlaceholder": "Type a message for your care team...",
  "messageSend": "Send",
  "messageSent": "Message sent",
  "cancelAppt": "Cancel Appointment",
  "requestChange": "Request Change",
  "doctor": "Doctor",
  "specialty": "Specialty"
},
"clinician": {
  "appointments": "Appointments",
  "doctors": "Care Team",
  "edit": "Edit",
  "reschedule": "Reschedule",
  "newDatetime": "New date & time",
  "reason": "Reason (optional)",
  "save": "Save",
  "saving": "Saving...",
  "messages": "Patient Messages",
  "noMessages": "No messages yet",
  "severity": "Severity"
}
```

### es.json additions
```json
"dashboard": {
  "profile": "Tu Perfil",
  "messageCareTeam": "Mensaje a tu Equipo de Atención",
  "messagePlaceholder": "Escribe un mensaje para tu equipo de atención...",
  "messageSend": "Enviar",
  "messageSent": "Mensaje enviado",
  "cancelAppt": "Cancelar Cita",
  "requestChange": "Solicitar Cambio",
  "doctor": "Doctor",
  "specialty": "Especialidad"
},
"clinician": {
  "appointments": "Citas",
  "doctors": "Equipo Médico",
  "edit": "Editar",
  "reschedule": "Reprogramar",
  "newDatetime": "Nueva fecha y hora",
  "reason": "Motivo (opcional)",
  "save": "Guardar",
  "saving": "Guardando...",
  "messages": "Mensajes del Paciente",
  "noMessages": "Sin mensajes aún",
  "severity": "Severidad"
}
```

---

## 8. Visual Style

All new components follow existing glass-morphism conventions:
- Containers: `GlassCard` with `backdrop-blur`, semi-transparent dark background
- Badges: `GlassBadge` with existing color variants
- Buttons: `GlassButton` with `variant` prop (`success`, `secondary`, `danger`)
- Section headers: `text-sm font-medium text-white/50 uppercase tracking-wider`
- Body text: `text-white/80` (primary), `text-white/50` (secondary), `text-white/30` (meta)
- Inputs/textareas: `border border-blue-500/20 bg-blue-950/30 text-white placeholder-white/30 rounded-xl focus:border-blue-500/50 focus:outline-none`

No new UI primitives needed. `GlassButton` already has `danger` variant (red) — used as-is for cancel actions.

---

## 9. Testing Guide Coverage

After this build, the following testing guide scenarios are fully testable via UI:

| Scenario | Dashboard element |
|----------|------------------|
| Call completes → timeline updates | Recent activity section (realtime) |
| Severity >= 7 → escalation created | Alert banner (realtime via useRealtimeAlerts) |
| Savings links found | Cost savings cards |
| Appointment confirmed by patient | Appointments section → Confirm button |
| Patient requests appointment change | Appointments section → Request Change button |
| Patient cancels appointment | Appointments section → Cancel button |
| Clinician reschedules appointment | Clinician view → Appointments editor |
| Patient sends message to clinician | Message box → Send |
| Clinician reads patient message | Clinician view → Patient Messages |
| Language switch EN↔ES | Language switcher (full reload + PIN cache) |
