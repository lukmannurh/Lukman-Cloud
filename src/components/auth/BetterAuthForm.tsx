import { useState } from 'react';
import { authClient } from '../../lib/auth-client';
import { supabase } from '../../lib/services/supabaseClient';
import { Eye, EyeOff, CheckCircle2, Copy } from 'lucide-react';
import logoAsset from '../../assets/logo.webp';

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
        
        setTimeout(() => window.location.reload(), 800);
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

      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      setError(err.message || 'Guest generation error');
      setIsGuestLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] min-h-dvh bg-background text-foreground font-sans">
      
      {/* Left Side: Brand Panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5">
        <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none"></div>
        
        <div className="relative z-10 flex items-center gap-3">
          <img src={logoAsset} alt="Lukman Cloud Logo" className="h-10 w-10 object-contain drop-shadow-md" />
          <span className="font-bold text-xl tracking-tight text-foreground">Lukman Cloud</span>
        </div>

        <div className="relative z-10 max-w-lg mt-24 mb-auto">
          <h1 className="text-5xl font-semibold tracking-tight text-foreground leading-[1.1] mb-6 font-['Inter_Tight']">
            Simple cloud storage.<br/>Unlimited space.
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Unify your Telegram storage and Google Drive into one secure, seamless interface. 
          </p>
        </div>

        <div className="relative z-10">
          <p className="text-sm font-medium text-muted-foreground/60">
            Powered by modern web infrastructure.
          </p>
        </div>
      </div>

      {/* Right Side: Auth Surface */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-24 bg-surface relative">
        <div className="w-full max-w-sm mx-auto animate-[fadeIn_0.4s_ease-out]">
          
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <img src={logoAsset} alt="Lukman Cloud Logo" className="h-10 w-10 object-contain drop-shadow-md" />
            <span className="font-bold text-xl tracking-tight text-foreground">Lukman Cloud</span>
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-bold tracking-tight text-foreground mb-2">
              {showGuestModal ? 'Guest Access' : (isSignUp ? 'Create account' : 'Welcome back')}
            </h2>
            {!showGuestModal && (
              <p className="text-sm text-muted-foreground">
                {isSignUp ? 'Already have an account? ' : 'Don\'t have an account? '}
                <button 
                  onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccess(''); }}
                  className="font-medium text-primary hover:text-primary/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                >
                  {isSignUp ? 'Sign in' : 'Create an account'}
                </button>
              </p>
            )}
          </div>

          {showGuestModal ? (
            <div className="space-y-6">
              <div className="flex items-start gap-3 bg-primary/10 p-4 rounded-xl border border-primary/20 text-sm text-foreground/90 leading-relaxed mb-8">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <p>You're in. We saved these credentials to your browser, but you can copy them below if you need them later.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Username</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={guestCredentials.username}
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl font-mono text-sm text-foreground focus:outline-none"
                    />
                    <button 
                      onClick={() => copyToClipboard(guestCredentials.username)}
                      className="p-3 bg-background border border-border rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy Username"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={guestCredentials.password}
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl font-mono text-sm text-foreground focus:outline-none"
                    />
                    <button 
                      onClick={() => copyToClipboard(guestCredentials.password)}
                      className="p-3 bg-background border border-border rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy Password"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button 
                  onClick={handleGuestConfirm} 
                  disabled={isGuestLoading}
                  className="w-full justify-center bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-3.5 px-4 rounded-xl transition-all shadow-md shadow-primary/20 flex items-center disabled:opacity-70"
                >
                  {isGuestLoading ? 'Activating...' : 'Continue to Dashboard'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <form className="space-y-5" onSubmit={handleSubmit}>
                {error && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm rounded-xl">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm rounded-xl">
                    {success}
                  </div>
                )}
                
                {isSignUp && (
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1.5">
                      Full Name
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="appearance-none block w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 placeholder:text-muted-foreground/50"
                      placeholder="John Doe"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-foreground mb-1.5">
                    Username
                  </label>
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
                    className="appearance-none block w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 placeholder:text-muted-foreground/50"
                    placeholder="cool_user_123"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={isSignUp ? "new-password" : "current-password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="appearance-none block w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 placeholder:text-muted-foreground/50 pr-12"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full justify-center bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-3.5 px-4 rounded-xl transition-all shadow-md shadow-primary/20 flex items-center disabled:opacity-70"
                    disabled={loading}
                  >
                    {loading ? (
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-primary-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      isSignUp ? 'Create Account' : 'Sign In'
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-8">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-3 bg-surface text-muted-foreground">Or continue with</span>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-1 gap-4">
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="w-full inline-flex justify-center items-center py-3 px-4 rounded-xl shadow-sm bg-background hover:bg-muted text-foreground font-medium border border-border transition-colors disabled:opacity-70"
                    disabled={loading || googleLoading}
                  >
                    {googleLoading ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Connecting...
                      </span>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        Google
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleGuestAccess}
                    className="w-full inline-flex justify-center items-center py-3 px-4 rounded-xl shadow-sm bg-background hover:bg-muted text-foreground font-medium border border-border transition-colors disabled:opacity-70"
                    disabled={loading}
                  >
                    Guest Access
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
