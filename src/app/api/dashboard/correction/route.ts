import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";
import { addMemory } from "@/lib/supermemory";
import { fireEvent } from "@/lib/events";

export async function POST(req: NextRequest) {
  const { patientId, entityType, oldValue, newValue, sourceCallId } =
    await req.json();

  if (!patientId || !entityType || !newValue) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Save correction
  const { data: correction } = await supabaseAdmin
    .from("corrections")
    .insert({
      patient_id: patientId,
      entity_type: entityType,
      old_value: oldValue,
      new_value: newValue,
      corrected_by: "patient",
      source_call_id: sourceCallId ?? null,
    })
    .select()
    .single();

  // Update medications if it's a drug correction
  if (entityType === "drug" || entityType === "dose") {
    await supabaseAdmin
      .from("medications")
      .update({
        drug_name: newValue,
        source: "patient_verified",
        verified_at: new Date().toISOString(),
      })
      .eq("patient_id", patientId)
      .eq("drug_name", oldValue);
  }

  // Update Supermemory so next call knows
  await addMemory(
    patientId,
    `Patient corrected ${entityType}: "${oldValue}" → "${newValue}" on ${new Date().toISOString()}`,
  );

  // Add timeline event
  await supabaseAdmin.from("patient_timeline").insert({
    patient_id: patientId,
    event_type: "correction",
    content: { entityType, oldValue, newValue },
    severity: 0,
    source: "patient_verified",
  });

  // Fire event for downstream automation
  await fireEvent({
    type: "correction.created",
    patientId,
    correctionId: correction?.id ?? "",
  });

  return NextResponse.json({ ok: true });
}
