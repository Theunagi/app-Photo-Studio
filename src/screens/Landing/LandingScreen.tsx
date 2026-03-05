/**
 * Photo Studio - Landing Page
 * Marketing page shown to unauthenticated users.
 * Uses Tailwind CSS + Motion + Lucide icons.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera, ArrowRight, Sparkles, Menu, X, Crop, Sun,
  MessageSquarePlus, Image, Pencil, RotateCcw, Download,
} from 'lucide-react';
import './landing.css';

export interface LandingScreenProps {
  onLogin: () => void;
  onDevLogin?: () => void;
  onLegalPage?: (page: 'mentions-legales' | 'cgv' | 'confidentialite' | 'cookies' | 'cgu') => void;
}

const LandingScreen: React.FC<LandingScreenProps> = ({ onLogin, onLegalPage }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const appleTransition = { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <div className="landing-page min-h-screen bg-humble-bg selection:bg-humble-orange/20 selection:text-humble-orange">
      {/* ===== Navbar ===== */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-white/80 backdrop-blur-md border-b border-humble-border py-3 shadow-humble-sm'
            : 'bg-transparent py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-humble-text flex items-center justify-center text-white shadow-humble-sm">
              <Camera size={18} />
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-humble-text">
              Photo Studio
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-humble-gray">
            <a href="#features" className="hover:text-humble-text transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-humble-text transition-colors">How it Works</a>
            <a href="#pricing" className="hover:text-humble-text transition-colors">Pricing</a>
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={onLogin}
              className="text-sm font-medium text-humble-text hover:text-humble-gray transition-colors"
            >
              Log in
            </button>
            <button onClick={onLogin} className="humble-btn-primary py-2 px-5 text-sm">
              Start Free Trial <ArrowRight size={16} />
            </button>
          </div>

          <button
            className="md:hidden text-humble-text"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* ===== Mobile Menu ===== */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-white pt-24 px-6 md:hidden"
          >
            <div className="flex flex-col gap-6 text-xl font-medium">
              <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How it Works</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
              <hr className="border-humble-border" />
              <button className="text-left" onClick={onLogin}>Log in</button>
              <button
                onClick={() => { setMobileMenuOpen(false); onLogin(); }}
                className="humble-btn-primary w-full justify-center mt-4"
              >
                Start Free Trial
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main>
        {/* ===== Hero Section ===== */}
        <section className="relative pt-28 pb-16 md:pt-36 md:pb-24 overflow-hidden bg-[#FAFAFA]">
          <div className="max-w-7xl mx-auto px-6">
            {/* Hero copy — centered */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={appleTransition}
              className="text-center max-w-3xl mx-auto mb-10"
            >
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-humble-border bg-white mb-5">
                <span className="w-2 h-2 rounded-full bg-humble-orange" />
                <span className="text-sm font-medium text-humble-text">Photo Studio 2.0 is live</span>
              </div>

              <h1 className="text-3xl md:text-[44px] font-bold tracking-tighter text-[#111111] mb-5 leading-[1.12]">
                Your Product's Next<br />10 Years of Visuals.
              </h1>
              <p className="text-base md:text-lg text-[#666666] mb-8 font-light tracking-tight max-w-xl mx-auto">
                Upload a simple product photo. Our AI automatically removes the background, adds
                realistic shadows, and generates stunning lifestyle scenes in seconds.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button onClick={onLogin} className="humble-btn-secondary py-3 px-7 text-sm font-semibold">
                  Talk to Sales
                </button>
                <button onClick={onLogin} className="humble-btn-primary py-3 px-7 text-sm">
                  Start Free Trial
                </button>
              </div>
            </motion.div>

            {/* Hero — Studio Mockup with cycling images */}
            <HeroMockup appleTransition={appleTransition} />
          </div>
        </section>

        {/* ===== Features Section ===== */}
        <section id="features" className="py-32 bg-humble-bg">
          <div className="max-w-7xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={appleTransition}
              className="text-center max-w-2xl mx-auto mb-20"
            >
              <h2 className="text-4xl md:text-6xl font-bold tracking-tighter text-humble-text mb-6">
                Everything you need.
                <br />
                Perfectly integrated.
              </h2>
              <p className="text-humble-gray text-xl font-light tracking-tight">
                Our AI pipeline handles the tedious work so you can focus on selling. Designed for
                speed and precision.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[320px]">
              {/* Instant Cutouts — large card */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ ...appleTransition, delay: 0.1 }}
                className="md:col-span-2 humble-card p-10 relative overflow-hidden group"
              >
                <div className="relative z-10 w-full h-full flex flex-col justify-between">
                  <div>
                    <div className="w-14 h-14 rounded-2xl bg-humble-light-gray flex items-center justify-center mb-6 text-humble-text">
                      <Crop size={28} />
                    </div>
                    <h3 className="text-3xl font-bold tracking-tight text-humble-text mb-3">
                      Instant Cutouts
                    </h3>
                    <p className="text-humble-gray text-lg max-w-md leading-relaxed font-light">
                      Remove backgrounds with pixel-perfect precision in milliseconds. Even tricky
                      edges like hair, fur, or transparent glass.
                    </p>
                  </div>
                </div>
                <div className="absolute right-0 bottom-0 w-2/3 h-full bg-gradient-to-tl from-humble-light-gray to-transparent opacity-50 rounded-tl-[100px] transform translate-x-10 translate-y-10 group-hover:translate-x-5 group-hover:translate-y-5 transition-transform duration-500" />
              </motion.div>

              {/* Realistic Shadows */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ ...appleTransition, delay: 0.2 }}
                className="md:col-span-1 humble-card p-10 relative overflow-hidden"
              >
                <div className="w-14 h-14 rounded-2xl bg-humble-light-gray flex items-center justify-center mb-6 text-humble-text">
                  <Sun size={28} />
                </div>
                <h3 className="text-2xl font-bold tracking-tight text-humble-text mb-3">
                  Realistic Shadows
                </h3>
                <p className="text-humble-gray leading-relaxed font-light">
                  Generate natural drop shadows or reflections that ground your product perfectly.
                </p>
              </motion.div>

              {/* Lifestyle Scenes — dark full-width */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ ...appleTransition, delay: 0.3 }}
                className="md:col-span-3 bg-humble-text text-white rounded-[2rem] p-10 border border-gray-800 shadow-humble-lg relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-10"
              >
                <div className="relative z-10 max-w-xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-bold uppercase tracking-wider mb-6 backdrop-blur-md">
                    <Sparkles size={14} className="text-humble-orange" />
                    Generative AI
                  </div>
                  <h3 className="text-4xl font-bold tracking-tight mb-4">
                    Stunning Lifestyle Scenes
                  </h3>
                  <p className="text-gray-400 text-lg leading-relaxed mb-8 font-light">
                    Type a prompt like{' '}
                    <span className="text-white font-medium">
                      "on a wooden table in a cozy caf&eacute;"
                    </span>{' '}
                    and watch your product blend seamlessly into the scene with perfect lighting and
                    perspective.
                  </p>
                  <button
                    onClick={onLogin}
                    className="humble-btn bg-white text-humble-text hover:bg-gray-100 text-sm"
                  >
                    Try it now <ArrowRight size={16} />
                  </button>
                </div>
                <div className="relative w-full md:w-1/2 h-64 md:h-full rounded-2xl overflow-hidden border border-white/10">
                  <img
                    src="https://picsum.photos/seed/lifestyle/800/600"
                    alt=""
                    className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity duration-500"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ===== How it Works ===== */}
        <section id="how-it-works" className="py-32 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-20 items-center">
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={appleTransition}
              >
                <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-humble-text mb-8 leading-tight">
                  From raw photo to ready-to-publish in 3 clicks.
                </h2>
                <div className="space-y-10 mt-12">
                  <Step
                    number="1"
                    title="Upload your photo"
                    description="Drag and drop any product photo. It doesn't need to be perfect — our AI handles bad lighting and messy backgrounds."
                  />
                  <Step
                    number="2"
                    title="Choose your style"
                    description="Select a pure white background for Amazon, or describe a custom lifestyle scene for your Shopify store."
                  />
                  <Step
                    number="3"
                    title="Download & Publish"
                    description="Export in 2K or 4K resolution. Ready to boost your conversion rates immediately."
                  />
                </div>
              </motion.div>

              <div className="relative">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 40 }}
                  whileInView={{ opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ ...appleTransition, delay: 0.2 }}
                  className="aspect-square rounded-[2.5rem] bg-humble-light-gray overflow-hidden relative shadow-humble-lg ring-1 ring-black/5"
                >
                  <img
                    src="https://picsum.photos/seed/process/800/800"
                    alt=""
                    className="w-full h-full object-cover mix-blend-multiply opacity-90"
                    referrerPolicy="no-referrer"
                  />
                  <motion.div
                    animate={{ top: ['0%', '100%', '0%'] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute left-0 right-0 h-1 bg-humble-blue shadow-[0_0_20px_rgba(0,122,255,1)] z-10"
                  />
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== Pricing Section ===== */}
        <section id="pricing" className="py-32 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={appleTransition}
              className="text-center max-w-2xl mx-auto mb-20"
            >
              <h2 className="text-5xl md:text-6xl font-bold tracking-tighter text-humble-text mb-6">
                Choose your Plan (per site)
              </h2>
              <p className="text-humble-gray text-xl font-light tracking-tight">
                Each generation costs 2 credits (2K) or 3 credits (4K).
              </p>
            </motion.div>

            <div className="bg-[#F0F0F0] p-4 md:p-6 rounded-[3rem] mx-auto max-w-6xl">
              <div className="grid md:grid-cols-3 gap-4 items-stretch">
                <PricingCard
                  name="Starter"
                  desc="Perfect for small projects."
                  oldPrice="19.90"
                  price="9.90"
                  credits={70}
                  spots={10}
                  features={[
                    'AI Background Removal',
                    'Realistic Shadows',
                    'Lifestyle Generation',
                    '2K Resolution Export',
                  ]}
                  delay={0.1}
                  transition={appleTransition}
                />
                <PricingCard
                  name="Pro"
                  desc="For growing brands."
                  oldPrice="39.90"
                  price="19.90"
                  credits={180}
                  spots={5}
                  features={[
                    'Everything in Starter',
                    '4K Resolution Export',
                    'Batch Processing',
                    'Priority Support',
                    'Commercial License',
                  ]}
                  delay={0.2}
                  transition={appleTransition}
                />
                <PricingCard
                  name="Business"
                  desc="For high-volume needs."
                  oldPrice="79.90"
                  price="39.90"
                  credits={420}
                  spots={2}
                  features={[
                    'Everything in Pro',
                    'Custom Branding',
                    'API Access',
                    'Dedicated Account Manager',
                    'Custom AI Models',
                  ]}
                  delay={0.3}
                  transition={appleTransition}
                />
              </div>
            </div>

            <p className="text-center text-humble-gray mt-12 text-sm font-medium">
              Secure payment via Stripe. Cancel anytime.
            </p>
          </div>
        </section>

        {/* ===== CTA Section ===== */}
        <section className="py-32 bg-humble-text relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-humble-orange/20 rounded-full blur-[120px] -z-10" />
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={appleTransition}
            className="max-w-4xl mx-auto px-6 text-center"
          >
            <h2 className="text-5xl md:text-6xl font-bold tracking-tighter text-white mb-6">
              Ready to upgrade your visuals?
            </h2>
            <p className="text-xl text-gray-400 mb-10 font-light tracking-tight">
              Join thousands of brands creating studio-quality photos without the studio.
            </p>
            <button
              onClick={onLogin}
              className="humble-btn bg-white text-humble-text hover:bg-gray-100 shadow-humble-glow text-xl px-12 py-6 mx-auto"
            >
              Start your 14-day free trial
            </button>
          </motion.div>
        </section>
      </main>

      {/* ===== Footer ===== */}
      <footer className="bg-white py-16 border-t border-humble-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-12">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-humble-text flex items-center justify-center text-white">
                <Camera size={20} />
              </div>
              <span className="font-display font-bold text-2xl text-humble-text">Photo Studio</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-16 gap-y-8">
              <div>
                <h4 className="text-sm font-bold text-humble-text uppercase tracking-wider mb-4">Product</h4>
                <div className="flex flex-col gap-3">
                  <a href="#features" className="text-sm text-humble-gray hover:text-humble-text transition-colors">Features</a>
                  <a href="#pricing" className="text-sm text-humble-gray hover:text-humble-text transition-colors">Pricing</a>
                  <a href="#how-it-works" className="text-sm text-humble-gray hover:text-humble-text transition-colors">How it Works</a>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-bold text-humble-text uppercase tracking-wider mb-4">Legal</h4>
                <div className="flex flex-col gap-3">
                  <button onClick={() => onLegalPage?.('mentions-legales')} className="text-sm text-humble-gray hover:text-humble-text transition-colors text-left">Mentions légales</button>
                  <button onClick={() => onLegalPage?.('cgv')} className="text-sm text-humble-gray hover:text-humble-text transition-colors text-left">CGV</button>
                  <button onClick={() => onLegalPage?.('cgu')} className="text-sm text-humble-gray hover:text-humble-text transition-colors text-left">CGU</button>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-bold text-humble-text uppercase tracking-wider mb-4">Privacy</h4>
                <div className="flex flex-col gap-3">
                  <button onClick={() => onLegalPage?.('confidentialite')} className="text-sm text-humble-gray hover:text-humble-text transition-colors text-left">Politique de confidentialité</button>
                  <button onClick={() => onLegalPage?.('cookies')} className="text-sm text-humble-gray hover:text-humble-text transition-colors text-left">Politique de cookies</button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-humble-border flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-humble-gray font-light">
              &copy; {new Date().getFullYear()} Photo Studio. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-humble-gray">
              <button onClick={() => onLegalPage?.('mentions-legales')} className="hover:text-humble-text transition-colors">Mentions légales</button>
              <button onClick={() => onLegalPage?.('confidentialite')} className="hover:text-humble-text transition-colors">Confidentialité</button>
              <button onClick={() => onLegalPage?.('cookies')} className="hover:text-humble-text transition-colors">Cookies</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingScreen;

/* ─── Sub-components ─── */

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-6 group">
      <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-humble-light-gray text-humble-text font-bold text-2xl flex items-center justify-center group-hover:bg-humble-text group-hover:text-white transition-colors duration-300">
        {number}
      </div>
      <div>
        <h3 className="text-2xl font-bold tracking-tight text-humble-text mb-2">{title}</h3>
        <p className="text-humble-gray text-lg leading-relaxed font-light">{description}</p>
      </div>
    </div>
  );
}

