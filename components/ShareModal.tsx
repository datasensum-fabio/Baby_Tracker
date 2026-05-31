"use client";

import { useState } from "react";
import { X, Copy, Check, MessageCircle } from "lucide-react";

interface Props {
  code: string;
  babyName: string;
  onClose: () => void;
}

const APP_URL = "https://baby-tracker-flame-ten.vercel.app";

export default function ShareModal({ code, babyName, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const inviteLink = `${APP_URL}/join/${code}`;
  const whatsappText = `Hi! I'd like to share access to ${babyName}'s Baby Tracker with you.\n\nTap the link to create your account and you'll be automatically connected:\n${inviteLink}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

  async function copyLink() {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={onClose}>
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Invite a carer</h2>
          <button onClick={onClose} className="p-2 rounded-full bg-gray-100"><X size={20} /></button>
        </div>

        <p className="text-gray-500 text-sm">
          Send a link — when they sign up they&apos;ll be automatically connected to <strong>{babyName}</strong>.
        </p>

        {/* WhatsApp button — primary action */}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full bg-[#25D366] text-white rounded-2xl p-4 font-semibold flex items-center justify-center gap-3 active:opacity-80 transition-opacity text-lg"
        >
          <MessageCircle size={22} />
          Share via WhatsApp
        </a>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-xs text-gray-400">or share the link directly</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        {/* Invite link */}
        <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2">
          <p className="flex-1 text-xs text-gray-500 font-mono truncate">{inviteLink}</p>
          <button onClick={copyLink} className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm font-medium text-gray-600 active:bg-gray-50 flex-shrink-0">
            {copied ? <><Check size={14} className="text-green-500" /> Copied</> : <><Copy size={14} /> Copy</>}
          </button>
        </div>

        {/* Baby code fallback */}
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-1">Baby code (manual entry)</p>
          <p className="text-xl font-mono font-bold text-sleep tracking-widest">{code}</p>
        </div>
      </div>
    </div>
  );
}
