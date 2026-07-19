"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="w-full text-left px-3 py-2 rounded-sm text-sm text-paper/70 hover:bg-paper/10 hover:text-paper transition-colors"
    >
      Abmelden
    </button>
  );
}
