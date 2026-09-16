import React, { useState, useEffect } from 'react';
import { analytics } from '../lib/analytics';
import { CheckCircle2, AlertCircle, Loader2, X, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

interface SignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  ctaSource?: string;
}

export const SignupModal: React.FC<SignupModalProps> = ({ isOpen, onClose, ctaSource = 'hero' }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [primaryMarket, setPrimaryMarket] = useState<'forex' | 'futures' | 'crypto' | 'stocks'>('forex');

  // State management
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSuccess, setIsSuccess] = useState(false);
  const [createdUser, setCreatedUser] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      analytics.track('signup_modal_opened', { cta_location: ctaSource as any });
      setIsSuccess(false);
      setErrorMessage(null);
      setFieldErrors({});
    } else {
      document.body.style.overflow = 'unset';
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, ctaSource, onClose]);

  if (!isOpen) return null;

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'Please enter your name';
    if (!email.trim()) {
      errors.email = 'Please enter your email';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validate()) {
      analytics.track('signup_error_encountered', { error_message: 'Client validation failed' });
      return;
    }

    setIsLoading(true);
    analytics.track('signup_form_submitted', {
      experience_level: experienceLevel,
      primary_market: primaryMarket,
      cta_location: ctaSource as any,
    });

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          experienceLevel,
          primaryMarket,
          source: `try_free_landing_${ctaSource}`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.issues) {
          const map: Record<string, string> = {};
          data.issues.forEach((i: any) => { map[i.field] = i.message; });
          setFieldErrors(map);
          throw new Error('Please fix the errors above.');
        }
        throw new Error(data.error || 'Failed to complete registration.');
      }

      // Success
      setIsSuccess(true);
      setCreatedUser(data.data);
      analytics.identify(data.data.id, {
        email: data.data.email,
        name: data.data.name,
        plan_tier: 'free_trial',
        experience_level: experienceLevel,
        primary_market: primaryMarket,
      });
      analytics.track('signup_completed', {
        cta_location: ctaSource as any,
        primary_market: primaryMarket,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Something went wrong. Please try again.');
      analytics.track('signup_error_encountered', { error_message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div 
        className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-fxr-card border border-fxr-border shadow-2xl p-6 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-lg text-fxr-muted hover:text-fxr-text hover:bg-fxr-border transition-colors focus:outline-none focus:ring-2 focus:ring-fxr-primary"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {!isSuccess ? (
          <div>
            {/* Header */}
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fxr-primary/10 border border-fxr-primary/30 text-xs font-semibold text-blue-400 mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Zero Risk • No Credit Card Required</span>
              </div>
              <h3 id="modal-title" className="text-2xl font-bold text-fxr-text">
                Start Practicing on FX Replay Free
              </h3>
              <p className="text-sm text-fxr-muted mt-1.5">
                Join 1,000,000+ traders mastering their strategy before trading live capital.
              </p>
            </div>

            {/* General Error Banner */}
            {errorMessage && (
              <div className="mb-5 flex items-start gap-3 p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-sm animate-shake">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Signup Form */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label className="block text-xs font-medium text-fxr-muted mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: '' });
                  }}
                  placeholder="e.g. Alex Morgan"
                  disabled={isLoading}
                  className={`w-full px-4 py-3 rounded-xl bg-fxr-bg border ${
                    fieldErrors.name ? 'border-red-500 ring-1 ring-red-500' : 'border-fxr-border focus:border-fxr-primary'
                  } text-fxr-text placeholder-fxr-subtle text-sm focus:outline-none focus:ring-2 focus:ring-fxr-primary/20 transition-all`}
                />
                {fieldErrors.name && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-fxr-muted mb-1.5">
                  Work or Trading Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: '' });
                  }}
                  placeholder="alex@example.com"
                  disabled={isLoading}
                  className={`w-full px-4 py-3 rounded-xl bg-fxr-bg border ${
                    fieldErrors.email ? 'border-red-500 ring-1 ring-red-500' : 'border-fxr-border focus:border-fxr-primary'
                  } text-fxr-text placeholder-fxr-subtle text-sm focus:outline-none focus:ring-2 focus:ring-fxr-primary/20 transition-all`}
                />
                {fieldErrors.email && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.email}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-fxr-muted mb-1.5">
                    Primary Market
                  </label>
                  <select
                    value={primaryMarket}
                    onChange={(e: any) => setPrimaryMarket(e.target.value)}
                    disabled={isLoading}
                    className="w-full px-3 py-2.5 rounded-xl bg-fxr-bg border border-fxr-border text-fxr-text text-sm focus:outline-none focus:border-fxr-primary transition-all"
                  >
                    <option value="forex">Forex (EUR/USD, GBP/JPY)</option>
                    <option value="futures">Futures (NQ, ES, Gold)</option>
                    <option value="crypto">Crypto (BTC, ETH)</option>
                    <option value="stocks">Stocks & Indices</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-fxr-muted mb-1.5">
                    Trading Experience
                  </label>
                  <select
                    value={experienceLevel}
                    onChange={(e: any) => setExperienceLevel(e.target.value)}
                    disabled={isLoading}
                    className="w-full px-3 py-2.5 rounded-xl bg-fxr-bg border border-fxr-border text-fxr-text text-sm focus:outline-none focus:border-fxr-primary transition-all"
                  >
                    <option value="beginner">Beginner (&lt; 1 yr)</option>
                    <option value="intermediate">Intermediate (1-3 yrs)</option>
                    <option value="advanced">Advanced / Funded</option>
                  </select>
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3.5 px-6 rounded-xl font-semibold text-white bg-fxr-primary hover:bg-fxr-primaryHover active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all text-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating Your Free Account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Free Account & Start Replaying</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-xs text-fxr-subtle pt-2">
                <ShieldCheck className="w-4 h-4 text-fxr-accent" />
                <span>Instant access • 5-second candle data • Unlimited charts</span>
              </div>
            </form>
          </div>
        ) : (
          /* Success State */
          <div className="text-center py-6 animate-fadeIn">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-fxr-accent/10 border border-fxr-accent/30 flex items-center justify-center text-fxr-accent">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h3 className="text-2xl font-bold text-fxr-text">
              Welcome to FX Replay, {createdUser?.name || 'Trader'}!
            </h3>
            <p className="text-sm text-fxr-muted mt-2 max-w-sm mx-auto">
              Your free account has been created for <span className="text-fxr-text font-medium">{createdUser?.email}</span>. You're ready to start your first backtest.
            </p>

            <div className="my-6 p-4 rounded-xl bg-fxr-bg border border-fxr-border text-left">
              <div className="text-xs font-semibold text-fxr-muted uppercase tracking-wider mb-2">
                Your Free Trial Privileges:
              </div>
              <ul className="space-y-1.5 text-xs text-fxr-text">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-fxr-accent"></span>
                  Real Historical Forex & Futures Replay Engine
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-fxr-accent"></span>
                  TradingView Integrated Charting Tools
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-fxr-accent"></span>
                  Prop Firm Challenge Simulator Mode Enabled
                </li>
              </ul>
            </div>

            <button
              onClick={() => {
                onClose();
                window.location.hash = 'simulator';
              }}
              className="w-full py-3.5 px-6 rounded-xl font-semibold text-white bg-fxr-accent hover:bg-fxr-accentHover transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-600/20 text-sm"
            >
              <span>Launch Interactive Simulator</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
