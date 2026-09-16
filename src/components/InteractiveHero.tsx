import React, { useState, useEffect } from 'react';
import { SignupModal } from './SignupModal';
import { BacktestPreview } from './BacktestPreview';
import { analytics } from '../lib/analytics';
import { ArrowRight, ShieldCheck, Check, Sparkles, Star, Users } from 'lucide-react';

export const InteractiveHero: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSource, setModalSource] = useState('hero');
  const [headlineVariant, setHeadlineVariant] = useState<'control' | 'variant_prop_firm'>('control');

  useEffect(() => {
    analytics.init();
    analytics.track('landing_page_viewed', { experiment_id: 'exp_hero_v1' });

    // A/B Test Variant Allocation
    // Experiment: Prop-Firm Oriented Copy vs. General Trader Copy
    const urlParams = new URLSearchParams(window.location.search);
    const paramVariant = urlParams.get('variant');

    if (paramVariant === 'prop') {
      setHeadlineVariant('variant_prop_firm');
      analytics.track('experiment_variant_exposed', { experiment_id: 'exp_hero_v1', variant_id: 'variant_prop_firm' });
    } else {
      const assigned = analytics.getVariant('exp_hero_headline', 'control');
      setHeadlineVariant(assigned as any);
      analytics.track('experiment_variant_exposed', { experiment_id: 'exp_hero_v1', variant_id: assigned });
    }
  }, []);

  const openSignup = (source: string) => {
    setModalSource(source);
    analytics.track('cta_button_clicked', { cta_location: source as any, cta_copy: 'Start Free Trial' });
    setIsModalOpen(true);
  };

  return (
    <div className="relative pt-8 pb-16 md:pt-14 md:pb-24 overflow-hidden">
      {/* Glow Orbs in Background */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[650px] h-[350px] bg-blue-600/15 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute top-1/3 right-1/4 w-[350px] h-[250px] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Social Proof Eyebrow */}
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-fxr-card/80 border border-fxr-border/80 text-xs text-fxr-muted mb-6 shadow-sm">
            <span className="flex text-amber-400">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3 h-3 fill-amber-400" />
              ))}
            </span>
            <span className="text-fxr-text font-medium">4.9/5 Rating</span>
            <span className="text-fxr-subtle">•</span>
            <span className="flex items-center gap-1 text-fxr-accent font-medium">
              <Users className="w-3.5 h-3.5" />
              <span>1,000,000+ Traders</span>
            </span>
          </div>

          {/* Dynamic Headline (A/B Tested) */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-fxr-text max-w-4xl leading-[1.12]">
            {headlineVariant === 'variant_prop_firm' ? (
              <>
                Pass Your Next Prop Firm Challenge{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-emerald-400">
                  Before Risking Real Capital
                </span>
              </>
            ) : (
              <>
                Your Strategy Shouldn’t Be Tested{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-emerald-400">
                  With Real Money
                </span>
              </>
            )}
          </h1>

          {/* Subtitle */}
          <p className="mt-5 text-base sm:text-lg text-fxr-muted max-w-2xl leading-relaxed">
            Replay real historical Forex, Futures, and Crypto markets at full speed. Build rule-based consistency, verify win rates, and scale with confidence.
          </p>

          {/* Primary CTA Group */}
          <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <button
              onClick={() => openSignup('hero_primary')}
              className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-base text-white bg-fxr-primary hover:bg-fxr-primaryHover active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 shadow-xl shadow-blue-600/30 group"
            >
              <span>Try FX Replay Free</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <a
              href="#simulator"
              className="w-full sm:w-auto px-6 py-4 rounded-xl font-medium text-sm text-fxr-text bg-fxr-card/80 hover:bg-fxr-card border border-fxr-border hover:border-fxr-borderLight transition-all flex items-center justify-center gap-2 text-center"
            >
              <span>Explore Interactive Demo</span>
            </a>
          </div>

          {/* Trust Guarantees */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-fxr-subtle">
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-fxr-accent" />
              <span>Free forever plan</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-fxr-accent" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-fxr-accent" />
              <span>Instant browser access</span>
            </div>
          </div>
        </div>

        {/* Interactive Backtesting Simulator Island */}
        <div className="mt-12 sm:mt-16">
          <BacktestPreview onCtaClick={() => openSignup('simulator_cta')} />
        </div>
      </div>

      {/* Reusable Signup Modal */}
      <SignupModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        ctaSource={modalSource}
      />
    </div>
  );
};
