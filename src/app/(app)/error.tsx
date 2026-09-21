"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, ErrorState, PageHeader } from "@/components/ui";

/**
 * Error boundary for the authenticated app.
 *
 * Without it an unhandled server error renders Next's default page: unbranded,
 * with no way back and no retry. Sheets reads can fail transiently on quota or
 * network, and a retry often just works — so `reset` is the primary action.
 *
 * The raw message is deliberately not shown: it can carry spreadsheet ids or
 * internal paths. It is logged to the console for whoever is debugging.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app]", error);
  }, [error]);

  return (
    <div>
      <PageHeader title="Something went wrong" subtitle="The page could not be loaded." />
      <ErrorState
        message="This page failed to load. It is often a temporary problem reading the spreadsheet — trying again usually works."
        onRetry={reset}
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild variant="secondary">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
      {error.digest ? (
        <p className="mt-4 text-xs text-slate-400">
          Reference <code className="font-mono">{error.digest}</code> — quote this if you report the problem.
        </p>
      ) : null}
    </div>
  );
}
