"use client";
import type { Appointment } from "@/types";

import { useEffect, useState } from "react";

import { supabaseBrowser } from "@/lib/supabase";

export function useRealtimeAppointment(
  patientId: string,
  initial: Appointment[],
) {
  const [appointments, setAppointments] = useState<Appointment[]>(initial);

  useEffect(() => {
    setAppointments(initial);
  }, [initial]);

  useEffect(() => {
    if (!patientId) return;
    const channel = supabaseBrowser
      .channel(`appointments:${patientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `patient_id=eq.${patientId}`,
        },
        (payload) => {
          setAppointments((prev) => {
            const updated = payload.new as Appointment;
            const existing = prev.find((a) => a.id === updated.id);
            // Spread existing first so joined fields (e.g. doctors) are preserved —
            // realtime payloads are raw rows with no joined columns.
            const merged = existing ? { ...existing, ...updated } : updated;

            return existing
              ? prev.map((a) => (a.id === updated.id ? merged : a))
              : [...prev, merged];
          });
        },
      )
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, [patientId]);

  return appointments;
}
