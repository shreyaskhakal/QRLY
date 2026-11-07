"use client";

import { useState, useEffect } from "react";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import {
  KeyRound,
  Save,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  Settings,
  ShieldAlert,
  Sliders,
} from "lucide-react";

export default function DashboardSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rotatingKey, setRotatingKey] = useState(false);
  const [showRotateModal, setShowRotateModal] = useState(false);
  const [newAgentKey, setNewAgentKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Form fields
  const [bwRupees, setBwRupees] = useState("2.00");
  const [colorRupees, setColorRupees] = useState("10.00");
  const [qDraftMult, setQDraftMult] = useState("1.00");
  const [qNormalMult, setQNormalMult] = useState("1.00");
  const [qHighMult, setQHighMult] = useState("1.50");
  const [maxFileMb, setMaxFileMb] = useState("25");
  const [orderExpiryMinutes, setOrderExpiryMinutes] = useState("30");

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/dashboard/summary");
      if (!res.ok) throw new Error("Failed to load settings");
      const data = await res.json();
      if (data.shop) {
        setBwRupees(((data.shop.bwPricePaise || 200) / 100).toFixed(2));
        setColorRupees(((data.shop.colorPricePaise || 1000) / 100).toFixed(2));
        setOrderExpiryMinutes(String(data.shop.orderExpiryMinutes || 30));
      }
    } catch {
      setMessage({ text: "Failed to load shop configuration", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const bwPaise = Math.round(parseFloat(bwRupees) * 100);
      const colorPaise = Math.round(parseFloat(colorRupees) * 100);
      const dMult = parseFloat(qDraftMult);
      const nMult = parseFloat(qNormalMult);
      const hMult = parseFloat(qHighMult);
      const mb = parseInt(maxFileMb, 10);
      const expiry = parseInt(orderExpiryMinutes, 10);

      if (isNaN(bwPaise) || bwPaise < 0) throw new Error("Invalid B&W price");
      if (isNaN(colorPaise) || colorPaise < 0) throw new Error("Invalid Color price");
      if (isNaN(dMult) || dMult <= 0) throw new Error("Invalid Draft multiplier");
      if (isNaN(nMult) || nMult <= 0) throw new Error("Invalid Normal multiplier");
      if (isNaN(hMult) || hMult <= 0) throw new Error("Invalid High quality multiplier");
      if (isNaN(mb) || mb <= 0) throw new Error("Invalid max file size");
      if (isNaN(expiry) || expiry <= 0) throw new Error("Invalid expiry time");

      const res = await fetch("/api/dashboard/shop", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bwPricePaise: bwPaise,
          colorPricePaise: colorPaise,
          qDraftMult: dMult,
          qNormalMult: nMult,
          qHighMult: hMult,
          maxFileMb: mb,
          orderExpiryMinutes: expiry,
        }),
      });

      if (!res.ok) throw new Error("Failed to update settings");
      setMessage({ text: "Pricing and shop parameters updated successfully!", type: "success" });
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : "Save failed", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleRotateKey = async () => {
    try {
      setRotatingKey(true);
      const res = await fetch("/api/dashboard/agent-key/rotate", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Key rotation failed");
      const data = await res.json();
      setNewAgentKey(data.agentKey);
      setShowRotateModal(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Key rotation failed");
    } finally {
      setRotatingKey(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardNav shopName="QuickPrint Kiosk" shopSlug="quickprint" />

      {/* Rotate Key Confirmation Modal */}
      {showRotateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center space-x-3 text-amber-400 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/10">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Rotate Agent API Key?</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              Rotating your Agent API key will immediately invalidate the previous key. Any running
              print agent daemons will disconnect until updated with the new key in{" "}
              <code className="text-amber-300 font-mono">config.yaml</code>.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowRotateModal(false)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rotatingKey}
                onClick={handleRotateKey}
                className="rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50"
              >
                {rotatingKey ? "Generating..." : "Rotate Key Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Kiosk Configuration & Rates
            </h1>
            <p className="text-sm text-slate-400">
              Define per-page billing rates, quality multipliers, and hardware credentials
            </p>
          </div>
          {loading && (
            <div className="flex items-center space-x-2 text-xs text-amber-400">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>Loading...</span>
            </div>
          )}
        </div>

        {message && (
          <div
            className={`mb-6 rounded-xl border p-4 text-sm font-medium ${
              message.type === "success"
                ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                : "bg-rose-950/40 border-rose-500/40 text-rose-300"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Revealed New Agent Key Alert */}
        {newAgentKey && (
          <div className="mb-8 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-6 shadow-xl">
            <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm mb-2">
              <AlertTriangle className="h-5 w-5" />
              <span>New Agent API Key Generated</span>
            </div>
            <p className="text-xs text-slate-300 mb-4">
              Please copy this key immediately. For security reasons, it cannot be displayed again.
              Set this key in your local print agent <code className="text-amber-300">config.yaml</code>.
            </p>
            <div className="flex items-center space-x-2">
              <div className="flex-1 rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-amber-300 break-all select-all">
                {newAgentKey}
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(newAgentKey)}
                className="flex items-center space-x-1.5 rounded-xl bg-amber-400 px-4 py-3 text-xs font-bold text-slate-950 hover:bg-amber-300"
              >
                {copiedKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copiedKey ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Form Container */}
        <form onSubmit={handleSaveSettings} className="space-y-8">
          {/* Base Rates Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
            <h2 className="text-base font-bold text-white mb-1 flex items-center space-x-2">
              <Sliders className="h-4 w-4 text-amber-400" />
              <span>Per-Page Base Pricing</span>
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Base rates charged per single-sided printed page (in Indian Rupees).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Black & White Price (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm font-bold text-slate-500">₹</span>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    required
                    value={bwRupees}
                    onChange={(e) => setBwRupees(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-8 pr-4 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Default: ₹2.00 (200 paise) per page
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Color Print Price (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm font-bold text-slate-500">₹</span>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    required
                    value={colorRupees}
                    onChange={(e) => setColorRupees(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-8 pr-4 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Default: ₹10.00 (1000 paise) per page
                </p>
              </div>
            </div>
          </div>

          {/* Quality Multipliers Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
            <h2 className="text-base font-bold text-white mb-1 flex items-center space-x-2">
              <Settings className="h-4 w-4 text-amber-400" />
              <span>Quality Multipliers</span>
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Multiplier applied to the base rate based on user-selected DPI quality.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Draft Mode (300 DPI)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  value={qDraftMult}
                  onChange={(e) => setQDraftMult(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-slate-500">Standard: 1.00x</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Normal Mode (600 DPI)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  value={qNormalMult}
                  onChange={(e) => setQNormalMult(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-slate-500">Standard: 1.00x</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  High Quality (1200 DPI)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  value={qHighMult}
                  onChange={(e) => setQHighMult(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-slate-500">Standard: 1.50x</p>
              </div>
            </div>
          </div>

          {/* Operational Limits */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
            <h2 className="text-base font-bold text-white mb-1">Upload Limits & Expiration</h2>
            <p className="text-xs text-slate-400 mb-6">
              Constraints enforced during customer upload and checkout sessions.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Max File Upload Size (MB)
                </label>
                <input
                  type="number"
                  min="5"
                  max="100"
                  required
                  value={maxFileMb}
                  onChange={(e) => setMaxFileMb(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-slate-500">Recommended: 25 MB</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Unpaid Order Expiry (Minutes)
                </label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  required
                  value={orderExpiryMinutes}
                  onChange={(e) => setOrderExpiryMinutes(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Unpaid drafts are automatically swept after this window
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-2 rounded-xl bg-amber-400 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50 transition-colors shadow-lg shadow-amber-400/20"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? "Saving Changes..." : "Save Pricing Configuration"}</span>
            </button>
          </div>
        </form>

        {/* Agent Key Card */}
        <div className="mt-12 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 text-white font-bold text-base">
                <KeyRound className="h-4 w-4 text-amber-400" />
                <span>Shop Agent API Key</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Used by the shop Raspberry Pi / Windows spooler daemon to poll jobs via outbound HTTPS
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowRotateModal(true)}
              className="flex items-center justify-center space-x-1.5 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-xs font-bold text-amber-400 hover:bg-amber-400/20 transition-colors shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Rotate Agent Key</span>
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-3.5 flex items-center justify-between">
            <div className="font-mono text-xs text-slate-400">
              agk_live_••••••••••••••••••••••••••••••••
            </div>
            <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20">
              Active Key Enforced
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
