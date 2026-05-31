"use client";

import { useEffect, useState } from "react";
import { X, Download, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Inline card shown on home page - more visible than a floating banner
export function InstallCard() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showIosSteps, setShowIosSteps] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsStandalone(true);
      return;
    }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const android = /android/i.test(navigator.userAgent);
    setIsIos(ios);
    setIsAndroid(android);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const wasDismissed = localStorage.getItem("install-card-dismissed");
    if (wasDismissed) setDismissed(true);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    setDismissed(true);
    localStorage.setItem("install-card-dismissed", "1");
  }

  async function installAndroid() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") { setDeferredPrompt(null); dismiss(); }
  }

  if (isStandalone || dismissed) return null;
  if (!isIos && !isAndroid && !deferredPrompt) return null;

  return (
    <div className="bg-white rounded-3xl shadow-sm overflow-hidden border border-purple-100">
      <div className="bg-gradient-to-r from-sleep to-feed px-4 py-3 flex items-center justify-between">
        <p className="text-white font-semibold text-sm">📲 Add to Home Screen</p>
        <button onClick={dismiss} className="text-white/60 active:text-white">
          <X size={16} />
        </button>
      </div>

      <div className="px-4 py-4">
        {/* Android with native prompt */}
        {deferredPrompt && (
          <div className="flex items-center gap-3">
            <div className="text-3xl">👶</div>
            <div className="flex-1">
              <p className="text-sm text-gray-600">Install Baby Tracker on your home screen for quick access — no app store needed.</p>
            </div>
            <button
              onClick={installAndroid}
              className="flex items-center gap-1.5 bg-sleep text-white rounded-xl px-4 py-2.5 font-semibold text-sm active:opacity-80 flex-shrink-0"
            >
              <Download size={15} /> Install
            </button>
          </div>
        )}

        {/* Android without native prompt (e.g. Samsung Browser) */}
        {isAndroid && !deferredPrompt && (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">Add Baby Tracker to your home screen:</p>
            <ol className="text-sm text-gray-500 space-y-1 list-decimal list-inside">
              <li>Tap the <strong>⋮ menu</strong> in your browser</li>
              <li>Tap <strong>&quot;Add to Home screen&quot;</strong></li>
              <li>Tap <strong>Add</strong></li>
            </ol>
          </div>
        )}

        {/* iOS Safari */}
        {isIos && !deferredPrompt && (
          <div className="space-y-3">
            {!showIosSteps ? (
              <div className="flex items-center gap-3">
                <div className="text-3xl">👶</div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600">Install Baby Tracker on your iPhone home screen — works like a native app.</p>
                </div>
                <button
                  onClick={() => setShowIosSteps(true)}
                  className="flex items-center gap-1.5 bg-sleep text-white rounded-xl px-3 py-2.5 font-semibold text-sm active:opacity-80 flex-shrink-0"
                >
                  <Share size={14} /> How?
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-700">Follow these steps in Safari:</p>
                <div className="space-y-2">
                  {[
                    { step: "1", icon: "⬆️", text: "Tap the Share button at the bottom of Safari" },
                    { step: "2", icon: "➕", text: 'Scroll down and tap "Add to Home Screen"' },
                    { step: "3", icon: "✅", text: 'Tap "Add" in the top right corner' },
                  ].map((s) => (
                    <div key={s.step} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                      <span className="text-xl">{s.icon}</span>
                      <p className="text-sm text-gray-600">{s.text}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 text-center">
                  ⚠️ Must be using <strong>Safari</strong> — Chrome on iOS cannot install apps.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Floating banner used on sub-pages (dashboard)
export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) { setIsStandalone(true); return; }
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", handler);
    if (localStorage.getItem("install-card-dismissed")) setDismissed(true);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (isStandalone || dismissed || !deferredPrompt) return null;

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDeferredPrompt(null);
    setDismissed(true);
    localStorage.setItem("install-card-dismissed", "1");
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 max-w-lg mx-auto">
      <div className="bg-sleep text-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl">
        <span className="text-2xl">👶</span>
        <div className="flex-1">
          <p className="font-semibold text-sm">Add to Home Screen</p>
          <p className="text-white/70 text-xs">Use Baby Tracker like a native app</p>
        </div>
        <button onClick={install} className="bg-white text-sleep font-semibold text-sm rounded-xl px-3 py-1.5 active:opacity-80">
          Install
        </button>
        <button onClick={() => { setDismissed(true); localStorage.setItem("install-card-dismissed", "1"); }} className="p-1 opacity-60">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
