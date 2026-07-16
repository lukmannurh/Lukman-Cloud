/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Lukman Cloud — Centralized Auth Gate
 * Path: src/components/auth/AuthGate.tsx
 *
 * Replaces the legacy BYOS/vault-password flow entirely.
 * Users authenticate via a Telegram-dispatched 6-digit TOTP code.
 * No local master passwords. No BYOS wizards. Purely centralized SaaS auth.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { notifyAdmin, ADMIN_CHANNEL_ID } from '../../lib/notifyAdmin';

interface AuthGateProps {
  onAuthenticated: () => void;
}

const COOLDOWN_SECONDS = 60;
const CODE_TTL_MS = 5 * 60 * 1000;

export function AuthGate({ onAuthenticated }: AuthGateProps) {
  // ── Code State ─────────────────────────────────────────────────────────────
  const [generatedCode, setGeneratedCode]   = useState<string | null>(null);
  const [expirationTime, setExpirationTime] = useState<number | null>(null);
  const [cooldown, setCooldown]             = useState(0);
  const [isSending, setIsSending]           = useState(false);
  const [sendSuccess, setSendSuccess]       = useState(false);
  const [sendError, setSendError]           = useState<string | null>(null);

  // ── Input State ────────────────────────────────────────────────────────────
  const [otpValue, setOtpValue] = useState<string[]>(Array(6).fill(''));
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── UI Feedback ────────────────────────────────────────────────────────────
  const [error, setError]     = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // ── Cooldown tick ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // ── Expiry countdown ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!expirationTime) { setTimeLeft(null); return; }
    const tick = () => {
      const rem = Math.max(0, Math.ceil((expirationTime - Date.now()) / 1000));
      setTimeLeft(rem);
      if (rem === 0) {
        setGeneratedCode(null);
        setExpirationTime(null);
        setSendSuccess(false);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expirationTime]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ── Request Code ───────────────────────────────────────────────────────────
  const handleRequestCode = useCallback(async () => {
    if (cooldown > 0 || isSending) return;
    setIsSending(true);
    setSendError(null);
    setSendSuccess(false);
    setError(null);

    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    const code = String(arr[0] % 1_000_000).padStart(6, '0');
    const expiry = Date.now() + CODE_TTL_MS;

    setGeneratedCode(code);
    setExpirationTime(expiry);

    const msg =
      `🔐 <b>[Lukman Cloud Access Request]</b>\n\n` +
      `A login was initiated from the web app.\n` +
      `<b>One-Time Code: <code>${code}</code></b>\n` +
      `<i>Valid for 5 minutes. Do not share this code.</i>`;

    try {
      await notifyAdmin(msg, ADMIN_CHANNEL_ID);
      setSendSuccess(true);
      setCooldown(COOLDOWN_SECONDS);
      setTimeout(() => otpRefs.current[0]?.focus(), 80);
    } catch {
      setSendError('Failed to dispatch code. Check your connection and try again.');
      setGeneratedCode(null);
      setExpirationTime(null);
    } finally {
      setIsSending(false);
    }
  }, [cooldown, isSending]);

  // ── OTP box handlers ───────────────────────────────────────────────────────
  const handleBoxChange = (i: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...otpValue];
    next[i] = digit;
    setOtpValue(next);
    if (digit && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const handleBoxKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      const next = [...otpValue];
      if (!next[i] && i > 0) { otpRefs.current[i - 1]?.focus(); }
      next[i] = '';
      setOtpValue(next);
    }
  };

  // ── Authenticate ───────────────────────────────────────────────────────────
  const handleAuthenticate = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const entered = otpValue.join('');

    if (!generatedCode || !expirationTime) {
      setError('Request an access code first.');
      return;
    }
    if (Date.now() > expirationTime) {
      setGeneratedCode(null); setExpirationTime(null); setSendSuccess(false);
      setOtpValue(Array(6).fill(''));
      setError('Code expired — request a new one.');
      return;
    }
    if (entered !== generatedCode) {
      setError('Incorrect code. Please try again.');
      setOtpValue(Array(6).fill(''));
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
      return;
    }
    onAuthenticated();
  };

  const enteredCode = otpValue.join('');
  const canSubmit = enteredCode.length === 6 && !!generatedCode && !isSending;

  return (
    <div className="flex items-center justify-center min-h-dvh bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-4 font-sans">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-indigo-600/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-violet-600/6 rounded-full blur-2xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Lukman Cloud</h1>
          <p className="text-slate-400 text-sm mt-1">Admin Access Gate</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md shadow-2xl p-7 flex flex-col gap-5">

          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5">
              <svg className="w-5 h-5 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <p className="text-sm text-rose-300 font-medium">{error}</p>
            </div>
          )}

          {/* Dispatch success */}
          {sendSuccess && timeLeft !== null && timeLeft > 0 && (
            <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5">
              <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <div>
                <p className="text-sm text-emerald-300 font-semibold">Code sent to Admin Channel</p>
                <p className="text-xs text-emerald-500 mt-0.5">Expires in <span className="font-bold text-emerald-300">{formatTime(timeLeft)}</span></p>
              </div>
            </div>
          )}

          {/* Expired notice */}
          {sendSuccess && timeLeft === 0 && (
            <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5">
              <svg className="w-5 h-5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <p className="text-sm text-amber-300 font-medium">Code expired — request a new one.</p>
            </div>
          )}

          <p className="text-sm text-slate-400 text-center">
            Click below to send a one-time access code to the Telegram admin channel.
          </p>

          {/* Request Code Button */}
          <button
            type="button"
            onClick={handleRequestCode}
            disabled={cooldown > 0 || isSending}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm border transition-all duration-200
              ${cooldown > 0 || isSending
                ? 'bg-slate-800/60 border-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/20 active:scale-95'
              }`}
          >
            {isSending ? (
              <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Dispatching...</>
            ) : cooldown > 0 ? (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Resend in {cooldown}s</>
            ) : (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>Request Access Code</>
            )}
          </button>

          {sendError && <p className="text-xs text-center text-rose-400 -mt-1">{sendError}</p>}

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[11px] text-slate-600 uppercase tracking-widest font-medium">Enter Code</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* OTP Form */}
          <form onSubmit={handleAuthenticate} className="flex flex-col gap-5">
            {/* 6 OTP Boxes */}
            <div className="flex justify-center gap-2.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <input
                  key={i}
                  ref={el => { otpRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={otpValue[i]}
                  onChange={e => handleBoxChange(i, e.target.value)}
                  onKeyDown={e => handleBoxKeyDown(i, e)}
                  onFocus={e => e.target.select()}
                  disabled={!generatedCode}
                  className={`w-11 h-14 text-center text-xl font-black rounded-xl border-2 bg-white/5 text-white outline-none transition-all
                    ${!generatedCode
                      ? 'border-white/8 cursor-not-allowed opacity-35'
                      : 'border-white/20 focus:border-indigo-500 focus:bg-indigo-500/10 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.2)]'
                    }
                    ${error && !generatedCode ? 'border-rose-500/50' : ''}`}
                />
              ))}
            </div>

            {/* Authenticate CTA */}
            <button
              type="submit"
              disabled={!canSubmit}
              className={`w-full py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all duration-200
                ${canSubmit
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/30 active:scale-95'
                  : 'bg-slate-800/60 text-slate-500 cursor-not-allowed border border-slate-700'
                }`}
            >
              Authenticate
            </button>

            {/* Security notice */}
            {generatedCode && (
              <p className="text-[11px] text-center text-slate-600 leading-relaxed px-2">
                Code expires in 5 minutes. If you didn't request this, secure your administrative nodes immediately.
              </p>
            )}
          </form>
        </div>

        <p className="text-center text-[11px] text-slate-700 mt-6">
          Lukman Cloud · End-to-End Encrypted · Zero Knowledge Storage
        </p>
      </div>
    </div>
  );
}
