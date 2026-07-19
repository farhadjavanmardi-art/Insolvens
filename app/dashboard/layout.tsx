import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 bg-ink text-paper flex flex-col">
        <div className="px-6 py-6 border-b border-paper/10">
          <div className="font-serif text-xl font-semibold">InsolvenzFlow</div>
          <div className="text-xs text-paper/50 mt-1">{user.email}</div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 text-sm">
          <Link href="/dashboard" className="block px-3 py-2 rounded-sm hover:bg-paper/10 transition-colors">
            Übersicht
          </Link>
          <Link href="/dashboard/cases" className="block px-3 py-2 rounded-sm hover:bg-paper/10 transition-colors">
            Alle Akten
          </Link>
          <Link href="/dashboard/cases/new" className="block px-3 py-2 rounded-sm hover:bg-paper/10 transition-colors">
            Neue Akte anlegen
          </Link>
        </nav>
        <div className="px-3 py-4 border-t border-paper/10">
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 bg-paper">{children}</main>
    </div>
  );
}
