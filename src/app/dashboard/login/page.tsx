"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Store, Lock, Mail, ArrowRight, ShieldCheck } from "lucide-react";

export default function DashboardLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "error" | "success" } | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const supabase = createClient();

      if (mode === "password") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/dashboard");
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) throw error;
        setMessage({
          text: "Magic link sent! Check your email inbox to access your dashboard.",
          type: "success",
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setMessage({ text: msg, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleDemoAccess = () => {
    document.cookie = "qrly_dev_owner=true; path=/; max-age=86400";
    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 font-black text-2xl text-slate-950 shadow-xl shadow-amber-500/20 mb-4">
            Q
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Shop Owner Portal
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Sign in to manage your kiosk queue, pricing, and hardware
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8 shadow-2xl">
          {/* Mode Switcher */}
          <div className="flex rounded-lg bg-slate-950 p-1 mb-6 border border-slate-800">
            <button
              type="button"
              onClick={() => setMode("password")}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                mode === "password"
                  ? "bg-slate-800 text-amber-400 shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Email & Password
            </button>
            <button
              type="button"
              onClick={() => setMode("magic")}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                mode === "magic"
                  ? "bg-slate-800 text-amber-400 shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Passwordless Magic Link
            </button>
          </div>

          {message && (
            <div
              className={`mb-6 rounded-lg p-3 text-xs font-medium ${
                message.type === "error"
                  ? "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                  : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
              }`}
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Shop Owner Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@quickprint.in"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
            </div>

            {mode === "password" && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 rounded-xl bg-amber-400 py-3 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50 transition-colors shadow-lg shadow-amber-400/20"
            >
              <span>{loading ? "Authenticating..." : mode === "password" ? "Sign In" : "Send Magic Link"}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Quick Demo Mode for local review */}
          <div className="mt-8 border-t border-slate-800 pt-6">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Local Testing & Evaluation</span>
              <span className="flex items-center space-x-1 text-[11px] font-medium text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Dev Ready</span>
              </span>
            </div>
            <button
              type="button"
              onClick={handleDemoAccess}
              className="mt-2 w-full flex items-center justify-center space-x-2 rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Store className="h-3.5 w-3.5 text-amber-400" />
              <span>Enter Demo Kiosk Dashboard (quickprint)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
