/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import AppShell from './components/AppShell';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { 
  Mail, 
  Lock, 
  Check, 
  Eye, 
  EyeOff, 
  ChevronDown, 
  Sun, 
  Moon, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2
} from 'lucide-react';

const truckImage = "/src/assets/images/logistics_truck_1783832904923.jpg";


interface RoleConfig {
  id: string;
  label: string;
}

const ROLES: RoleConfig[] = [
  { id: 'manager', label: 'Fleet Manager' },
  { id: 'dispatcher', label: 'Dispatcher' },
  { id: 'safety', label: 'Safety Officer' },
  { id: 'finance', label: 'Financial Analyst' },
  { id: 'admin', label: 'System Admin' }
];

function MainApp() {
  const { t } = useLanguage();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'light' | 'dark') || 'dark';
  });

  const [route, setRoute] = useState<'signup' | 'login' | 'dispatcher'>(() => {
    const path = window.location.pathname;
    const hash = window.location.hash;
    if (path === '/dispatcher' || hash === '#/dispatcher') return 'dispatcher';
    if (path === '/login' || path === '/signin' || hash === '#/login' || hash === '#/signin') return 'login';
    return 'signup';
  });

  const mode = route === 'login' ? 'signin' : 'signup';

  const navigate = (to: 'signup' | 'login' | 'dispatcher') => {
    const path = to === 'signup' ? '/signup' : to === 'login' ? '/login' : '/dispatcher';
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('popstate'));
  };

  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path === '/dispatcher' || hash === '#/dispatcher') {
        setRoute('dispatcher');
      } else if (path === '/login' || path === '/signin' || hash === '#/login' || hash === '#/signin') {
        setRoute('login');
      } else {
        setRoute('signup');
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleConfig>(ROLES[0]);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Form validation & simulation states
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Load saved email if rememberMe was checked previously
  useEffect(() => {
    const savedEmail = localStorage.getItem('remember_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // Update theme cache and document element class list
  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);



  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email) {
      newErrors.email = t('emailRequired');
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = t('emailInvalid');
    }

    if (!password) {
      newErrors.password = t('passwordRequired');
    } else if (password.length < 6) {
      newErrors.password = t('passwordTooShort');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      
      if (rememberMe) {
        localStorage.setItem('remember_email', email);
      } else {
        localStorage.removeItem('remember_email');
      }

      // Immediately go to the designated page for ALL roles, bypassing confirmation screen
      navigate('dispatcher');
    }, 1200);
  };

  const handleReset = () => {
    setSubmitSuccess(false);
    if (!rememberMe) {
      setEmail('');
    }
    setPassword('');
  };

  if (route === 'dispatcher') {
    return (
      <AppShell 
        theme={theme}
        toggleTheme={toggleTheme}
        userEmail={email || "operator.ops@transitops.in"}
        userRole={selectedRole.id}
        onLogout={() => {
          handleReset();
          navigate('login');
        }}
      />
    );
  }

  return (
    <div className={`min-h-screen w-full transition-all duration-500 font-sans flex flex-col justify-center items-center p-4 md:p-8 overflow-x-hidden ${
      theme === 'dark' 
        ? 'bg-zinc-900 text-zinc-100' 
        : 'bg-[#faf6f0] text-zinc-800'
    }`}>
      
      {/* Ambient background decoration */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className={`absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full filter blur-[120px] transition-all duration-1000 ${
          theme === 'dark' ? 'bg-zinc-800/40' : 'bg-amber-100/20'
        }`} />
      </div>

      {/* Main card container */}
      <motion.div 
        id="signup-card-container"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className={`w-full max-w-6xl rounded-[24px] overflow-hidden shadow-xl relative z-10 grid grid-cols-1 md:grid-cols-12 border transition-all duration-500 ${
          theme === 'dark' 
            ? 'bg-zinc-850 border-zinc-800' 
            : 'bg-white border-zinc-200/50'
        }`}
      >
        
        {/* Left Side: Truck Image Banner */}
        <div className="md:col-span-5 relative overflow-hidden flex flex-col justify-end p-8 md:p-10 min-h-[280px] md:min-h-[680px]">
          <div className="absolute inset-0 z-0">
            <img 
              src={truckImage} 
              alt="Logistics Travel Truck" 
              className="w-full h-full object-cover object-center filter brightness-[0.7] contrast-[1.05]"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/20" />
          </div>

          {/* Clean minimal text heading */}
          <div className="relative z-10">
            <h2 className="font-sans font-medium text-2xl md:text-3xl text-white tracking-tight leading-snug">
              {t('brandSubtitle')}
            </h2>
          </div>
        </div>

        {/* Right Side: Simple form */}
        <div className={`md:col-span-7 p-6 sm:p-8 md:p-10 flex flex-col justify-center transition-colors duration-500 ${
          theme === 'dark' ? 'bg-zinc-850' : 'bg-white'
        }`}>
          
          {/* Header Action: Title + Subtitle */}
          <div className="mb-4 text-center">
            <h1 className={`font-sans font-[900] text-3xl md:text-4xl tracking-tight leading-tight transition-colors ${
              theme === 'dark' ? 'text-white' : 'text-zinc-900'
            }`}>
              {mode === 'signup' ? t('getStarted') : t('welcomeBack')}
            </h1>
            <p className={`text-sm md:text-base mt-2 font-medium transition-colors ${
              theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'
            }`}>
              {mode === 'signup' ? t('createPlatformAccount') : t('accessConsoleDesc')}
            </p>
          </div>

          {/* Horizontal Line */}
          <div className="border-b border-zinc-100/40 dark:border-zinc-900/10 mb-6" />

          <AnimatePresence mode="wait">
            {submitSuccess ? (
              <motion.div
                key="success-card"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="text-center py-6 px-2"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="font-sans font-bold text-lg tracking-tight mb-2">
                  {mode === 'signup' ? 'Account Created' : 'Login Successful'}
                </h3>
                <p className={`text-sm max-w-md mx-auto mb-6 ${
                  theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'
                }`}>
                  {mode === 'signup' 
                    ? `Your operator registration as ${selectedRole.label} has been processed successfully.`
                    : `Welcome back to the dashboard terminal.`
                  }
                </p>

                <div className={`p-4 rounded-xl border text-left max-w-sm mx-auto mb-6 font-mono text-xs ${
                  theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                }`}>
                  <div className="flex justify-between py-1 border-b border-dashed border-zinc-800 dark:border-zinc-200/10">
                    <span className="text-zinc-400">OPERATOR:</span>
                    <span className="text-amber-500 font-semibold">{email}</span>
                  </div>
                  {mode === 'signup' && (
                    <div className="flex justify-between py-1 border-b border-dashed border-zinc-800 dark:border-zinc-200/10 mt-1">
                      <span className="text-zinc-400">ROLE:</span>
                      <span>{selectedRole.label}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 mt-1">
                    <span className="text-zinc-400">STATUS:</span>
                    <span className="text-emerald-500 font-bold">ACTIVE</span>
                  </div>
                </div>

                 <button
                  onClick={handleReset}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#eb5e00] hover:bg-[#d45500] text-white transition-all shadow-md cursor-pointer"
                >
                  Return to Portal
                </button>
              </motion.div>
            ) : (
              <motion.form
                key="signup-form"
                onSubmit={handleSubmit}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
                noValidate
              >
                {/* Email */}
                <div className="space-y-1">
                  <label className={`text-xs font-semibold tracking-wide flex justify-between uppercase ${
                    theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'
                  }`}>
                    <span>Email</span>
                    {errors.email && <span className="text-red-500 text-[10px] normal-case font-normal flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.email}</span>}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
                      }}
                      placeholder="hi@hextastudio.in"
                      className={`w-full pl-10 pr-4 py-2.5 text-sm rounded-xl outline-none border transition-all ${
                        errors.email 
                          ? 'border-red-500 bg-red-500/5 focus:border-red-500' 
                          : theme === 'dark'
                            ? 'border-zinc-800 bg-zinc-900/50 focus:border-[#eb5e00] focus:bg-zinc-900'
                            : 'border-zinc-200 bg-zinc-50 focus:border-[#eb5e00] focus:bg-white'
                      }`}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1">
                  <label className={`text-xs font-semibold tracking-wide flex justify-between uppercase ${
                    theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'
                  }`}>
                    <span>Password</span>
                    {errors.password && <span className="text-red-500 text-[10px] normal-case font-normal flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.password}</span>}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errors.password) setErrors(prev => ({ ...prev, password: undefined }));
                      }}
                      placeholder="**********"
                      className={`w-full pl-10 pr-10 py-2.5 text-sm rounded-xl outline-none border transition-all ${
                        errors.password 
                          ? 'border-red-500 bg-red-500/5 focus:border-red-500' 
                          : theme === 'dark'
                            ? 'border-zinc-800 bg-zinc-900/50 focus:border-[#eb5e00] focus:bg-zinc-900'
                            : 'border-zinc-200 bg-zinc-50 focus:border-[#eb5e00] focus:bg-white'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-400 hover:text-[#eb5e00] transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Role / Selector (SIGNUP ONLY) */}
                {mode === 'signup' && (
                  <div className="space-y-1 relative">
                    <label className={`text-xs font-semibold tracking-wide uppercase ${
                      theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'
                    }`}>
                      Role
                    </label>
                    
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className={`w-full flex items-center justify-between px-5 py-2.5 text-sm rounded-xl border outline-none text-left transition-all ${
                        theme === 'dark'
                          ? 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900'
                          : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100/50'
                      }`}
                    >
                      <span className="font-medium">{selectedRole.label}</span>
                      <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {isDropdownOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-20" 
                            onClick={() => setIsDropdownOpen(false)} 
                          />
                          
                          <motion.ul
                            initial={{ opacity: 0, y: -5, scale: 0.99 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -5, scale: 0.99 }}
                            transition={{ duration: 0.1 }}
                            className={`absolute left-0 right-0 mt-1.5 z-30 max-h-60 overflow-y-auto rounded-xl border p-1 shadow-lg ${
                              theme === 'dark'
                                ? 'bg-zinc-900 border-zinc-800 text-zinc-100 shadow-black'
                                : 'bg-white border-zinc-200 text-zinc-800'
                            }`}
                          >
                            {ROLES.map((role) => (
                              <li key={role.id}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedRole(role);
                                    setIsDropdownOpen(false);
                                  }}
                                  className={`w-full px-4 py-2 text-xs rounded-lg text-left transition-colors ${
                                    selectedRole.id === role.id
                                      ? 'bg-[#eb5e00] text-white'
                                      : theme === 'dark'
                                        ? 'hover:bg-zinc-800 text-zinc-300'
                                        : 'hover:bg-zinc-100 text-zinc-700'
                                  }`}
                                >
                                  {role.label}
                                </button>
                              </li>
                            ))}
                          </motion.ul>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Remember Me and Forgot Password Container */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                        rememberMe 
                          ? 'border-[#eb5e00] bg-[#eb5e00] text-white' 
                          : theme === 'dark'
                            ? 'border-zinc-800 bg-zinc-900' 
                            : 'border-zinc-300 bg-zinc-50'
                      }`}>
                        {rememberMe && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                    <span className={`text-xs transition-colors ${
                      theme === 'dark' ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-500 hover:text-zinc-800'
                    }`}>
                      Remember me
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={() => alert('Password reset sequence initiated.')}
                    className="text-xs font-semibold text-[#eb5e00] hover:text-[#d45500] transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Submit button */}
                <div className="space-y-4 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm tracking-wide text-white transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      isSubmitting 
                        ? 'bg-[#d45500] cursor-not-allowed opacity-90' 
                        : 'bg-[#eb5e00] hover:bg-[#d45500] hover:scale-[1.01] active:scale-[0.99]'
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        <span>{mode === 'signup' ? t('registering') : t('loggingIn')}</span>
                      </>
                    ) : (
                      <>
                        <span>{mode === 'signup' ? t('createAccountBtn') : t('signInBtn')}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Switch Helper bottom link */}
                  <div className="text-center pt-2">
                    <span className={`text-xs transition-colors ${
                      theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'
                    }`}>
                      {mode === 'signup' ? t('alreadyHaveAccount') + ' ' : t('noAccountYet') + ' '}
                      <button
                        type="button"
                        onClick={() => {
                          navigate(route === 'signup' ? 'login' : 'signup');
                          handleReset();
                        }}
                        className={`font-semibold underline cursor-pointer hover:text-[#eb5e00] transition-colors ${
                          theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'
                        }`}
                      >
                        {route === 'signup' ? t('signInLink') : t('signUpLink')}
                      </button>
                    </span>
                  </div>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

        </div>

      </motion.div>

      {/* Floating Theme Toggle (Bottom Right) */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2">
        <button
          onClick={toggleTheme}
          aria-label="Toggle visual theme"
          className={`p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 border cursor-pointer ${
            theme === 'dark' 
              ? 'bg-zinc-900 border-zinc-800 text-amber-400 hover:bg-zinc-800' 
              : 'bg-white border-zinc-200 text-amber-600 hover:bg-zinc-50'
          }`}
        >
          {theme === 'dark' ? (
            <Sun className="w-6 h-6" />
          ) : (
            <Moon className="w-6 h-6" />
          )}
        </button>
      </div>

    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <MainApp />
    </LanguageProvider>
  );
}
