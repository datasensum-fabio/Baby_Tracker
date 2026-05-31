"use client";

import { useState } from "react";
import { X, Copy, Check } from "lucide-react";

interface Props {
  code: string;
  onClose: () => void;
}

export default function ShareModal({ code, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={onClose}>
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Share with carers</h2>
          <button onClick={onClose} className="p-2 rounded-full bg-gray-100"><X size={20} /></button>
        </div>
        <p className="text-gray-600 text-sm">
          Share this code with anyone who cares for your baby. They&apos;ll enter it on the setup screen to see and log activities.
        </p>
        <div className="bg-gray-50 rounded-2xl p-4 text-center">
          <p className="text-3xl font-mono font-bold text-sleep tracking-wider">{code}</p>
        </div>
        <button
          onClick={copy}
          className="w-full bg-sleep text-white rounded-xl p-4 font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          {copied ? <Check size={20} /> : <Copy size={20} />}
          {copied ? "Copied!" : "Copy code"}
        </button>
        <p className="text-xs text-gray-400 text-center">
          Anyone with this code can view and log activities.
        </p>
      </div>
    </div>
  );
}
