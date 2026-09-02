import React, { useState } from 'react';
import { Share2, Copy, Check, MessageSquare, Mail, X, ExternalLink } from 'lucide-react';

export default function ShareModal({ isOpen, onClose, magicToken, clientName = "Client", pendingCount = 0 }) {
  const [copied, setCopied] = useState(false);
  const [clientPhone, setClientPhone] = useState('');

  if (!isOpen) return null;

  // Construct magic link URL
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://catnudge.pages.dev';
  const magicLink = `${origin}/?token=${magicToken || 'demo_token'}`;

  // Default pre-filled client message
  const defaultMessage = `Hi ${clientName}, here is your CatNudge link to categorize your ${pendingCount} uncategorized transactions: ${magicLink}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(magicLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const smsUrl = `sms:${clientPhone ? clientPhone : ''}?body=${encodeURIComponent(defaultMessage)}`;
  const mailtoUrl = `mailto:?subject=${encodeURIComponent(`Quick question regarding your bookkeeping for ${clientName}`)}&body=${encodeURIComponent(defaultMessage)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500 text-slate-900 rounded-lg">
              <Share2 className="w-4 h-4 font-bold" />
            </div>
            <h3 className="font-bold text-base">Share Client Magic Link</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          
          {/* Quick Copy Link Box */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Magic Link URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={magicLink}
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2.5 font-mono focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopy}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs transition shadow-sm shrink-0 ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-slate-900'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Quick Text / SMS Trigger */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Send SMS Nudge
            </label>
            <div className="space-y-2">
              <input
                type="tel"
                placeholder="Client Phone # (e.g., 555-0192)"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="w-full border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
              />
              <a
                href={smsUrl}
                className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition w-full"
              >
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <span>Open iMessage / Text App</span>
              </a>
            </div>
          </div>

          {/* Email Fallback */}
          <div>
            <a
              href={mailtoUrl}
              className="flex items-center justify-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs py-2.5 px-4 rounded-xl transition w-full"
            >
              <Mail className="w-4 h-4 text-slate-500" />
              <span>Send via Email Client</span>
            </a>
          </div>

          {/* Preview Portal Button */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Test client view in new tab</span>
            <a
              href={magicLink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:underline"
            >
              <span>Preview Portal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}