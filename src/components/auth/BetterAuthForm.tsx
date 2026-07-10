import { useState } from 'react';
import { authClient } from '../../lib/auth-client';
import logoAsset from '../../assets/logo.webp';
import { Eye, EyeOff } from 'lucide-react';

export function BetterAuthForm({ onDevBypass }: { onDevBypass?: (user: any) => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestCredentials, setGuestCredentials] = useState({ username: '', password: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
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
        const dummyEmail = `${username.toLowerCase()}@lukman.cloud`;
        const { error: signUpError } = await authClient.signUp.email({
          email: dummyEmail,
          password,
          name: name || username,
          username: username.toLowerCase(),
        });
        
        if (signUpError) {
          setError(signUpError.message || 'Failed to create account');
          setLoading(false);
          return;
        }
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
    try {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const generatedUsername = `guest_aether_${randomSuffix}`;
      const generatedPassword = Math.random().toString(36).slice(-10) + "X1!";
      const dummyEmail = `${generatedUsername}@lukman.cloud`;

      if (import.meta.env.DEV && import.meta.env.VITE_AUTH_MODE === 'mock') {
        const LOCAL_DB_KEY = 'lukman_cloud_mock_users_db';
        const users = JSON.parse(localStorage.getItem(LOCAL_DB_KEY) || '[]');
        const newUser = {
          id: `dev-guest-${Date.now()}`,
          username: generatedUsername,
          name: `Guest ${randomSuffix}`,
          email: dummyEmail,
          password: generatedPassword,
          telegram_channel_id: "MOCK_CH_9922"
        };
        users.push(newUser);
        localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(users));
        
        setGuestCredentials({ username: generatedUsername, password: generatedPassword, id: newUser.id } as any);
        setShowGuestModal(true);
        setLoading(false);
        return;
      }

      const { error: guestError } = await authClient.signUp.email({
        email: dummyEmail,
        password: generatedPassword,
        name: `Guest ${randomSuffix}`,
        username: generatedUsername,
      });

      if (guestError) {
        setError(guestError.message || 'Failed to generate guest account');
        setLoading(false);
        return;
      }

      setGuestCredentials({ username: generatedUsername, password: generatedPassword } as any);
      setShowGuestModal(true);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Guest generation error');
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    const text = `Username: ${guestCredentials.username}\nPassword: ${guestCredentials.password}`;
    navigator.clipboard.writeText(text);
  };

  if (showGuestModal) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
        {/* Glassmorphism background elements */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-500/20 rounded-full blur-3xl mix-blend-screen pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl mix-blend-screen pointer-events-none"></div>
        
        <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-[scaleIn_0.3s_ease-out]">
          <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
                <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white">Welcome to Lukman Cloud!</h3>
              <p className="text-sm text-slate-300 mt-2">Here are your temporary access credentials. Save them to log back in anytime:</p>
            </div>
            
            <div className="bg-slate-900/50 border border-slate-700 p-4 rounded-lg mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Username</span>
                <span className="text-sm font-mono text-white select-all">{guestCredentials.username}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Password</span>
                <span className="text-sm font-mono text-white select-all">{guestCredentials.password}</span>
              </div>
            </div>
            
            <div className="flex flex-col gap-3">
              <button onClick={copyToClipboard} className="w-full justify-center bg-slate-800/50 border border-slate-600 text-white hover:bg-slate-700 py-2.5 rounded-lg flex items-center transition-colors">
                <svg className="w-4 h-4 mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                Copy to Clipboard
              </button>
              <button 
                onClick={() => {
                  if (import.meta.env.DEV && import.meta.env.VITE_AUTH_MODE === 'mock') {
                    onDevBypass?.({
                      id: (guestCredentials as any).id,
                      name: 'Guest Tester',
                      email: `${guestCredentials.username}@lukman.cloud`,
                      username: guestCredentials.username
                    });
                  } else {
                    window.location.reload();
                  }
                }} 
                className="w-full justify-center bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 py-2.5 rounded-lg flex items-center transition-all"
              >
                Enter Vault
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
      {/* Glassmorphism background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-500/20 rounded-full blur-3xl mix-blend-screen pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl mix-blend-screen pointer-events-none"></div>
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <img src={logoAsset} alt="Lukman Cloud Logo" className="h-14 w-14 mx-auto mb-4 object-contain drop-shadow-xl" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white tracking-tight">
          {isSignUp ? 'Create your account' : 'Sign in to Lukman Cloud'}
        </h2>
        <p className="mt-2 text-center text-sm text-slate-300">
          {isSignUp ? 'Already have an account? ' : 'Don\'t have an account? '}
          <button 
            onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
            className="font-medium text-blue-400 hover:text-blue-300 transition-colors focus:outline-none"
          >
            {isSignUp ? 'Sign in instead' : 'Create an account'}
          </button>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md animate-[fadeIn_0.4s_ease-out] relative z-10">
        <div className="bg-slate-800/60 backdrop-blur-xl py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10 border border-slate-700/50">
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-rose-500/10 border-l-4 border-rose-500 p-4 rounded-r-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-rose-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-rose-200 font-medium">{error}</p>
                  </div>
                </div>
              </div>
            )}
            
            {isSignUp && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-300">
                  Full Name
                </label>
                <div className="mt-1">
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="appearance-none block w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg shadow-sm placeholder-slate-500 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all duration-200"
                    placeholder="John Doe"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-300">
                Username
              </label>
              <div className="mt-1">
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
                  className="appearance-none block w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg shadow-sm placeholder-slate-500 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all duration-200"
                  placeholder="cool_user_123"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg shadow-sm placeholder-slate-500 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all duration-200 pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-all shadow-md w-full block text-center flex items-center justify-center"
                disabled={loading}
              >
                {loading ? (
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  isSignUp ? 'Create Account' : 'Sign In'
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-slate-800 text-slate-400">Or continue with</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full inline-flex justify-center py-2.5 px-4 rounded-lg shadow-sm bg-white hover:bg-slate-50 text-slate-700 font-medium border border-slate-200 transition-colors"
                disabled={loading || googleLoading}
              >
                {googleLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Connecting to Google Accounts...
                  </span>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleGuestAccess}
                className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-medium py-2.5 px-4 rounded-lg transition-all w-full flex items-center justify-center gap-2 mt-2"
                disabled={loading}
              >
                <span>⚡</span>
                Instant Guest Access
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
