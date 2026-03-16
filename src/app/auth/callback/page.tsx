"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  useEffect(() => {
    supabase.auth.getSession().then(() => {
      window.location.href = "/signals";
    });
  }, []);

  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <p className="text-[#374151]">Confirming your account...</p>
    </div>
  );
}
