import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/server/auth";
import { Nav } from "@/components/nav";
import { MotionProvider, PageTransition } from "@/components/motion";
import { Toaster } from "@/components/ui";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = (await getServerSession(nextAuthOptions())) as {
    user?: { name?: string | null; email?: string | null; role?: string };
  } | null;
  if (!session?.user?.email) redirect("/login");

  return (
    <div className="min-h-screen">
      <Nav user={session.user} />
      {/* lg:pl-64 reserves the fixed sidebar's width; the sidebar itself is
          positioned outside this padding, not inside it. */}
      <div className="lg:pl-64">
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <MotionProvider>
            <PageTransition>{children}</PageTransition>
          </MotionProvider>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
