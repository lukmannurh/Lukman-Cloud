import { useState } from 'react';
import { authClient } from '../../lib/auth-client';
import { supabase } from '../../lib/services/supabaseClient';
import { Eye, EyeOff, CheckCircle2, Copy, Zap } from 'lucide-react';

export function BetterAuthForm({ onDevBypass }: { onDevBypass?: (user: any) => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestCredentials, setGuestCredentials] = useState({ username: '', password: '', id: '' });
  const [isGuestLoading, setIsGuestLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      if (import.meta.env.DEV && import.meta.env.VITE_AUTH_MODE === 'mock') {
        const LOCAL_DB_KEY = 'lukman_cloud_mock_users_db';
        const users = JSON.parse(localStorage.getItem(LOCAL_DB_KEY) || '[]');
        const lowerUsername = username.toLowerCase();
        
        if (isSignUp) {
          if (users.find((u: any) => u.username === lowerUsername)) {
            throw new Error("This username is already taken.");
          }
          const newUser = {
            id: `dev-uuid-${Date.now()}`,
            username: lowerUsername,
            name: name || username,
            email: `${lowerUsername}@lukman.cloud`,
            password,
            telegram_channel_id: "MOCK_CH_9922"
          };
          users.push(newUser);
          localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(users));
          onDevBypass?.(newUser);
        } else {
          const user = users.find((u: any) => u.username === lowerUsername && u.password === password);
          if (!user) throw new Error("Invalid credentials");
          onDevBypass?.(user);
        }
        return;
      }
      
      if (isSignUp) {
        const normalizedUsername = username.toLowerCase();
        
        const { data: existingUser } = await supabase
          .from('user')
          .select('username')
          .eq('username', normalizedUsername)
          .maybeSingle();
          
        if (existingUser) {
          setError('This username is already taken. Please choose another.');
          setLoading(false);
          return;
        }

        const dummyEmail = `${normalizedUsername}@lukman.cloud`;
        
        localStorage.setItem('block_auto_login', 'true');
        
        const { error: signUpError } = await authClient.signUp.email({
          email: dummyEmail,
          password,
          name: name || username,
          username: username.toLowerCase(),
        });
        
        if (signUpError) {
          localStorage.removeItem('block_auto_login');
          setError(signUpError.message || 'Failed to create account');
          setLoading(false);
          return;
        }
        
        await supabase.auth.signOut();
        localStorage.removeItem('block_auto_login');
        
        setSuccess('Account created successfully! Please sign in.');
        setIsSignUp(false);
        setPassword('');
        setLoading(false);
        return;
      } else {
        const dummyEmail = `${username.toLowerCase()}@lukman.cloud`;
        const { error: signInError } = await authClient.signIn.email({
          email: dummyEmail,
          password,
        });

        if (signInError) {
          setError(signInError.message || 'Invalid credentials');
          setLoading(false);
          return;
        }
        // SPA state will naturally update via onAuthStateChange listener in App.tsx
      }
    } catch (err: any) {
      setError(err.message || 'Authentication error');
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      if (import.meta.env.DEV && import.meta.env.VITE_AUTH_MODE === 'mock') {
        setGoogleLoading(true);
        setTimeout(() => {
          onDevBypass?.({
            id: `dev-google-${Date.now()}`,
            name: 'Google Tester',
            email: 'google_tester@gmail.com',
            username: null,
            telegram_channel_id: "MOCK_CH_9922"
          });
          setGoogleLoading(false);
        }, 1000);
        return;
      }

      await authClient.signIn.social({
        provider: 'google',
        callbackURL: window.location.origin
      });
    } catch (err: any) {
      setError(err.message || 'Google login failed');
    }
  };

  const handleGuestAccess = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const generatedUsername = `guest_lukman_${crypto.randomUUID()}`;
      const generatedPassword = Math.random().toString(36).slice(-10) + "X1!";

      setGuestCredentials({ username: generatedUsername, password: generatedPassword, id: `dev-guest-${Date.now()}` });
      setShowGuestModal(true);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Guest generation error');
      setLoading(false);
    }
  };

  const handleGuestConfirm = async () => {
    setIsGuestLoading(true);
    setError('');
    setSuccess('');
    try {
      const normalizedUsername = guestCredentials.username.toLowerCase();
      
      const { data: existingUser } = await supabase
        .from('user')
        .select('username')
        .eq('username', normalizedUsername)
        .maybeSingle();
        
      if (existingUser) {
        setError('This guest username is already taken. Please try generating again.');
        setIsGuestLoading(false);
        return;
      }

      const dummyEmail = `${guestCredentials.username}@lukman.cloud`;

      if (import.meta.env.DEV && import.meta.env.VITE_AUTH_MODE === 'mock') {
        const LOCAL_DB_KEY = 'lukman_cloud_mock_users_db';
        const users = JSON.parse(localStorage.getItem(LOCAL_DB_KEY) || '[]');
        const newUser = {
          id: guestCredentials.id,
          username: guestCredentials.username,
          name: `Guest User`,
          email: dummyEmail,
          password: guestCredentials.password,
          telegram_channel_id: "MOCK_CH_9922"
        };
        users.push(newUser);
        localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(users));
        onDevBypass?.(newUser);
        return;
      }

      const { error: guestError } = await authClient.signUp.email({
        email: dummyEmail,
        password: guestCredentials.password,
        name: `Guest User`,
        username: guestCredentials.username,
      });

      if (guestError) {
        setError(guestError.message || 'Failed to generate guest account');
        setIsGuestLoading(false);
        return;
      }
      
      // The onAuthStateChange listener in App.tsx will pick up the new session automatically
    } catch (err: any) {
      setError(err.message || 'Guest generation error');
      setIsGuestLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="relative min-h-dvh bg-[#0a0a1a] text-zinc-300 flex items-center justify-center px-4 py-10 selection:bg-indigo-500/30">
      
      {/* Ambient background glows */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-[28rem] w-[28rem] rounded-full bg-indigo-900/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-[440px] animate-[fadeIn_0.4s_ease-out]">

        {/* Brand Mark */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 grid size-12 place-items-center rounded-2xl bg-indigo-500/15 ring-1 ring-indigo-500/40">
            <div className="size-4 rounded-full bg-indigo-500 shadow-[0_0_18px_rgba(79,70,229,0.8)]" />
          </div>
          <h1 className="text-2xl font-semibold text-zinc-100" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {showGuestModal ? 'Guest Access Ready' : (isSignUp ? 'Create your account' : 'Sign in to Lukman Cloud')}
          </h1>
          {!showGuestModal && (
            <p className="mt-1.5 text-sm text-zinc-500">
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <button
                onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccess(''); }}
                className="text-indigo-400 hover:text-indigo-300 underline-offset-4 hover:underline transition-colors"
              >
                {isSignUp ? 'Sign in' : 'Create an account'}
              </button>
            </p>
          )}
        </div>

        {/* Card */}
        <div className="rounded-3xl bg-[#141432]/40 ring-1 ring-white/5 backdrop-blur-xl border border-[#1e1e5a]/40 p-7 space-y-5">

          {/* Error / Success messages */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              <span className="size-1.5 rounded-full bg-red-400 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {success}
            </div>
          )}

          {showGuestModal ? (
            /* ── Guest Credentials Panel ── */
            <div className="space-y-5">
              <div className="flex items-start gap-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-4 text-sm text-zinc-300 leading-relaxed">
                <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <p>Your guest account is ready. Copy the credentials below if you need them later.</p>
              </div>

              {/* Username */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Username</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={guestCredentials.username}
                    className="w-full rounded-xl bg-[#0a0a1a]/60 border border-[#1e1e5a]/60 px-4 py-3 text-sm text-zinc-100 font-mono focus:outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(guestCredentials.username)}
                    className="grid size-11 place-items-center rounded-xl bg-[#0a0a1a]/60 border border-[#1e1e5a]/60 text-zinc-500 hover:text-zinc-200 transition-colors shrink-0"
                    title="Copy Username"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Password</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={guestCredentials.password}
                    className="w-full rounded-xl bg-[#0a0a1a]/60 border border-[#1e1e5a]/60 px-4 py-3 text-sm text-zinc-100 font-mono focus:outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(guestCredentials.password)}
                    className="grid size-11 place-items-center rounded-xl bg-[#0a0a1a]/60 border border-[#1e1e5a]/60 text-zinc-500 hover:text-zinc-200 transition-colors shrink-0"
                    title="Copy Password"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <button
                onClick={handleGuestConfirm}
                disabled={isGuestLoading}
                className="mt-2 w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[.99] transition-all py-3 text-sm font-medium text-white ring-1 ring-indigo-500/50 shadow-[0_0_24px_rgba(79,70,229,0.25)] disabled:opacity-60"
              >
                {isGuestLoading ? 'Activating…' : 'Continue to Dashboard'}
              </button>
            </div>
          ) : (
            <>
              {/* ── Main Form ── */}
              <form className="space-y-4" onSubmit={handleSubmit}>
                {isSignUp && (
                  <div className="space-y-1.5">
                    <label htmlFor="name" className="block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Full Name</label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-xl bg-[#0a0a1a]/60 border border-[#1e1e5a]/60 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
                      placeholder="John Doe"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="username" className="block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Username</label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    pattern="[a-zA-Z0-9_]+"
                    title="Only alphanumeric characters and underscores are allowed"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    className="w-full rounded-xl bg-[#0a0a1a]/60 border border-[#1e1e5a]/60 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
                    placeholder="cool_user_123"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="password" className="block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Password</label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={isSignUp ? "new-password" : "current-password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl bg-[#0a0a1a]/60 border border-[#1e1e5a]/60 px-4 py-3 pr-11 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 grid w-11 place-items-center text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[.99] transition-all py-3 text-sm font-medium text-white ring-1 ring-indigo-500/50 shadow-[0_0_24px_rgba(79,70,229,0.25)] disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  ) : (isSignUp ? 'Create Account' : 'Sign In')}
                </button>
              </form>

              {/* Divider */}
              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#1e1e5a]/40" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-[#141432]/0 px-3 text-[11px] uppercase tracking-widest text-zinc-500">or continue with</span>
                </div>
              </div>

              {/* Social buttons */}
              <div className="space-y-3">
                {/* Google */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading || googleLoading}
                  className="w-full rounded-xl bg-[#141432] hover:bg-[#1a1a40] transition-colors py-3 text-sm font-medium text-zinc-200 border border-[#1e1e5a]/60 flex items-center justify-center gap-3 disabled:opacity-60"
                >
                  {googleLoading ? (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  ) : (
                    <svg className="size-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.5-.2-2.2H12v4.3h6.2c-.3 1.4-1.1 2.6-2.3 3.4v2.8h3.7C21.8 18.5 23 15.7 23 12.3z"/>
                      <path fill="#34A853" d="M12 23c3.1 0 5.7-1 7.6-2.8l-3.7-2.8c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v2.9C3.7 20.5 7.5 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.6 13.8c-.2-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2V6.5H1.8C1 8.1.5 10 .5 11.6c0 1.7.4 3.5 1.3 5l3.8-2.8z"/>
                      <path fill="#EA4335" d="M12 4.6c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.2 15.1 0 12 0 7.5 0 3.7 2.5 1.8 6.5l3.8 2.9C6.5 6.6 9 4.6 12 4.6z"/>
                    </svg>
                  )}
                  Continue with Google
                </button>

                {/* Guest */}
                <button
                  type="button"
                  onClick={handleGuestAccess}
                  disabled={loading}
                  className="w-full rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors py-3 text-sm font-medium text-indigo-300 border border-indigo-500/30 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Zap className="w-4 h-4" />
                  Instant Guest Access
                </button>
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] text-zinc-600">
          End-to-end encrypted · Unlimited private storage
        </p>
      </div>
    </div>
  );
}