interface PricingCardProps {
  name: string;
  desc: string;
  oldPrice: string;
  price: string;
  credits: number;
  spots: number;
  features: string[];
  delay: number;
  transition: { duration: number; ease: readonly [number, number, number, number] };
}

function PricingCard({
  name,
  desc,
  oldPrice,
  price,
  credits,
  spots,
  features,
  delay,
  transition,
}: PricingCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ ...transition, delay }}
      className="bg-white rounded-[2rem] p-8 flex flex-col shadow-sm"
    >
      <h3 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">{name}</h3>
      <p className="text-sm text-gray-500 mb-8 font-medium">{desc}</p>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-4xl font-bold tracking-tighter text-gray-900 line-through decoration-2 opacity-50">
          &euro;{oldPrice}
        </span>
        <span className="text-4xl font-bold tracking-tighter text-gray-900">&euro;{price}</span>
      </div>
      <p className="text-sm text-gray-500 mb-2 font-medium">
        / month &bull; {credits} Credits
      </p>
      <p className="text-sm text-humble-orange font-medium mb-8">
        Join as founding customer ({spots} spots).
      </p>
      <button className="bg-black text-white rounded-full py-4 px-6 font-bold shadow-lg w-full mb-8 hover:bg-gray-900 transition-colors">
        Book a Call
      </button>
      <ul className="space-y-0 flex-1 border-t border-gray-100 pt-2">
        {features.map((f) => (
          <PricingFeature key={f} text={f} />
        ))}
      </ul>
    </motion.div>
  );
}

