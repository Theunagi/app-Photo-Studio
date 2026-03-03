/**
 * Photo Studio - Landing Page
 * Marketing page shown to unauthenticated users.
 * Uses Tailwind CSS + Motion + Lucide icons.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera, Wand2, ArrowRight, Sparkles, Menu, X, Crop, Sun,
  MessageSquarePlus, Play,
} from 'lucide-react';
import './landing.css';

export interface LandingScreenProps {
  onLogin: () => void;
  onDevLogin?: () => void;
}

const LandingScreen: React.FC<LandingScreenProps> = ({ onLogin }) => {
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
        <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden bg-[#FAFAFA]">
          {/* Soft gradients */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-[#F2F0ED] to-transparent -z-10" />
          <div className="absolute top-1/4 left-0 w-[400px] h-[400px] bg-blue-50/50 rounded-full blur-3xl -z-10" />
          <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-orange-50/50 rounded-full blur-3xl -z-10" />

          <div className="max-w-7xl mx-auto px-6">
            {/* Hero copy + floating cards */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-12 mb-20">
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={appleTransition}
                className="max-w-2xl text-left z-10"
              >
                <h1 className="text-6xl md:text-[80px] font-bold tracking-tighter text-[#111111] mb-6 leading-[1.05]">
                  Your Product's Next 10 Years of Visuals
                  <span className="text-[#FF5A36]">.</span>
                </h1>
                <p className="text-xl md:text-2xl text-[#666666] mb-10 font-light tracking-tight max-w-xl">
                  Upload a simple product photo. Our AI automatically removes the background, adds
                  realistic shadows, and generates stunning lifestyle scenes in seconds.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <button onClick={onLogin} className="humble-btn-primary w-full sm:w-auto">
                    Start my 24h Build
                  </button>
                </div>
              </motion.div>

              {/* Floating before/after cards */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...appleTransition, delay: 0.1 }}
                className="relative w-full max-w-md hidden md:block"
              >
                {/* "Bad" photo card */}
                <motion.div
                  animate={{ y: [0, -10, 0], rotate: [-2, -4, -2] }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute -top-10 -left-10 w-64 h-64 bg-white p-3 rounded-xl shadow-lg border border-gray-200 rotate-[-3deg] opacity-60 grayscale-[50%]"
                >
                  <div className="w-full h-full bg-gray-100 rounded-lg overflow-hidden relative">
                    <img
                      src="https://picsum.photos/seed/badphoto/400/400"
                      alt=""
                      className="w-full h-full object-cover blur-[1px]"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded uppercase tracking-wider shadow-sm">
                        Bad Lighting
                      </span>
                    </div>
                  </div>
                </motion.div>

                {/* "Good" photo card */}
                <motion.div
                  animate={{ y: [0, 10, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                  className="relative z-10 w-80 h-96 bg-white p-4 rounded-2xl shadow-2xl border border-gray-100 ml-auto"
                >
                  <div className="w-full h-full rounded-xl overflow-hidden relative group">
                    <img
                      src="https://picsum.photos/seed/goodphoto/600/800"
                      alt=""
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-400/20 to-transparent h-20 -translate-y-20 animate-[scan_3s_ease-in-out_infinite]" />
                    <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center">
                      <span className="bg-white/90 backdrop-blur text-[#007AFF] text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
                        <Sparkles size={12} /> AI Enhanced
                      </span>
                    </div>
                  </div>
                </motion.div>

                {/* Magic wand icon */}
                <div className="absolute top-1/2 left-1/4 -translate-y-1/2 -translate-x-1/2 z-20 text-[#007AFF]">
                  <Wand2 size={32} className="animate-pulse" />
                </div>
              </motion.div>
            </div>

            {/* Hero — App Mockup */}
            <motion.div
              initial={{ opacity: 0, y: 80 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
              className="relative mx-auto max-w-6xl mt-20"
            >
              <div className="p-3 md:p-5 bg-black rounded-[2.5rem] shadow-2xl mx-auto border-[6px] border-gray-800 relative">
                <div className="bg-white rounded-[2rem] overflow-hidden border-4 border-white w-full h-[600px] md:h-[800px] flex flex-col relative">
                  {/* Mockup Toolbar */}
                  <div className="h-14 border-b border-[#E5E5E5] bg-[#F3F3F3] flex items-center px-4 gap-4 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-humble-orange flex items-center justify-center text-white">
                        <Camera size={10} />
                      </div>
                      <span className="font-bold text-sm text-gray-800">Photo Studio</span>
                    </div>
                    <div className="text-xs font-medium text-gray-400">/ Projects</div>
                    <div className="ml-auto flex gap-2">
                      <div className="w-32 h-8 bg-gray-200 rounded-lg" />
                      <div className="w-8 h-8 bg-gray-200 rounded-lg" />
                    </div>
                  </div>

                  {/* Mockup Body */}
                  <div className="flex-1 flex overflow-hidden bg-[#F3F3F3]">
                    {/* Left sidebar */}
                    <div className="w-64 border-r border-[#E5E5E5] flex-col p-4 shrink-0 hidden md:flex">
                      <div className="bg-[#111111] text-white rounded-xl px-4 py-2.5 flex items-center gap-3 text-sm font-medium mb-8 shadow-sm">
                        <MessageSquarePlus size={16} /> New Project
                      </div>
                      <div className="space-y-8">
                        <div>
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-4 px-2">
                            / Workspace
                          </div>
                          <div className="space-y-2">
                            <div className="h-8 w-full bg-gray-200/50 rounded-lg" />
                            <div className="h-8 w-3/4 bg-gray-200/50 rounded-lg" />
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-4 px-2">
                            / Recent
                          </div>
                          <div className="space-y-2">
                            <div className="h-8 w-full bg-gray-200/50 rounded-lg" />
                            <div className="h-8 w-5/6 bg-gray-200/50 rounded-lg" />
                            <div className="h-8 w-4/5 bg-gray-200/50 rounded-lg" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Center panel */}
                    <div className="w-full md:w-80 lg:w-[400px] border-r border-[#E5E5E5] flex flex-col bg-[#F3F3F3] shrink-0 relative z-10 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
                      <div className="p-4 border-b border-[#E5E5E5] shrink-0">
                        <div className="h-10 bg-[#E8E8E8] rounded-xl w-full flex items-center px-3 gap-2">
                          <div className="w-4 h-4 rounded-full bg-gray-300" />
                          <div className="h-3 w-16 bg-gray-300 rounded" />
                        </div>
                      </div>
                      <div className="flex-1 p-4 space-y-6 overflow-hidden">
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="w-7 h-7 rounded-full bg-humble-orange flex items-center justify-center text-white">
                              <Sparkles size={12} />
                            </div>
                            <div className="h-4 w-24 bg-gray-200 rounded" />
                          </div>
                          <div className="space-y-3 mb-5">
                            <div className="h-3 w-full bg-gray-200 rounded" />
                            <div className="h-3 w-5/6 bg-gray-200 rounded" />
                            <div className="h-3 w-4/6 bg-gray-200 rounded" />
                          </div>
                          <div className="h-12 bg-[#F5F5F5] rounded-xl border border-gray-100 flex items-center px-3 justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-white rounded-lg shadow-sm" />
                              <div className="h-3 w-20 bg-gray-200 rounded" />
                            </div>
                            <div className="w-4 h-4 rounded-full bg-humble-orange" />
                          </div>
                        </div>
                        <div className="bg-[#E8E8E8] rounded-2xl p-4 ml-8 rounded-tr-sm">
                          <div className="h-3 w-full bg-gray-300 rounded mb-3" />
                          <div className="h-3 w-2/3 bg-gray-300 rounded" />
                        </div>
                      </div>
                      <div className="p-4 border-t border-[#E5E5E5]/50 shrink-0">
                        <div className="h-12 bg-white rounded-2xl border border-gray-200 flex items-center px-2 justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-humble-orange/10" />
                            <div className="h-3 w-24 bg-gray-200 rounded" />
                          </div>
                          <div className="w-8 h-8 bg-humble-orange rounded-xl" />
                        </div>
                      </div>
                    </div>

                    {/* Right gallery */}
                    <div className="flex-1 bg-[#E5E5E5] p-6 lg:p-10 hidden sm:block overflow-hidden">
                      <div className="flex justify-between mb-8">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-gray-300" />
                          <div className="h-4 w-32 bg-gray-300 rounded" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3, 4, 5].map((i, index) => (
                          <div
                            key={i}
                            className="aspect-[4/3] bg-gray-200 rounded-2xl relative overflow-hidden shadow-sm border border-black/5"
                          >
                            <img
                              src={`https://picsum.photos/seed/mock${i}/400/300`}
                              className="w-full h-full object-cover grayscale opacity-60"
                              alt=""
                              referrerPolicy="no-referrer"
                            />
                            {index === 2 && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center shadow-xl">
                                  <Play size={20} className="ml-1" fill="currentColor" />
                                </div>
                              </div>
                            )}
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/95 px-3 py-2 rounded-xl shadow-sm flex items-center gap-2 border border-gray-100">
                              <div className="w-3 h-3 bg-humble-orange rounded-[4px]" />
                              <div className="flex flex-col gap-1">
                                <div className="h-2 w-12 bg-gray-200 rounded" />
                                <div className="h-2 w-16 bg-gray-300 rounded" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
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
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-humble-text flex items-center justify-center text-white">
              <Camera size={20} />
            </div>
            <span className="font-display font-bold text-2xl text-humble-text">Photo Studio</span>
          </div>
          <div className="flex gap-8 text-base text-humble-gray font-medium">
            <a href="#" className="hover:text-humble-text transition-colors">Privacy</a>
            <a href="#" className="hover:text-humble-text transition-colors">Terms</a>
            <a href="#" className="hover:text-humble-text transition-colors">Contact</a>
          </div>
          <p className="text-base text-humble-gray font-light">
            &copy; {new Date().getFullYear()} Photo Studio. All rights reserved.
          </p>
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
