import Link from "next/link";

export function NewEnquiryButton() {
  return (
    <Link href="/acquisitions/new" className="btn-primary">
      + New seller enquiry
    </Link>
  );
}
