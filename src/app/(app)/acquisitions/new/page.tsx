import { requireSession } from "@/server/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { EnquiryForm } from "./enquiry-form";

export default async function NewEnquiryPage() {
  const session = await requireSession();
  if (!can(session.user, "acquisition.manage")) {
    return <div className="card p-6 text-sm text-red-700">You do not have permission to create enquiries.</div>;
  }
  return (
    <div>
      <PageHeader title="New seller enquiry" subtitle="Capture the seller, vehicle and expected price" />
      <EnquiryForm />
    </div>
  );
}
