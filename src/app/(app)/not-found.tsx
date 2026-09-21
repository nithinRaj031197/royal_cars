import Link from "next/link";
import { Button, EmptyState, PageHeader } from "@/components/ui";

export default function NotFound() {
  return (
    <div>
      <PageHeader title="Not found" subtitle="That record does not exist, or it has been archived." />
      <EmptyState
        title="We could not find that page"
        hint="The link may be out of date, or the record may have been archived. Try searching from the relevant section."
        action={
          <Button asChild variant="secondary">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        }
      />
    </div>
  );
}
