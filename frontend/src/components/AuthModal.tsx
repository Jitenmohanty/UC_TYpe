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
  Scissors,
  ArrowRight,
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

  // Shared input styling
  const inputClass =
    'w-full bg-white/[0.04] border border-white/[0.10] rounded-xl px-4 py-3 pl-11 text-sm text-white placeholder-gray-500 outline-none transition-all duration-200 focus:border-[#ff6c4c]/60 focus:bg-white/[0.06] focus:ring-1 focus:ring-[#ff6c4c]/30 hover:border-white/20';
  const labelClass = 'block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5';
  const iconClass = 'w-4 h-4 text-[#ff6c4c]/70 absolute left-3.5 top-1/2 -translate-y-1/2';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      {/* Ambient Glow Orbs */}
      <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-[#ff6c4c]/8 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-[300px] h-[300px] bg-[#ff8a6a]/6 rounded-full blur-[120px] pointer-events-none" />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-[420px] bg-[#0e1017] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden"
        style={{ animation: 'fadeSlideUp 0.3s ease-out' }}
      >
        {/* Top accent line */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#ff6c4c] to-transparent opacity-60" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-500 hover:text-gray-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Section */}
        <div className="px-7 pt-7 pb-0">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff8a6a] via-[#ff6c4c] to-[#e54d2e] p-[2px] shadow-lg shadow-[#ff6c4c]/20">
              <div className="w-full h-full bg-[#0e1017] rounded-[10px] flex items-center justify-center">
                <Scissors className="w-5 h-5 text-[#ff6c4c]" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold font-outfit tracking-tight text-white">AURA</span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#ff6c4c]/12 text-[#ff6c4c] border border-[#ff6c4c]/20">FLOW</span>
              </div>
              <span className="text-[10px] text-gray-500 font-medium">Doorstep Salon & Grooming</span>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-white tracking-tight">
            {mode === 'login' && 'Welcome back'}
            {mode === 'register' && 'Create your account'}
            {mode === 'forgot_password' && 'Reset your password'}
          </h2>
          <p className="text-sm text-gray-400 mt-1 mb-5">
            {mode === 'login' && 'Sign in to manage your grooming appointments'}
            {mode === 'register' && 'Join for premium doorstep grooming services'}
            {mode === 'forgot_password' && `Step ${forgotStep} of 3 — ${forgotStep === 1 ? 'Verify identity' : forgotStep === 2 ? 'Enter OTP' : 'Set new password'}`}
          </p>

          {/* Mode Tabs (Login / Register) */}
          {mode !== 'forgot_password' && (
            <div className="flex gap-1 p-1 bg-white/[0.03] rounded-xl border border-white/[0.06] mb-5">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); setSuccessMsg(null); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  mode === 'login'
                    ? 'bg-white/[0.08] text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setError(null); setSuccessMsg(null); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  mode === 'register'
                    ? 'bg-white/[0.08] text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Register
              </button>
            </div>
          )}

          {/* Forgot password back link */}
          {mode === 'forgot_password' && (
            <button
              type="button"
              onClick={() => { setMode('login'); setForgotStep(1); setError(null); setSuccessMsg(null); }}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#ff6c4c] mb-5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
            </button>
          )}
        </div>

        {/* Alerts */}
        <div className="px-7">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/[0.08] border border-red-500/20 text-red-300 text-xs flex items-start gap-2 mb-4">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20 text-emerald-300 text-xs flex items-start gap-2 mb-4">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* ─── SIGN IN / REGISTER FORM ──────────────────────────── */}
        {mode !== 'forgot_password' ? (
          <form onSubmit={handleAuthSubmit} className="px-7 pb-7 space-y-4">
            {/* Role Selector (Register Only) */}
            {mode === 'register' && (
              <div>
                <label className={labelClass}>I am a</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('CUSTOMER')}
                    className={`p-3 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200 ${
                      role === 'CUSTOMER'
                        ? 'bg-[#ff6c4c]/[0.08] border-[#ff6c4c]/40 text-[#ff8a6a]'
                        : 'bg-white/[0.02] border-white/[0.08] text-gray-400 hover:border-white/15 hover:text-gray-300'
                    }`}
                  >
                    <UserIcon className="w-4 h-4" /> Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('BARBER')}
                    className={`p-3 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200 ${
                      role === 'BARBER'
                        ? 'bg-[#ff6c4c]/[0.08] border-[#ff6c4c]/40 text-[#ff8a6a]'
                        : 'bg-white/[0.02] border-white/[0.08] text-gray-400 hover:border-white/15 hover:text-gray-300'
                    }`}
                  >
                    <Shield className="w-4 h-4" /> Partner Barber
                  </button>
                </div>
              </div>
            )}

            {/* Full Name (Register) */}
            {mode === 'register' && (
              <div>
                <label className={labelClass}>Full Name</label>
                <div className="relative">
                  <UserIcon className={iconClass} />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Priya Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className={labelClass}>Email Address</label>
              <div className="relative">
                <Mail className={iconClass} />
                <input
                  type="email"
                  required
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Phone (Register) */}
            {mode === 'register' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`${labelClass} mb-0`}>Mobile Number</label>
                  <span className="text-[10px] text-[#ff6c4c]/70 font-medium">Required for OTP</span>
                </div>
                <div className="relative">
                  <Phone className={iconClass} />
                  <input
                    type="tel"
                    required
                    placeholder="+919876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {/* Service Location (Register) */}
            {mode === 'register' && (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#ff6c4c]/70" />
                    Service Location
                  </span>
                  <button
                    type="button"
                    onClick={requestLocation}
                    disabled={locationLoading}
                    className="text-[11px] text-[#ff6c4c] hover:text-[#ff8a6a] bg-[#ff6c4c]/[0.06] hover:bg-[#ff6c4c]/10 px-2.5 py-1 rounded-lg border border-[#ff6c4c]/20 flex items-center gap-1 transition-all font-medium"
                  >
                    <Navigation className={`w-3 h-3 ${locationLoading ? 'animate-spin' : ''}`} />
                    {locationLoading ? 'Detecting...' : 'Auto Detect'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-gray-500 block mb-1">Latitude</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={latitude}
                      onChange={(e) => setLatitude(Number(e.target.value))}
                      placeholder="e.g. 20.2961"
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#ff6c4c]/40 transition-all"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 block mb-1">Longitude</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={longitude}
                      onChange={(e) => setLongitude(Number(e.target.value))}
                      placeholder="e.g. 85.8245"
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#ff6c4c]/40 transition-all"
                    />
                  </div>
                </div>

                {locationDetected && (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>GPS coordinates detected & synced</span>
                  </div>
                )}
              </div>
            )}

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`${labelClass} mb-0`}>Password</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot_password');
                      setForgotIdentifier(email);
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="text-[11px] text-[#ff6c4c]/70 hover:text-[#ff6c4c] font-medium transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className={iconClass} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-white/[0.06] text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#ff8a6a] via-[#ff6c4c] to-[#e54d2e] text-white font-semibold text-sm shadow-lg shadow-[#ff6c4c]/20 hover:shadow-[#ff6c4c]/30 transition-all duration-200 flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : mode === 'login' ? (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <Sparkles className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Footer note */}
            <p className="text-center text-[11px] text-gray-500 pt-1">
              {mode === 'login' ? (
                <>Don't have an account?{' '}
                  <button type="button" onClick={() => { setMode('register'); setError(null); }} className="text-[#ff6c4c] hover:text-[#ff8a6a] font-medium transition-colors">
                    Create one
                  </button>
                </>
              ) : (
                <>Already have an account?{' '}
                  <button type="button" onClick={() => { setMode('login'); setError(null); }} className="text-[#ff6c4c] hover:text-[#ff8a6a] font-medium transition-colors">
                    Sign in
                  </button>
                </>
              )}
            </p>
          </form>
        ) : (
          /* ─── FORGOT PASSWORD 3-STEP FLOW ──────────────────────── */
          <div className="px-7 pb-7 space-y-4">
            {forgotStep === 1 && (
              <form onSubmit={handleForgotStep1} className="space-y-4">
                <div className="p-3 bg-[#ff6c4c]/[0.06] border border-[#ff6c4c]/15 rounded-xl text-xs text-gray-300 leading-relaxed">
                  Enter your registered <strong className="text-white">email</strong> or <strong className="text-white">phone number</strong>. We'll send a 6-digit verification code.
                </div>
                <div>
                  <label className={labelClass}>Email or Phone</label>
                  <div className="relative">
                    <Mail className={iconClass} />
                    <input
                      type="text"
                      required
                      placeholder="e.g. priya@example.com"
                      value={forgotIdentifier}
                      onChange={(e) => setForgotIdentifier(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#ff8a6a] via-[#ff6c4c] to-[#e54d2e] text-white font-semibold text-sm shadow-lg shadow-[#ff6c4c]/20 transition-all flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Send Verification Code</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {forgotStep === 2 && (
              <form onSubmit={handleForgotStep2} className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-gray-300">
                    Code sent to <strong className="text-[#ff8a6a]">{forgotIdentifier}</strong>
                  </p>
                  <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 mt-1">
                    <Clock className="w-3.5 h-3.5 text-[#ff6c4c]/70" />
                    <span>
                      Expires in <span className="text-white font-mono font-medium">{Math.floor(otpExpiresIn / 60)}:{(otpExpiresIn % 60).toString().padStart(2, '0')}</span>
                    </span>
                  </div>
                </div>

                <div>
                  <label className={`${labelClass} text-center`}>6-Digit Verification Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    placeholder="• • • • • •"
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-white/[0.04] border border-white/[0.10] py-4 rounded-xl text-center font-mono text-2xl font-bold tracking-[0.5em] text-[#ff8a6a] outline-none focus:border-[#ff6c4c]/50 focus:ring-1 focus:ring-[#ff6c4c]/30 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || forgotOtp.length !== 6}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#ff8a6a] via-[#ff6c4c] to-[#e54d2e] text-white font-semibold text-sm shadow-lg shadow-[#ff6c4c]/20 transition-all flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verify Code</span>
                    </>
                  )}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleForgotStep1}
                    className="text-xs text-gray-400 hover:text-[#ff6c4c] flex items-center justify-center gap-1 mx-auto font-medium transition-colors"
                  >
                    <RotateCw className="w-3 h-3" /> Resend code
                  </button>
                </div>
              </form>
            )}

            {forgotStep === 3 && (
              <form onSubmit={handleForgotStep3} className="space-y-4">
                <div className="p-3 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-xl text-xs text-emerald-300">
                  OTP verified! Create a new password (minimum 8 characters).
                </div>

                <div>
                  <label className={labelClass}>New Password</label>
                  <div className="relative">
                    <Lock className={iconClass} />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={`${inputClass} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-white/[0.06] text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Confirm Password</label>
                  <div className="relative">
                    <Lock className={iconClass} />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#ff8a6a] via-[#ff6c4c] to-[#e54d2e] text-white font-semibold text-sm shadow-lg shadow-[#ff6c4c]/20 transition-all flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Reset Password</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Slide-up animation keyframe */}
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};