/* ─── Hero Mockup with Cycling Images ─── */

const SUPABASE_IMG = 'https://lbyayuonwesmxvzvvavx.supabase.co/storage/v1/object/public/project-images/be988052-ca36-4649-8ab9-6dac394723dc';

const DEMO_SLIDES = [
  { label: 'ORIGINAL',  url: `${SUPABASE_IMG}/inputImage.png`, scene: false },
  { label: 'FINAL',     url: `${SUPABASE_IMG}/autoCrop.png`,   scene: false },
  { label: 'LIFESTYLE', url: `${SUPABASE_IMG}/lifestyle-0.png`, scene: true },
  { label: 'EDIT',      url: `${SUPABASE_IMG}/edit-0.png`,      scene: true },
  { label: 'EDIT 2',    url: `${SUPABASE_IMG}/edit-1.png`,      scene: true },
];

function HeroMockup(_props: { appleTransition: { duration: number; ease: readonly [number, number, number, number] } }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setActiveIdx(prev => (prev + 1) % DEMO_SLIDES.length);
    }, 4000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 80 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      className="relative mx-auto max-w-6xl"
    >
      <div className="p-3 md:p-5 bg-black rounded-[2.5rem] shadow-2xl mx-auto border-[6px] border-gray-800 relative">
        <div className="bg-[#FAFAF8] rounded-[2rem] overflow-hidden border-4 border-white w-full flex relative" style={{ height: 'clamp(420px, 56vw, 720px)' }}>

          {/* ── Left Sidebar ── */}
          <div className="w-56 border-r border-[#E8E8E4] flex-col bg-white shrink-0 hidden md:flex" style={{ padding: '20px 16px' }}>
            {/* Logo */}
            <div className="flex items-center gap-2.5 px-1 mb-6">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: '#ff4000' }}>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect width="28" height="28" rx="6" fill="currentColor" opacity="0.12"/><path d="M14 8a3 3 0 100 6 3 3 0 000-6zm-5 3a5 5 0 1110 0 5 5 0 01-10 0z" fill="currentColor"/><circle cx="19" cy="9" r="1.5" fill="currentColor"/><rect x="4" y="6" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
              </div>
              <span className="font-semibold text-[15px] tracking-tight" style={{ color: '#1D1D1F' }}>Photo Studio</span>
            </div>
            {/* Buttons */}
            <div className="flex flex-col gap-1 mb-7">
              <div className="flex items-center gap-2.5 w-full rounded-[10px] text-[14px] font-medium text-white" style={{ background: '#2D2D2D', padding: '10px 14px' }}>
                <MessageSquarePlus size={15} /> New Project
              </div>
              <div className="flex items-center gap-2.5 w-full rounded-[10px] text-[14px] font-medium border" style={{ color: '#1D1D1F', borderColor: '#E8E8E4', padding: '10px 14px' }}>
                <Sparkles size={15} style={{ color: '#6B6B6B' }} /> Fast Generation
              </div>
            </div>
            {/* Workspace */}
            <div className="mb-5">
              <div className="uppercase italic text-[11px] font-medium tracking-wider mb-1.5 px-2" style={{ color: '#86868B' }}>/ Workspace</div>
              <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[14px] font-medium" style={{ background: '#F5F4F0', color: '#1D1D1F' }}>
                <svg width="15" height="15" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/></svg>
                All Projects
              </div>
            </div>
            {/* Recent */}
            <div>
              <div className="uppercase italic text-[11px] font-medium tracking-wider mb-1.5 px-2" style={{ color: '#86868B' }}>/ Recent</div>
              <div className="space-y-0.5">
                {['CAT TREE', 'COUSSIN', 'TEST 2'].map((name, i) => (
                  <div key={name} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[14px] font-medium ${i === 1 ? 'bg-[#F5F4F0]' : ''}`} style={{ color: i === 1 ? '#1D1D1F' : '#6B6B6B' }}>
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: '#D5D5D0' }} />
                    {name}
                  </div>
                ))}
              </div>
            </div>
            {/* Spacer + user */}
            <div className="mt-auto pt-4 border-t border-[#E8E8E4]">
              <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[12px] font-semibold shrink-0" style={{ background: '#6B6B6B' }}>E</div>
                <span className="text-[14px] font-medium truncate" style={{ color: '#1D1D1F' }}>Evan Ou...</span>
                <span className="text-[11px] font-medium border rounded-[10px] px-2 py-0.5 ml-auto shrink-0" style={{ color: '#6B6B6B', borderColor: '#D5D5D0' }}>102 credits</span>
              </div>
            </div>
          </div>

          {/* ── Main Canvas Area ── */}
          <div className="flex-1 min-w-0 relative">
            {/* Canvas with image in rounded rectangle */}
            <div className="w-full h-full relative overflow-hidden flex items-center justify-center" style={{ background: '#F5F4F0' }}>
              <div className="hero-canvas-frame">
                {DEMO_SLIDES.map((slide, i) => (
                  <img
                    key={i}
                    src={slide.url}
                    alt=""
                    className={`hero-cycling-img${slide.scene ? ' scene' : ''}`}
                    style={{ opacity: i === activeIdx ? 1 : 0 }}
                  />
                ))}

                {/* Frosted glass thumbnail strip — inside frame like real dashboard */}
                <div className="hero-thumb-strip">
                  {DEMO_SLIDES.map((slide, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setActiveIdx(i);
                        if (timerRef.current) clearInterval(timerRef.current);
                        timerRef.current = setInterval(() => {
                          setActiveIdx(prev => (prev + 1) % DEMO_SLIDES.length);
                        }, 4000);
                      }}
                      className={`hero-thumb-item ${i === activeIdx ? 'active' : ''}`}
                    >
                      <img src={slide.url} alt="" />
                      <span className={`hero-thumb-label ${i === activeIdx ? 'active' : ''}`}>
                        {slide.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Right Sidebar (compact) ── */}
          <div className="border-l border-[#E8E8E4] bg-white hidden lg:flex flex-col shrink-0" style={{ width: '160px', minWidth: '160px' }}>
            {/* Project name */}
            <div style={{ padding: '14px 14px', borderBottom: '1px solid #F0F0EC' }}>
              <div className="text-[13px] font-semibold tracking-tight" style={{ color: '#1D1D1F' }}>COUSSIN</div>
              <span className="text-[11px]" style={{ color: '#9E9E9E' }}>03/03/2026</span>
            </div>
            {/* Tool buttons */}
            <div className="flex flex-col gap-0.5" style={{ padding: '8px 8px' }}>
              <div className="flex items-center gap-2 w-full rounded-lg text-[12px] font-medium cursor-pointer" style={{ padding: '7px 10px', color: '#6B6B6B' }}>
                <Image size={14} style={{ color: '#9E9E9E' }} /> Lifestyle
              </div>
              <div className="flex items-center gap-2 w-full rounded-lg text-[12px] font-medium cursor-pointer" style={{ padding: '7px 10px', color: '#6B6B6B' }}>
                <Pencil size={14} style={{ color: '#9E9E9E' }} /> Edit
              </div>
              <div className="flex items-center gap-2 w-full rounded-lg text-[12px] font-medium cursor-pointer" style={{ padding: '7px 10px', color: '#6B6B6B' }}>
                <RotateCcw size={14} style={{ color: '#9E9E9E' }} /> Redo
              </div>
            </div>
            {/* Spacer */}
            <div className="flex-1" />
            {/* Download */}
            <div style={{ borderTop: '1px solid #E8E8E4', padding: '10px 8px' }}>
              <div className="flex items-center justify-center gap-2 w-full rounded-lg border text-[12px] font-medium cursor-pointer" style={{ padding: '8px 0', borderColor: '#E8E8E4', color: '#1D1D1F' }}>
                <Download size={14} /> Download
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function PricingFeature({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-3 py-4 border-b border-gray-100 last:border-0">
      <div className="w-5 h-5 rounded-full bg-humble-orange flex items-center justify-center text-white flex-shrink-0">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <span className="text-sm text-gray-600 font-medium">{text}</span>
    </li>
  );
}
