"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function AuthNav() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) =>
      setUser(session?.user ?? null)
    );
    return () => subscription.unsubscribe();
  }, []);

  if (user) {
    return (
      <div className="flex items-center gap-3 text-xs">
        <span className="text-[#6b7280] max-w-[140px] truncate">
          {user.email}
        </span>
        <button
          onClick={() => {
            supabase.auth.signOut();
            window.location.href = "/";
          }}
          className="text-[#dc2626] hover:underline"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <a href="/login" className="text-xs text-[#1e40af] hover:underline">
      Sign in
    </a>
  );
}
