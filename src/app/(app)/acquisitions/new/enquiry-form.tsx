"use client";

import { useForm } from "react-hook-form";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { enquiryInputSchema, EnquiryInput } from "@/lib/form-schemas";
import { Field, toast } from "@/components/ui";

export function EnquiryForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<EnquiryInput>({
    resolver: zodResolver(enquiryInputSchema) as never,
    defaultValues: {
      sellerAltPhone: "",
      sellerEmail: "",
      sellerAddress: "",
      variant: "",
      vin: "",
      engineNumber: "",
      registrationLocation: "",
      inspectionAppointmentAt: "",
      negotiationNotes: "",
      leadSource: "Walk-in",
      fuel: "Petrol",
      transmission: "Manual",
      ownershipCount: 1
    }
  });

  async function onSubmit(values: EnquiryInput) {
    setServerError("");
    const res = await fetch("/api/acquisitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setServerError(j.error ?? "Could not save the enquiry.");
      return;
    }
    toast.success("Seller enquiry created");
    router.push("/acquisitions");
  }

  return (
    <form className="card max-w-3xl space-y-4 p-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* Staff are entering history they already hold on paper, and it is often
          incomplete. Say so, rather than letting them discover it by hitting
          validation errors. */}
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
        Fill in whatever you have — every field can be completed later. Only two things are needed to save:
        the seller&rsquo;s <span className="font-medium text-slate-800">name or phone</span>, and the car&rsquo;s{" "}
        <span className="font-medium text-slate-800">registration, make or model</span>.
      </p>
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-700">Seller</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Seller name" error={errors.sellerName?.message}>
            <input className="input" {...register("sellerName")} />
          </Field>
          <Field label="Seller phone" error={errors.sellerPhone?.message}>
            <input className="input" inputMode="tel" {...register("sellerPhone")} />
          </Field>
          <Field label="Seller alt phone" error={errors.sellerAltPhone?.message}>
            <input className="input" inputMode="tel" {...register("sellerAltPhone")} />
          </Field>
          <Field label="Seller email" error={errors.sellerEmail?.message}>
            <input className="input" type="email" {...register("sellerEmail")} />
          </Field>
          <Field label="Seller address" error={errors.sellerAddress?.message}>
            <input className="input" {...register("sellerAddress")} />
          </Field>
          <Field label="Lead source" error={errors.leadSource?.message}>
            <select className="input" {...register("leadSource")}>
              {["Walk-in", "Phone", "Website", "Referral", "Social media", "Newspaper", "OLX/Portals", "Other"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-700">Vehicle (seller-reported)</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Make" error={errors.make?.message}><input className="input" {...register("make")} /></Field>
          <Field label="Model" error={errors.model?.message}><input className="input" {...register("model")} /></Field>
          <Field label="Variant" error={errors.variant?.message}><input className="input" {...register("variant")} /></Field>
          <Field label="Manufacture year" error={errors.manufactureYear?.message}><input className="input" type="number" {...register("manufactureYear")} /></Field>
          <Field label="Registration year" error={errors.registrationYear?.message}><input className="input" type="number" {...register("registrationYear")} /></Field>
          <Field label="Fuel" error={errors.fuel?.message}>
            <select className="input" {...register("fuel")}>{["Petrol", "Diesel", "CNG", "Electric", "Hybrid"].map((s) => <option key={s}>{s}</option>)}</select>
          </Field>
          <Field label="Transmission" error={errors.transmission?.message}>
            <select className="input" {...register("transmission")}>{["Manual", "Automatic"].map((s) => <option key={s}>{s}</option>)}</select>
          </Field>
          <Field label="Body type" error={errors.bodyType?.message}><input className="input" placeholder="Hatchback / Sedan / SUV" {...register("bodyType")} /></Field>
          <Field label="Colour" error={errors.colour?.message}><input className="input" {...register("colour")} /></Field>
          <Field label="Odometer (km)" error={errors.odometerKm?.message}><input className="input" type="number" {...register("odometerKm")} /></Field>
          <Field label="Owners" error={errors.ownershipCount?.message}><input className="input" type="number" {...register("ownershipCount")} /></Field>
          <Field label="Registration number" error={errors.registrationNumber?.message}><input className="input" {...register("registrationNumber")} /></Field>
          <Field label="VIN/chassis" error={errors.vin?.message}><input className="input" {...register("vin")} /></Field>
          <Field label="Engine no." error={errors.engineNumber?.message}><input className="input" {...register("engineNumber")} /></Field>
          <Field label="Registered at" error={errors.registrationLocation?.message}><input className="input" {...register("registrationLocation")} /></Field>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-700">Deal</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Expected price (₹)" error={errors.expectedPrice?.message}>
            <input className="input" inputMode="decimal" {...register("expectedPrice")} />
          </Field>
          <Field label="Inspection appointment" error={errors.inspectionAppointmentAt?.message}>
            <input className="input" type="datetime-local" {...register("inspectionAppointmentAt")} />
          </Field>
          <Field label="Follow-up date" error={errors.followUpDate?.message}>
            <input className="input" type="date" {...register("followUpDate")} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Negotiation notes" error={errors.negotiationNotes?.message}>
              <textarea className="input" rows={3} {...register("negotiationNotes")} />
            </Field>
          </div>
        </div>
      </fieldset>

      {serverError ? <p className="error-text" role="alert">{serverError}</p> : null}

      <div className="flex gap-2">
        <button className="btn-primary" disabled={isSubmitting}>{isSubmitting ? "Saving…" : "Create enquiry"}</button>
      </div>
    </form>
  );
}
