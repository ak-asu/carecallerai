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
            const exists = prev.find((a) => a.id === updated.id);

            return exists
              ? prev.map((a) => (a.id === updated.id ? updated : a))
              : [...prev, updated];
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
