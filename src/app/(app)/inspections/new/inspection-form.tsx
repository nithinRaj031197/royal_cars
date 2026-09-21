"use client";

import { useFieldArray, useForm } from "react-hook-form";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { todayDateOnly } from "@/lib/dates";
import { zodResolver } from "@hookform/resolvers/zod";
import { inspectionInputSchema, InspectionInput } from "@/lib/form-schemas";
import { Field, toast } from "@/components/ui";

const AREAS = ["Exterior", "Interior", "Engine", "Transmission", "Tyres", "Battery", "AC", "Electrical", "Suspension", "Brakes", "Lights", "Underbody", "Leaks", "Test drive", "Documents"];
const CONDITIONS = ["Excellent", "Good", "Average", "Needs repair", "Critical", "Not inspected"];

export function InspectionForm({ vehicles, initialVehicleId }: { vehicles: Array<{ id: string; label: string }>; initialVehicleId: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const { register, control, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<InspectionInput>({
    resolver: zodResolver(inspectionInputSchema) as never,
    defaultValues: {
      vehicleId: initialVehicleId,
      acquisitionCaseId: "",
      type: "Pre-purchase",
      date: todayDateOnly(),
      odometerKm: 0,
      overallResult: "Pass with findings",
      accidentHistory: "Unknown",
      floodHistory: "Unknown",
      items: [{ area: "Exterior", condition: "Good", finding: "", createWorkOrder: false, workCategory: "" }]
    }
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const vehicleId = watch("vehicleId");

  async function onSubmit(values: InspectionInput) {
    setServerError("");
    const res = await fetch("/api/inspections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setServerError(j.error ?? "Could not save the inspection.");
      return;
    }
    toast.success("Inspection saved");
    router.push(`/inventory/${values.vehicleId}?tab=inspections`);
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="card grid gap-3 p-4 sm:grid-cols-2">
        <Field label="Vehicle" required error={errors.vehicleId?.message}>
          <select className="input" {...register("vehicleId")}>
            <option value="">Choose vehicle…</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </Field>
        <Field label="Type" required error={errors.type?.message}>
          <select className="input" {...register("type")}>
            {["Pre-purchase", "Receiving", "Post-repair", "Pre-delivery", "After-sale"].map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Date" required error={errors.date?.message}>
          <input className="input" type="date" {...register("date")} />
        </Field>
        <Field label="Odometer (km)" error={errors.odometerKm?.message}>
          <input className="input" type="number" {...register("odometerKm")} />
        </Field>
        <Field label="Overall result" required error={errors.overallResult?.message}>
          <select className="input" {...register("overallResult")}>
            {["Pass", "Pass with findings", "Fail", "Not completed"].map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Estimated repair (₹)" error={errors.estimatedRepair?.message}>
          <input className="input" inputMode="decimal" {...register("estimatedRepair")} />
        </Field>
        <Field label="Accident history" required error={errors.accidentHistory?.message}>
          <select className="input" {...register("accidentHistory")}>
            {["Unknown", "Reported", "Verified", "None"].map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Flood history" required error={errors.floodHistory?.message}>
          <select className="input" {...register("floodHistory")}>
            {["Unknown", "Reported", "Verified", "None"].map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Recommended work" error={errors.recommendedWork?.message}>
            <textarea className="input" rows={2} {...register("recommendedWork")} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Notes" error={errors.notes?.message}>
            <textarea className="input" rows={2} {...register("notes")} />
          </Field>
        </div>
      </div>

      <div className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold">Checklist</h3>
          <button type="button" className="btn-secondary" onClick={() => append({ area: "Engine", condition: "Not inspected", finding: "", createWorkOrder: false, workCategory: "" })}>
            + Add row
          </button>
        </div>
        <div className="space-y-2">
          {fields.map((f, idx) => (
            <div key={f.id} className="grid items-end gap-2 sm:grid-cols-12">
              <div className="sm:col-span-3">
                <Field label="Area"><select className="input" {...register(`items.${idx}.area`)}>{AREAS.map((a) => <option key={a}>{a}</option>)}</select></Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Condition"><select className="input" {...register(`items.${idx}.condition`)}>{CONDITIONS.map((c) => <option key={c}>{c}</option>)}</select></Field>
              </div>
              <div className="sm:col-span-4">
                <Field label="Finding"><input className="input" {...register(`items.${idx}.finding`)} /></Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Est. cost ₹"><input className="input" inputMode="decimal" {...register(`items.${idx}.estimatedCost`)} /></Field>
              </div>
              <div className="flex items-center gap-2 sm:col-span-1">
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" {...register(`items.${idx}.createWorkOrder`)} /> WO
                </label>
                {fields.length > 1 ? <button type="button" className="text-red-600" onClick={() => remove(idx)} aria-label="Remove row">✕</button> : null}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          “WO” creates a draft work order from the finding; its cost is counted once when the work order is completed.
        </p>
      </div>

      {serverError ? <p className="error-text" role="alert">{serverError}</p> : null}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={isSubmitting || !vehicleId}>{isSubmitting ? "Saving…" : "Save inspection"}</button>
      </div>
    </form>
  );
}
