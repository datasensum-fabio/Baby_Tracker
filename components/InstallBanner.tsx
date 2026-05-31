"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Already installed as PWA
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsStandalone(true);
      return;
    }
    // iOS detection
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIos(ios);

    // Android / Chrome install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const wasDismissed = sessionStorage.getItem("install-dismissed");
    if (wasDismissed) setDismissed(true);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    setDismissed(true);
    sessionStorage.setItem("install-dismissed", "1");
  }

  async function installAndroid() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDeferredPrompt(null);
    dismiss();
  }

  if (isStandalone || dismissed) return null;

  // Android: show native install button
  if (deferredPrompt) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 max-w-lg mx-auto p-4">
        <div className="bg-sleep text-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl">
          <span className="text-2xl">👶</span>
          <div className="flex-1">
            <p className="font-semibold text-sm">Add to Home Screen</p>
            <p className="text-white/70 text-xs">Use Baby Tracker like a native app</p>
          </div>
          <button onClick={installAndroid} className="bg-white text-sleep font-semibold text-sm rounded-xl px-3 py-1.5 active:opacity-80">
            Install
          </button>
          <button onClick={dismiss} className="p-1 opacity-60 active:opacity-100">
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  // iOS: show manual instructions
  if (isIos) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 max-w-lg mx-auto p-4">
        <div className="bg-gray-900 text-white rounded-2xl px-4 py-4 shadow-xl relative">
          <button onClick={dismiss} className="absolute top-3 right-3 opacity-60 active:opacity-100">
            <X size={16} />
          </button>
          <p className="font-semibold text-sm mb-1">👶 Add to Home Screen</p>
          <p className="text-gray-300 text-xs leading-relaxed">
            Tap the <span className="inline-block bg-gray-700 rounded px-1 py-0.5 font-mono">Share</span> button at the bottom of Safari, then tap{" "}
            <span className="font-semibold text-white">Add to Home Screen</span>.
          </p>
          {/* Arrow pointing down */}
          <div className="flex justify-center mt-3">
            <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-gray-900" />
          </div>
        </div>
      </div>
    );
  }

  return null;
}
