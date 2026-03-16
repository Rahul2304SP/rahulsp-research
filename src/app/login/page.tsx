"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Tab = "signin" | "signup";

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      window.location.href = "/signals";
    } catch (err: any) {
      setError(err.message ?? "Failed to sign in");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      setMessage("Check your email to confirm your account.");
    } catch (err: any) {
      setError(err.message ?? "Failed to sign up");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-8 shadow-sm">
        <h1 className="font-serif text-2xl text-[#1a1a2e] text-center mb-6">
          {tab === "signin" ? "Welcome back" : "Create an account"}
        </h1>

        {/* Tabs */}
        <div className="flex mb-6 rounded-lg bg-[#f3f4f6] p-1">
          <button
            onClick={() => {
              setTab("signin");
              setError(null);
              setMessage(null);
            }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === "signin"
                ? "bg-white text-[#1a1a2e] shadow-sm"
                : "text-[#6b7280] hover:text-[#374151]"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setTab("signup");
              setError(null);
              setMessage(null);
            }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === "signup"
                ? "bg-white text-[#1a1a2e] shadow-sm"
                : "text-[#6b7280] hover:text-[#374151]"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Error / Message */}
        {error && (
          <div className="mb-4 rounded-md bg-[#fef2f2] border border-[#fecaca] px-4 py-3 text-sm text-[#991b1b]">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 rounded-md bg-[#f0fdf4] border border-[#bbf7d0] px-4 py-3 text-sm text-[#166534]">
            {message}
          </div>
        )}

        {/* Sign In Form */}
        {tab === "signin" && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-md border border-[#e5e7eb] px-3 py-2.5 text-sm text-[#1a1a2e] placeholder-[#9ca3af] focus:border-[#1e40af] focus:outline-none focus:ring-1 focus:ring-[#1e40af]"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-md border border-[#e5e7eb] px-3 py-2.5 text-sm text-[#1a1a2e] placeholder-[#9ca3af] focus:border-[#1e40af] focus:outline-none focus:ring-1 focus:ring-[#1e40af]"
                placeholder="Enter your password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-[#1e40af] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1e3a8a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        )}

        {/* Sign Up Form */}
        {tab === "signup" && (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-md border border-[#e5e7eb] px-3 py-2.5 text-sm text-[#1a1a2e] placeholder-[#9ca3af] focus:border-[#1e40af] focus:outline-none focus:ring-1 focus:ring-[#1e40af]"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-md border border-[#e5e7eb] px-3 py-2.5 text-sm text-[#1a1a2e] placeholder-[#9ca3af] focus:border-[#1e40af] focus:outline-none focus:ring-1 focus:ring-[#1e40af]"
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-md border border-[#e5e7eb] px-3 py-2.5 text-sm text-[#1a1a2e] placeholder-[#9ca3af] focus:border-[#1e40af] focus:outline-none focus:ring-1 focus:ring-[#1e40af]"
                placeholder="Confirm your password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-[#1e40af] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1e3a8a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>
        )}

        {/* Footer link */}
        <div className="mt-6 text-center">
          {tab === "signin" && (
            <button
              onClick={async () => {
                if (!email) {
                  setError("Enter your email first, then click Forgot password");
                  return;
                }
                setError(null);
                setLoading(true);
                try {
                  const { error } = await supabase.auth.resetPasswordForEmail(
                    email,
                    { redirectTo: `${window.location.origin}/auth/callback` }
                  );
                  if (error) throw error;
                  setMessage("Password reset email sent. Check your inbox.");
                } catch (err: any) {
                  setError(err.message ?? "Failed to send reset email");
                } finally {
                  setLoading(false);
                }
              }}
              className="text-xs text-[#6b7280] hover:text-[#1e40af] hover:underline"
            >
              Forgot password?
            </button>
          )}
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-[#9ca3af]">
        By signing in you agree to our terms of service.
      </p>
    </div>
  );
}
