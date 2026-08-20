import React, { useState, useEffect } from 'react';
import { authApi } from '../services/api';
import type { User } from '../types';
import {
  X,
  Lock,
  Mail,
  User as UserIcon,
  Phone,
  Shield,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ArrowLeft,
  Clock,
  RotateCw,
  MapPin,
  Navigation,
} from 'lucide-react';

import { fetchLiveCoordinates, getCachedCoordinates } from '../services/location';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User, token: string) => void;
  initialMessage?: string | null;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMessage = null,
}) => {
  if (!isOpen) return null;

  const [mode, setMode] = useState<'login' | 'register' | 'forgot_password'>('login');
  const [role, setRole] = useState<'CUSTOMER' | 'BARBER'>('CUSTOMER');

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Location state (Mandatory for Doorstep Services)
  const initialCoords = getCachedCoordinates();
  const [latitude, setLatitude] = useState<number>(initialCoords.latitude);
  const [longitude, setLongitude] = useState<number>(initialCoords.longitude);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationDetected, setLocationDetected] = useState(false);

  // Forgot password flow states
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [otpExpiresIn, setOtpExpiresIn] = useState<number>(900); // 15 mins in seconds

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialMessage);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const requestLocation = async () => {
    setLocationLoading(true);
    try {
      const coords = await fetchLiveCoordinates(false);
      setLatitude(coords.latitude);
      setLongitude(coords.longitude);
      setLocationDetected(true);
    } finally {
      setLocationLoading(false);
    }
  };

  // Auto-request real location whenever switching to register
  useEffect(() => {
    if (mode === 'register') {
      void requestLocation();
    }
  }, [mode]);

  // Countdown timer for OTP
  useEffect(() => {
    let timer: any;
    if (mode === 'forgot_password' && forgotStep === 2 && otpExpiresIn > 0) {
      timer = setInterval(() => setOtpExpiresIn((prev) => Math.max(0, prev - 1)), 1000);
    }
    return () => clearInterval(timer);
  }, [mode, forgotStep, otpExpiresIn]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (mode === 'register') {
        // Frontend Phone validation
        const cleanPhone = phone.trim();
        if (!/^\+?[1-9]\d{9,14}$/.test(cleanPhone)) {
          throw new Error('Please enter a valid 10 to 15 digit mobile number (e.g. +919876543210)');
        }

        // Frontend Location validation (Mandatory)
        if (latitude === null || longitude === null || isNaN(latitude) || isNaN(longitude)) {
          throw new Error('Location coordinates are mandatory for doorstep salon & barber services.');
        }

        const res = await authApi.register({
          name,
          email,
          phone: cleanPhone,
          password,
          role,
          location: { latitude: Number(latitude), longitude: Number(longitude) },
        });
        onSuccess(res.user, res.accessToken);
        onClose();
      } else if (mode === 'login') {
        const res = await authApi.login({ email, password });
        onSuccess(res.user, res.accessToken);
        onClose();
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.error?.message ||
        err?.message ||
        'Authentication failed. Please check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password: Step 1 - Send OTP
  const handleForgotStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotIdentifier.trim()) {
      setError('Please enter your registered email or mobile number');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.forgotPassword(forgotIdentifier.trim());
      setSuccessMsg(res.message || 'OTP sent successfully via Twilio SMS / Email.');
      setOtpExpiresIn(900); // 15 mins
      setForgotStep(2);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to request reset OTP.');
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password: Step 2 - Verify OTP
  const handleForgotStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotOtp.length !== 6) {
      setError('Please enter the complete 6-digit OTP code.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.verifyResetOtp(forgotIdentifier.trim(), forgotOtp.trim());
      setResetToken(res.resetToken);
      setSuccessMsg('OTP verified successfully! Please choose your new password.');
      setForgotStep(3);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Invalid or expired OTP code.');
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password: Step 3 - Set New Password
  const handleForgotStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-type identical passwords.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.resetPassword(resetToken, newPassword);
      setSuccessMsg(res.message || 'Password reset successful! Please sign in with your new password.');
      // Reset flow back to login
      setTimeout(() => {
        setMode('login');
        setPassword(newPassword);
        if (forgotIdentifier.includes('@')) setEmail(forgotIdentifier);
        setForgotStep(1);
        setForgotOtp('');
        setResetToken('');
      }, 1200);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to reset password. Please restart the process.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in">
      {/* Background Ambient Glow */}
      <div className="absolute w-[500px] h-[500px] bg-purple-600/15 rounded-full blur-[140px] pointer-events-none"></div>

      <div className="glass-card rounded-3xl w-full max-w-md border-white/20 overflow-hidden shadow-2xl relative z-10 animate-bounce-short">
        
        {/* Header with App Logo */}
        <div className="p-6 text-center border-b border-white/10 relative bg-obsidian-900/60">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* App Logo */}
          <div className="relative w-16 h-16 mx-auto mb-3">
            <div className="absolute inset-0 rounded-2xl bg-purple-600/30 blur-md animate-pulse"></div>
            <img
              src="/logo.png"
              alt="AURA Studio Logo"
              className="w-16 h-16 rounded-2xl object-cover border border-purple-500/40 shadow-xl relative z-10"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>

          <h2 className="text-2xl font-extrabold font-outfit tracking-wider text-white flex items-center justify-center gap-1.5">
            AURA <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 font-semibold">STUDIO</span>
          </h2>
          <p className="text-[11px] text-gray-400 font-inter uppercase tracking-widest mt-1">
            {mode === 'login' && 'Welcome Back • Secure Access'}
            {mode === 'register' && 'Create Luxury Grooming Account'}
            {mode === 'forgot_password' && 'Password Recovery & OTP Verification'}
          </p>

          {/* Navigation Mode Pill Switches */}
          {mode !== 'forgot_password' ? (
            <div className="mt-5 p-1 bg-obsidian-800/80 rounded-2xl border border-white/10 grid grid-cols-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); setSuccessMsg(null); }}
                className={`py-2 rounded-xl transition-all ${
                  mode === 'login'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setError(null); setSuccessMsg(null); }}
                className={`py-2 rounded-xl transition-all ${
                  mode === 'register'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Register
              </button>
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => { setMode('login'); setForgotStep(1); setError(null); setSuccessMsg(null); }}
                className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 font-semibold"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
              </button>
              <span className="text-[11px] text-gray-400 font-mono">Step {forgotStep} of 3</span>
            </div>
          )}
        </div>



        {/* Alerts & Messages */}
        <div className="px-6 pt-3">
          {error && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2 animate-pulse">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* ─── 1. SIGN IN / REGISTER FORM ────────────────────────────────────── */}
        {mode !== 'forgot_password' ? (
          <form onSubmit={handleAuthSubmit} className="p-6 space-y-4 pt-3">
            {/* Account Role Selector */}
            {mode === 'register' && (
              <div>
                <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-2">
                  Account Role Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('CUSTOMER')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      role === 'CUSTOMER'
                        ? 'bg-purple-600/20 border-purple-500 text-purple-300 shadow-md'
                        : 'bg-obsidian-800/50 border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    <UserIcon className="w-4 h-4" /> Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('BARBER')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      role === 'BARBER'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md'
                        : 'bg-obsidian-800/50 border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    <Shield className="w-4 h-4" /> Partner Barber
                  </button>
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-purple-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Priya Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full glass-input pl-10 pr-4 py-3 rounded-2xl text-xs text-white placeholder-gray-500 focus:border-purple-500 transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-purple-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full glass-input pl-10 pr-4 py-3 rounded-2xl text-xs text-white placeholder-gray-500 focus:border-purple-500 transition-all"
                />
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Mobile Number</span>
                  <span className="text-[10px] text-amber-400 lowercase font-mono">Mandatory for OTP SMS</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-purple-400 absolute left-3.5 top-3.5" />
                  <input
                    type="tel"
                    required
                    placeholder="+919876543210 or 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full glass-input pl-10 pr-4 py-3 rounded-2xl text-xs text-white placeholder-gray-500 focus:border-purple-500 transition-all"
                  />
                </div>
              </div>
            )}

            {/* Mandatory Service Location for Registration */}
            {mode === 'register' && (
              <div className="p-3.5 rounded-2xl bg-obsidian-800/90 border border-purple-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-purple-400" />
                    Service Area / Doorstep Location
                  </span>
                  <button
                    type="button"
                    onClick={requestLocation}
                    disabled={locationLoading}
                    className="text-[10px] text-purple-300 hover:text-white bg-purple-600/30 hover:bg-purple-600/50 px-2.5 py-1 rounded-lg border border-purple-500/40 flex items-center gap-1 transition-all"
                  >
                    <Navigation className={`w-3 h-3 text-purple-400 ${locationLoading ? 'animate-spin' : ''}`} />
                    {locationLoading ? 'Detecting GPS...' : 'Detect My GPS'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[9px] text-gray-400 block mb-0.5">Latitude (Mandatory)</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={latitude}
                      onChange={(e) => setLatitude(Number(e.target.value))}
                      placeholder="e.g. 20.2961"
                      className="w-full glass-input px-2.5 py-1.5 rounded-xl text-xs text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-400 block mb-0.5">Longitude (Mandatory)</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={longitude}
                      onChange={(e) => setLongitude(Number(e.target.value))}
                      placeholder="e.g. 85.8245"
                      className="w-full glass-input px-2.5 py-1.5 rounded-xl text-xs text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 pt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>{locationDetected ? 'Live GPS coordinates detected & synced.' : 'Required for doorstep barber allocation and arrival.'}</span>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                  Password
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot_password');
                      setForgotIdentifier(email);
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="text-[11px] text-purple-400 hover:text-purple-300 font-semibold hover:underline"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-purple-400 absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full glass-input pl-10 pr-12 py-3 rounded-2xl text-xs text-white placeholder-gray-500 focus:border-purple-500 transition-all"
                />

                {/* View Password Toggle Button */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide Password' : 'Show Password'}
                  className="absolute right-3.5 top-3 p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-400 hover:text-white" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl gradient-purple hover:opacity-95 text-white font-extrabold text-xs shadow-xl shadow-purple-600/30 transition-all flex items-center justify-center gap-2 mt-6 hover:scale-[1.02] active:scale-95"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : mode === 'login' ? (
                <>
                  <span>Sign In to Account</span>
                  <CheckCircle2 className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Create & Launch Account</span>
                  <Sparkles className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* ─── 2. FORGOT PASSWORD 3-STEP FLOW ──────────────────────────────── */
          <div className="p-6 space-y-4 pt-3">
            {forgotStep === 1 && (
              <form onSubmit={handleForgotStep1} className="space-y-4">
                <div className="p-3 bg-purple-900/20 border border-purple-500/30 rounded-2xl text-xs text-purple-200">
                  Enter your registered <strong>Email Address</strong> or <strong>Mobile Number</strong>. We will dispatch a 6-digit OTP verification code via Twilio SMS & Email.
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1">
                    Registered Email or Phone
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-purple-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. priya@example.com or +919876543210"
                      value={forgotIdentifier}
                      onChange={(e) => setForgotIdentifier(e.target.value)}
                      className="w-full glass-input pl-10 pr-4 py-3 rounded-2xl text-xs text-white placeholder-gray-500 focus:border-purple-500 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-2xl gradient-purple hover:opacity-95 text-white font-extrabold text-xs shadow-xl shadow-purple-600/30 transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Send 6-Digit OTP</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {forgotStep === 2 && (
              <form onSubmit={handleForgotStep2} className="space-y-4">
                <div className="text-center">
                  <p className="text-xs text-gray-300">
                    We sent a 6-digit code to <strong className="text-purple-300">{forgotIdentifier}</strong>
                  </p>
                  <div className="flex items-center justify-center gap-1.5 text-xs text-amber-400 font-mono mt-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      Expires in: {Math.floor(otpExpiresIn / 60)}:{(otpExpiresIn % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1 text-center">
                    Enter 6-Digit OTP Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    placeholder="• • • • • •"
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full glass-input py-3.5 rounded-2xl text-center font-mono text-xl font-bold tracking-[0.4em] text-purple-300 border-purple-500/50 focus:border-purple-400 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || forgotOtp.length !== 6}
                  className="w-full py-3.5 rounded-2xl gradient-purple hover:opacity-95 text-white font-extrabold text-xs shadow-xl shadow-purple-600/30 transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verify OTP Code</span>
                    </>
                  )}
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={handleForgotStep1}
                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center justify-center gap-1 mx-auto font-semibold"
                  >
                    <RotateCw className="w-3 h-3" /> Resend OTP Code via Twilio
                  </button>
                </div>
              </form>
            )}

            {forgotStep === 3 && (
              <form onSubmit={handleForgotStep3} className="space-y-4">
                <div className="p-3 bg-emerald-900/20 border border-emerald-500/30 rounded-2xl text-xs text-emerald-200">
                  OTP verified! Please create a strong new password (minimum 8 characters with letters & numbers).
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-purple-400 absolute left-3.5 top-3.5" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full glass-input pl-10 pr-12 py-3 rounded-2xl text-xs text-white placeholder-gray-500 focus:border-purple-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-3 p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-purple-400 absolute left-3.5 top-3.5" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full glass-input pl-10 pr-4 py-3 rounded-2xl text-xs text-white placeholder-gray-500 focus:border-purple-500 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-2xl gradient-purple hover:opacity-95 text-white font-extrabold text-xs shadow-xl shadow-purple-600/30 transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Update & Reset Password</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
