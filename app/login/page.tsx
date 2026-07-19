"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        setError("Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      setLoading(false);
      if (error) {
        setError("Registrierung fehlgeschlagen: " + error.message);
        return;
      }
      setNotice("Konto erstellt. Sie können sich jetzt anmelden.");
      setMode("login");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="aktenzeichen mb-4 text-xs">AZ. IF-2026-001</div>
          <h1 className="font-serif text-3xl font-semibold text-ink">InsolvenzFlow</h1>
          <p className="mt-2 text-sm text-ash">Kanzleiverwaltung für Insolvenzrecht</p>
        </div>

        <div className="bg-white border border-ink/10 rounded-sm shadow-sm p-8">
          <div className="flex mb-6 border-b border-ink/10">
            <button
              className={`flex-1 pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                mode === "login" ? "border-oxblood text-ink" : "border-transparent text-ash"
              }`}
              onClick={() => setMode("login")}
              type="button"
            >
              Anmelden
            </button>
            <button
              className={`flex-1 pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                mode === "signup" ? "border-oxblood text-ink" : "border-transparent text-ash"
              }`}
              onClick={() => setMode("signup")}
              type="button"
            >
              Konto erstellen
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="block text-xs font-medium text-ash mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-oxblood/40"
                  placeholder="Dr. Julia Weber"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-ash mb-1">E-Mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-oxblood/40"
                placeholder="kanzlei@beispiel.de"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ash mb-1">Passwort</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-oxblood/40"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-sm text-oxblood">{error}</p>}
            {notice && <p className="text-sm text-moss">{notice}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ink text-paper rounded-sm py-2.5 text-sm font-medium hover:bg-ink/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Bitte warten…" : mode === "login" ? "Anmelden" : "Konto erstellen"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
