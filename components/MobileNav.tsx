"use client";

import { useState } from "react";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";

const NAV_LINKS = [
  { href: "/dashboard", label: "Übersicht" },
  { href: "/dashboard/reports", label: "Berichte" },
  { href: "/dashboard/cases", label: "Alle Akten" },
  { href: "/dashboard/intake", label: "Neue Anfragen" },
  { href: "/dashboard/cases/new", label: "Neue Akte anlegen" },
  { href: "/dashboard/settings", label: "Einstellungen" },
];

export default function MobileNav({ userEmail }: { userEmail: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden bg-ink text-paper">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="font-serif text-lg font-semibold">InsolvenzFlow</div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Menü"
          className="p-2 -mr-2"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>
      {open && (
        <nav className="px-3 pb-3 space-y-1 text-sm border-t border-paper/10 pt-3">
          <div className="text-xs text-paper/50 px-3 pb-2">{userEmail}</div>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 rounded-sm hover:bg-paper/10 transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-paper/10 mt-2">
            <SignOutButton />
          </div>
        </nav>
      )}
    </div>
  );
}
