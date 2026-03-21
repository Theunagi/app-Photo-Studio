/**
 * FrameFlow - Landing Page
 * Marketing page shown to unauthenticated users.
 * Uses Tailwind CSS + Motion + Lucide icons.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'motion/react';
import {
  Camera, ArrowRight, Sparkles, Menu, X,
  MessageSquarePlus, Image, Pencil, RotateCcw, Download,
  Smartphone, Zap, Plus,
} from 'lucide-react';

/** Animated counter that counts from 0 to `end` when element scrolls into view */
function useCountUp(end: number, duration = 1800, decimals = 0) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const hasRun = useRef(false);

  useEffect(() => {
    if (!inView || hasRun.current) return;
    hasRun.current = true;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(parseFloat((eased * end).toFixed(decimals)));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, end, duration, decimals]);

  return { ref, value };
}
import './landing.css';


export interface LandingScreenProps {
  onLogin: () => void;
  onDevLogin?: () => void;
  onLegalPage?: (page: 'mentions-legales' | 'cgv' | 'confidentialite' | 'cookies' | 'cgu') => void;
}

const TESTIMONIALS = [
  {
    quote: "We switched from studio shoots to FrameFlow for our entire Amazon catalog. 400+ SKUs done in 2 days instead of 3 weeks. The white backgrounds are flawless — passed Amazon compliance on every single image.",
    name: "Marcus Chen",
    role: "Amazon FBA Seller — $2M+ revenue",
  },
  {
    quote: "I was spending €150 per product on photography. Now it's under €1 and the quality is honestly better. The lifestyle scenes are incredible — my click-through rate jumped 34% in the first month.",
    name: "Sarah Dubois",
    role: "Etsy Shop Owner — Handmade Cosmetics",
  },
  {
    quote: "As an agency managing 12 e-commerce brands, this tool changed everything. We batch-process hundreds of images weekly. Our clients can't believe the turnaround time. It's our secret weapon.",
    name: "James Whitfield",
    role: "Founder — Pixel Commerce Agency",
  },
  {
    quote: "The shadow quality is what sold me. Every other AI tool gives you flat, fake-looking results. FrameFlow shadows look like they were shot in a real studio. My Shopify conversion rate is up 28%.",
    name: "Laura Martinez",
    role: "D2C Brand Owner — Home & Kitchen",
  },
  {
    quote: "I test 30-50 new products per week on my store. Before FrameFlow, product photography was my biggest bottleneck. Now I upload, wait 30 seconds, and I'm live. Game changer for dropshipping.",
    name: "Kevin Nguyen",
    role: "Dropshipper — 7-figure Store",
  },
  {
    quote: "We replaced our entire product photography workflow. What used to take our team a full day now takes 20 minutes. The ROI is insane — we saved over €40K in the first quarter alone.",
    name: "Emma Richter",
    role: "Head of E-commerce — ManoMano Seller",
  },
];

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
    <div className="landing-page min-h-screen bg-[#FAFAFA] selection:bg-humble-orange/20 selection:text-humble-orange">
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
              FrameFlow
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-humble-gray">
            <a href="#features" className="hover:text-humble-text transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-humble-text transition-colors">How it Works</a>
            <a href="#pricing" className="hover:text-humble-text transition-colors">Pricing</a>
            <a href="#contact" className="hover:text-humble-text transition-colors">Contact</a>
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
              <a href="#contact" onClick={() => setMobileMenuOpen(false)}>Contact</a>
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
        <section className="relative pt-28 pb-16 md:pt-36 md:pb-24 overflow-hidden">
          <div className="max-w-7xl mx-auto px-6">
            {/* Hero copy — centered */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={appleTransition}
              className="text-center max-w-3xl mx-auto mb-10"
            >
              <h1 className="text-4xl md:text-[56px] font-bold tracking-tighter text-[#111111] mb-5 leading-[1.08]">
                <span className="block text-base md:text-lg font-semibold text-humble-orange mb-3 tracking-normal">AI Product Photography for E-Commerce</span>
                Turn Product Photos<br />Into Profit.
              </h1>
              <p className="text-base md:text-lg text-humble-text font-medium tracking-tight mb-8">
                Our AI is trained on the <span className="text-humble-orange font-semibold">top 1% of Amazon best-selling listings.</span>
              </p>
              <div className="flex flex-col items-center gap-3">
                <button onClick={onLogin} className="humble-btn-primary py-3 px-10 text-base">
                  Start Free Trial <ArrowRight size={16} className="inline ml-1" />
                </button>
              </div>

              {/* Metrics bar — single line with icons */}
              <div className="hidden md:flex items-center justify-center gap-6 mt-10">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md bg-humble-orange/10 flex items-center justify-center flex-shrink-0">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 1l1.5 3.5L13 5l-2.5 2.5.5 3.5L8 9.5 4.5 11l.5-3.5L2.5 5l3.5-.5L8 1z" fill="#E8613A"/></svg>
                  </div>
                  <span className="text-[13px] text-humble-text font-medium whitespace-nowrap">10,000+ photos generated</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md bg-humble-orange/10 flex items-center justify-center flex-shrink-0">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 2a5 5 0 110 10A5 5 0 018 3zm-.5 2v3.5l2.5 1.5.5-.87-2-1.2V5h-1z" fill="#E8613A"/></svg>
                  </div>
                  <span className="text-[13px] text-humble-text font-medium whitespace-nowrap">Results in 60s</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md bg-humble-orange/10 flex items-center justify-center flex-shrink-0">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 12V4.5L8 2l6 2.5V12l-6 2.5L2 12zm2-1.2l4 1.7 4-1.7V5.7L8 4 4 5.7v5.1z" fill="#E8613A"/><path d="M6 7.5l1.5 1.5L11 5.5l-1-1-2.5 2.5L6.5 6 6 7.5z" fill="#E8613A"/></svg>
                  </div>
                  <span className="text-[13px] text-humble-text font-medium whitespace-nowrap">90% cheaper</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md bg-humble-orange/10 flex items-center justify-center flex-shrink-0">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM7.25 5a.75.75 0 011.5 0v3.19l2.03 1.22a.75.75 0 01-.78 1.28l-2.25-1.35A.75.75 0 017.25 8.6V5z" fill="#E8613A"/></svg>
                  </div>
                  <span className="text-[13px] text-humble-text font-medium whitespace-nowrap">No credit card required</span>
                </div>
              </div>
              {/* Mobile: 2x2 grid */}
              <div className="grid grid-cols-2 gap-3 mt-6 md:hidden px-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md bg-humble-orange/10 flex items-center justify-center flex-shrink-0">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 1l1.5 3.5L13 5l-2.5 2.5.5 3.5L8 9.5 4.5 11l.5-3.5L2.5 5l3.5-.5L8 1z" fill="#E8613A"/></svg>
                  </div>
                  <span className="text-xs text-humble-text font-medium">10,000+ photos</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md bg-humble-orange/10 flex items-center justify-center flex-shrink-0">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 2a5 5 0 110 10A5 5 0 018 3zm-.5 2v3.5l2.5 1.5.5-.87-2-1.2V5h-1z" fill="#E8613A"/></svg>
                  </div>
                  <span className="text-xs text-humble-text font-medium">Results in 60s</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md bg-humble-orange/10 flex items-center justify-center flex-shrink-0">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 12V4.5L8 2l6 2.5V12l-6 2.5L2 12zm2-1.2l4 1.7 4-1.7V5.7L8 4 4 5.7v5.1z" fill="#E8613A"/><path d="M6 7.5l1.5 1.5L11 5.5l-1-1-2.5 2.5L6.5 6 6 7.5z" fill="#E8613A"/></svg>
                  </div>
                  <span className="text-xs text-humble-text font-medium">90% cheaper</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md bg-humble-orange/10 flex items-center justify-center flex-shrink-0">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM7.25 5a.75.75 0 011.5 0v3.19l2.03 1.22a.75.75 0 01-.78 1.28l-2.25-1.35A.75.75 0 017.25 8.6V5z" fill="#E8613A"/></svg>
                  </div>
                  <span className="text-xs text-humble-text font-medium">No credit card</span>
                </div>
              </div>

              {/* Social proof — avatars + stars */}
              <div className="inline-flex items-center gap-3 mt-6 px-5 py-2.5 rounded-full bg-white border border-humble-border/60 shadow-sm">
                <div className="flex -space-x-2">
                  <div className="w-7 h-7 rounded-full bg-[#F4C7A3] border-2 border-white flex items-center justify-center text-xs">👩🏽</div>
                  <div className="w-7 h-7 rounded-full bg-[#D4A574] border-2 border-white flex items-center justify-center text-xs">👨🏾</div>
                  <div className="w-7 h-7 rounded-full bg-[#FFD7B5] border-2 border-white flex items-center justify-center text-xs">👩🏼</div>
                  <div className="w-7 h-7 rounded-full bg-[#C4956A] border-2 border-white flex items-center justify-center text-xs">👨🏿</div>
                </div>
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} width="14" height="14" viewBox="0 0 20 20" fill="#F59E0B">
                      <path d="M10 1.12L12.47 6.73L18.56 7.6L14.14 11.67L15.18 17.88L10 14.97L4.82 17.88L5.86 11.67L1.44 7.6L7.53 6.73L10 1.12Z"/>
                    </svg>
                  ))}
                </div>
                <span className="text-sm text-humble-text font-medium">
                  Approved by <span className="font-semibold">500+</span> businesses
                </span>
              </div>
            </motion.div>

            {/* Hero — Studio Mockup with cycling images */}
            <HeroMockup appleTransition={appleTransition} />
          </div>
        </section>

        <hr className="max-w-3xl mx-auto border-t border-[#E2E2DE]" />
        {/* ===== How it Works — 3 Visual Steps ===== */}
        <section id="how-it-works" className="py-28">
          <div className="max-w-7xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={appleTransition}
              className="text-center max-w-2xl mx-auto mb-16"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-humble-border bg-humble-orange/5 mb-5">
                <span className="text-sm font-medium text-humble-orange">How it Works</span>
              </div>
              <h2 className="text-3xl md:text-[44px] font-bold tracking-tighter text-humble-text mb-5 leading-[1.1]">
                Three clicks.<br />Studio quality.
              </h2>
              <p className="text-humble-gray text-lg font-light tracking-tight">
                No studio, no lights, no skills required. Just your smartphone.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {HOW_IT_WORKS_STEPS.map((step, i) => (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ ...appleTransition, delay: i * 0.12 }}
                  className="bg-white rounded-[2rem] overflow-hidden border border-humble-border shadow-humble-sm group"
                >
                  <div className="relative aspect-square overflow-hidden bg-[#F5F4F0]">
                    <img
                      src={step.image}
                      alt={`Step ${step.step}: ${step.title} — ${step.description}`}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700"
                    />
                    {/* Step badge */}
                    <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-md text-xs font-bold uppercase tracking-wider text-humble-text shadow-sm border border-white/60">
                      Step {step.step}
                    </div>
                  </div>
                  <div className="p-7">
                    <h3 className="text-xl font-bold tracking-tight text-humble-text mb-2">{step.title}</h3>
                    <p className="text-humble-gray text-[15px] leading-relaxed font-light">{step.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <hr className="max-w-3xl mx-auto border-t border-[#E2E2DE]" />
        {/* ===== Proven Results — Alternating Feature Rows ===== */}
        <section id="features" className="py-28 overflow-hidden">
          <div className="max-w-7xl mx-auto px-6">
            {/* Section header */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={appleTransition}
              className="text-center max-w-2xl mx-auto mb-24"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-humble-border bg-humble-orange/5 mb-5">
                <span className="text-sm font-medium text-humble-orange">Why sellers switch</span>
              </div>
              <h2 className="text-3xl md:text-[44px] font-bold tracking-tighter text-humble-text mb-5 leading-[1.1]">
                Your photos are<br />costing you sales.
              </h2>
              <p className="text-humble-gray text-lg font-light tracking-tight max-w-lg mx-auto">
                Every blurry product shot is a lost click, a lost customer, a lost sale. Fix it in 60 seconds.
              </p>
            </motion.div>

            {/* Alternating feature rows */}
            <div className="flex flex-col gap-32">
              {METRICS.map((metric, i) => {
                const isReversed = i % 2 !== 0;
                return (
                  <MetricRow key={metric.title} metric={metric} index={i} isReversed={isReversed} appleTransition={appleTransition} />
                );
              })}
            </div>

            {/* Final CTA */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ ...appleTransition, delay: 0.1 }}
              className="text-center mt-32"
            >
              <p className="text-humble-gray text-lg font-light mb-6 tracking-tight">
                Ready to turn your phone into a photo studio?
              </p>
              <button
                onClick={onLogin}
                className="humble-btn-primary inline-flex items-center gap-2.5 text-lg px-10 py-4 rounded-2xl shadow-humble-md hover:shadow-humble-lg transition-all duration-300 hover:scale-[1.03]"
              >
                Try it free — upload your first photo
                <ArrowRight size={20} />
              </button>
              <p className="text-humble-gray/60 text-sm mt-4 font-light">No credit card required. Results in 60 seconds.</p>
            </motion.div>
          </div>
        </section>

        {/* ===== Showcase Gallery with Tabs ===== */}
        <ShowcaseGallery appleTransition={appleTransition} />

        <hr className="max-w-3xl mx-auto border-t border-[#E2E2DE]" />
        {/* ===== Comparison Table ===== */}
        <section className="py-28">
          <div className="max-w-5xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={appleTransition}
              className="text-center max-w-2xl mx-auto mb-16"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-humble-border bg-humble-orange/5 mb-5">
                <span className="text-sm font-medium text-humble-orange">Compare</span>
              </div>
              <h2 className="text-3xl md:text-[44px] font-bold tracking-tighter text-humble-text mb-5 leading-[1.1]">
                From 25€ to 0.20€<br />per photo.
              </h2>
              <p className="text-humble-gray text-lg font-light tracking-tight">
                The only AI that delivers marketplace-compliant white backgrounds with realistic shadows. No Photoshop needed.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ ...appleTransition, delay: 0.15 }}
              className="relative"
            >
              <div className="bg-white rounded-[2rem] border border-humble-border shadow-humble-md mt-20 border-t-0">
                <div className="overflow-x-auto" style={{ overflow: 'clip visible' }}>
                  <table className="w-full text-left">
                    <thead>
                      <tr>
                        <th className="w-1/4"></th>
                        <th className="text-center p-0 relative bg-humble-orange">
                          <div className="bg-humble-orange rounded-t-2xl py-6 px-4 -mt-20 flex flex-col items-center justify-end">
                            <Camera size={32} className="text-white mb-2" />
                            <span className="text-white font-bold text-sm">FrameFlow</span>
                          </div>
                        </th>
                        <th className="py-4 px-6 text-sm font-semibold text-humble-gray text-center align-bottom">Traditional Studio</th>
                        <th className="py-4 px-6 text-sm font-semibold text-humble-gray text-center align-bottom">Generic AI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {COMPARISON_ROWS.map((row, i) => (
                        <tr key={i} className={i < COMPARISON_ROWS.length - 1 ? 'border-b border-humble-border/50' : ''}>
                          <td className="py-5 px-6 text-sm font-medium text-humble-text w-1/4">{row.label}</td>
                          <td className="py-5 px-6 text-sm font-bold text-white text-center bg-humble-orange">{row.photoStudio}</td>
                          <td className="py-5 px-6 text-sm text-humble-gray text-center">{row.studio}</td>
                          <td className="py-5 px-6 text-sm text-humble-gray text-center">{row.genericAi}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ ...appleTransition, delay: 0.3 }}
              className="text-center mt-10"
            >
              <button onClick={onLogin} className="humble-btn-primary py-3.5 px-8 text-sm">
                Start Free Trial <ArrowRight size={16} />
              </button>
            </motion.div>
          </div>
        </section>

        <hr className="max-w-3xl mx-auto border-t border-[#E2E2DE]" />
        {/* ===== Pricing Section ===== */}
        <section id="pricing" className="py-32">
          <div className="max-w-7xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={appleTransition}
              className="text-center max-w-2xl mx-auto mb-20"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-humble-border bg-humble-orange/5 mb-5">
                <span className="text-sm font-medium text-humble-orange">Pricing</span>
              </div>
              <h2 className="text-3xl md:text-[44px] font-bold tracking-tighter text-humble-text mb-5 leading-[1.1]">
                Choose your Plan
              </h2>
              <p className="text-humble-gray text-xl font-light tracking-tight">
                Per seller account · Cancel anytime
              </p>
            </motion.div>

            <div className="bg-[#F0F0F0] p-4 md:p-6 rounded-[3rem] mx-auto max-w-6xl">
              <div className="grid md:grid-cols-3 gap-4 items-stretch">
                <PricingCard
                  name="Starter"
                  desc="Perfect for small projects."
                  oldPrice="19.90"
                  price="9.90"
                  photos={35}
                  spots={10}
                  features={[
                    'AI Background Removal',
                    'Realistic Shadows',
                    'Lifestyle Generation',
                    '2K Resolution Export',
                  ]}
                  ctaText="Get Started →"
                  onCta={onLogin}
                  delay={0.1}
                  transition={appleTransition}
                />
                <PricingCard
                  name="Pro"
                  desc="For growing brands."
                  oldPrice="39.90"
                  price="19.90"
                  photos={90}
                  spots={5}
                  features={[
                    'Everything in Starter',
                    '4K Resolution Export',
                    'Batch Processing',
                    'Priority Support',
                    'Commercial License',
                  ]}
                  ctaText="Start Free Trial →"
                  onCta={onLogin}
                  delay={0.2}
                  transition={appleTransition}
                />
                <PricingCard
                  name="Business"
                  desc="For high-volume needs."
                  oldPrice="79.90"
                  price="39.90"
                  photos={210}
                  spots={5}
                  features={[
                    'Everything in Pro',
                    'Custom Branding',
                    'API Access',
                    'Dedicated Account Manager',
                    'Custom AI Models',
                  ]}
                  ctaText="Contact Sales →"
                  onCta={onLogin}
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

        <hr className="max-w-3xl mx-auto border-t border-[#E2E2DE]" />
        {/* ===== Testimonials Section ===== */}
        <section className="py-28">
          <div className="max-w-5xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={appleTransition}
              className="text-center max-w-2xl mx-auto mb-16"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-humble-border bg-humble-orange/5 mb-5">
                <span className="text-sm font-medium text-humble-orange">Testimonials</span>
              </div>
              <h2 className="text-3xl md:text-[44px] font-bold tracking-tighter text-humble-text mb-5 leading-[1.1]">
                Loved by sellers<br />worldwide.
              </h2>
              <p className="text-humble-gray text-lg font-light tracking-tight">
                Join 500+ Amazon &amp; Shopify sellers generating studio-quality photos every day.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {TESTIMONIALS.map((t, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ ...appleTransition, delay: i * 0.1 }}
                  className="bg-white rounded-[1.5rem] border border-humble-border p-7 shadow-humble-sm hover:shadow-humble-md transition-shadow duration-500"
                >
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, s) => (
                      <svg key={s} className="w-4 h-4 text-humble-orange" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-humble-text text-[15px] leading-relaxed mb-5 font-light">"{t.quote}"</p>
                  <div>
                    <p className="text-sm font-semibold text-humble-text">{t.name} <span className="font-normal text-humble-gray">· {t.role}</span></p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <hr className="max-w-3xl mx-auto border-t border-[#E2E2DE]" />
        {/* ===== FAQ Section ===== */}
        <section className="py-28">
          <div className="max-w-5xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={appleTransition}
              className="text-center mb-14"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-humble-border bg-humble-orange/5 mb-5">
                <span className="text-sm font-medium text-humble-orange">Got Questions</span>
              </div>
              <h2 className="text-3xl md:text-[44px] font-bold tracking-tighter text-humble-text mb-5 leading-[1.1]">
                FAQ
              </h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={appleTransition}
              className="bg-[#0A0A0A] rounded-[2rem] p-2.5 space-y-2 shadow-humble-lg"
            >
              {FAQ_ITEMS.map((faq, i) => (
                <FaqAccordion key={i} question={faq.question} answer={faq.answer} index={i} appleTransition={appleTransition} />
              ))}
            </motion.div>
          </div>
        </section>

        {/* ===== CTA Section ===== */}
        <section className="py-32 bg-humble-text text-white relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-humble-orange/20 rounded-full blur-[120px] -z-10" />
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={appleTransition}
            className="max-w-4xl mx-auto px-6 text-center"
          >
            <h2 className="text-3xl md:text-[44px] font-bold tracking-tighter text-white mb-5 leading-[1.1]">
              Ready to upgrade your visuals?
            </h2>
            <p className="text-xl text-gray-400 mb-10 font-light tracking-tight">
              Join 500+ sellers creating studio-quality photos without the studio.
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

      {/* ===== Contact Section ===== */}
      <section id="contact" className="py-20 bg-white border-t border-humble-border">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={appleTransition}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-humble-border bg-humble-orange/5 mb-5">
              <span className="text-sm font-medium text-humble-orange">Get in touch</span>
            </div>
            <h2 className="text-3xl md:text-[44px] font-bold tracking-tighter text-humble-text mb-5 leading-[1.1]">
              Questions?<br />We&apos;re here to help.
            </h2>
            <p className="text-humble-gray text-lg font-light tracking-tight mb-8 max-w-md mx-auto">
              Whether you need help getting started, want a demo, or have a specific request — reach out anytime.
            </p>
            <a
              href="mailto:contact@frameflow.design"
              className="humble-btn-primary py-3 px-8 text-base inline-flex items-center gap-2"
            >
              <MessageSquarePlus size={18} />
              contact@frameflow.design
            </a>
          </motion.div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="bg-white py-16 border-t border-humble-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-12">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-humble-text flex items-center justify-center text-white">
                <Camera size={20} />
              </div>
              <span className="font-display font-bold text-2xl text-humble-text">FrameFlow</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-16 gap-y-8">
              <div>
                <h4 className="text-sm font-bold text-humble-text uppercase tracking-wider mb-4">Product</h4>
                <div className="flex flex-col gap-3">
                  <a href="#features" className="text-sm text-humble-gray hover:text-humble-text transition-colors">Features</a>
                  <a href="#pricing" className="text-sm text-humble-gray hover:text-humble-text transition-colors">Pricing</a>
                  <a href="#how-it-works" className="text-sm text-humble-gray hover:text-humble-text transition-colors">How it Works</a>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-bold text-humble-text uppercase tracking-wider mb-4">Contact</h4>
                <div className="flex flex-col gap-3">
                  <a href="mailto:contact@frameflow.design" className="text-sm text-humble-gray hover:text-humble-text transition-colors">contact@frameflow.design</a>
                  <a href="#contact" className="text-sm text-humble-gray hover:text-humble-text transition-colors">Get in touch</a>
                  <div className="flex items-center gap-3 mt-2">
                    <a href="https://x.com/frameflow_ai" target="_blank" rel="noopener noreferrer" aria-label="Follow FrameFlow on X (Twitter)" className="text-humble-gray hover:text-humble-text transition-colors">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    </a>
                    <a href="https://www.instagram.com/frameflow.design" target="_blank" rel="noopener noreferrer" aria-label="Follow FrameFlow on Instagram" className="text-humble-gray hover:text-humble-text transition-colors">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5"/></svg>
                    </a>
                    <a href="https://www.linkedin.com/company/frameflow" target="_blank" rel="noopener noreferrer" aria-label="Follow FrameFlow on LinkedIn" className="text-humble-gray hover:text-humble-text transition-colors">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                    </a>
                  </div>
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
              &copy; {new Date().getFullYear()} FrameFlow. All rights reserved.
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

/* ─── Data Constants ─── */

const HOW_IT_WORKS_STEPS = [
  {
    step: 1,
    title: 'Upload your photo',
    description: 'One phone photo is all you need. No studio, no lighting, no photographer — FrameFlow handles everything.',
    image: '/inputImage-step.webp',
    badge: 'Smartphone',
    badgeIcon: <Smartphone size={12} />,
  },
  {
    step: 2,
    title: 'Instant studio quality',
    description: 'In seconds, your phone photo becomes a professional white-background image with perfect lighting and realistic shadows.',
    image: '/step2.webp',
    badge: 'AI Processing',
    badgeIcon: <Sparkles size={12} />,
  },
  {
    step: 3,
    title: 'Infinite lifestyles',
    description: 'Type a scene — kitchen counter, bedside table, gym bag — and get magazine-quality lifestyle images in seconds.',
    image: '/step3.webp',
    badge: 'AI Prompt',
    badgeIcon: <Zap size={12} />,
  },
];

const METRICS = [
  {
    stat: '+56%',
    statEnd: 56,
    statPrefix: '+',
    statSuffix: '%',
    title: 'More Sales',
    subtitle: 'Bad photos kill your listing. Great ones print money.',
    description: 'Amazon shoppers decide in 0.3 seconds. Blurry phone pics lose the click — and the sale. Sellers who switch to studio-grade visuals see an average 56% jump in sell-through rate.',
    image: '/lifestyle-0.webp',
    badgeText: 'Revenue Impact',
  },
  {
    stat: '0.20€',
    statEnd: 0.20,
    statPrefix: '',
    statSuffix: '€',
    statDecimals: 2,
    title: 'Per Photo',
    subtitle: 'Kill your 500€ studio bill. Keep the quality.',
    description: 'A single product shoot costs 25–50€ per image. Multiply that by your catalog and you\'re burning thousands. Get the same result from your phone for 100x less.',
    image: '/shadowComposite.webp',
    badgeText: 'Cost Killer',
  },
  {
    stat: '60s',
    statEnd: 60,
    statPrefix: '',
    statSuffix: 's',
    title: 'To Go Live',
    subtitle: 'Launch products while your competitors wait for their photographer.',
    description: 'From phone snap to Amazon-ready listing in under a minute. No booking, no back-and-forth, no editing. Shoot → Upload → Sell. That\'s it.',
    image: '/edit-0.webp',
    badgeText: 'Speed to Market',
  },
  {
    stat: '4K',
    statEnd: 4,
    statPrefix: '',
    statSuffix: 'K',
    title: 'Studio Resolution',
    subtitle: 'Zoom-proof quality with accurate text and logos.',
    description: 'Pure white backgrounds, realistic shadows, pin-sharp details at 4K. Unlike other AI tools, your product text and logos stay crisp and readable — no distortion, no artifacts. Passes Amazon, Shopify, and eBay compliance on the first try.',
    image: '/edit-1.webp',
    badgeText: 'Pro Quality',
  },
];

const SHOWCASE_TABS = ['Main Image', 'Lifestyle', 'All Results'] as const;

const SHOWCASE_IMAGES = [
  { url: '/cat-tree-lifestyle.webp', category: 'Lifestyle' as const },
  { url: '/portfolio-lifestyle.webp', category: 'Lifestyle' as const },
  { url: '/cosmetic-lifestyle.webp', category: 'Lifestyle' as const },
  { url: '/cosmetic-lifestyle-2.webp', category: 'Lifestyle' as const },
  { url: '/razorback-lifestyle.webp', category: 'Lifestyle' as const },
  { url: '/cosmetic-lifestyle-3.webp', category: 'Lifestyle' as const },
  { url: '/cosmetic-detail.webp', category: 'Lifestyle' as const, fit: 'object-top scale-[1.65] origin-top group-hover:!scale-[1.73]' as const },
  { url: '/studio-render.webp', category: 'Main Image' as const },
  { url: '/bottle-studio.webp', category: 'Main Image' as const },
  { url: '/wurth-studio.webp', category: 'Main Image' as const },
];

const COMPARISON_ROWS = [
  { label: 'Cost per Photo', studio: '25€ – 50€', genericAi: '0.05€ – 1€', photoStudio: '0.20€' },
  { label: 'Speed', studio: '1–3 days', genericAi: 'Minutes', photoStudio: '30 seconds' },
  { label: 'White Background', studio: 'Yes', genericAi: 'Approximate', photoStudio: 'Pure white' },
  { label: 'Realistic Shadows', studio: 'Yes', genericAi: 'No', photoStudio: 'Yes' },
  { label: 'Marketplace Compliant', studio: 'Yes', genericAi: 'No', photoStudio: 'Yes' },
  { label: 'Lifestyle Scenes', studio: 'No', genericAi: 'Random', photoStudio: 'Controlled' },
  { label: 'Batch Processing', studio: 'No', genericAi: 'No', photoStudio: 'Yes' },
  { label: 'Output Quality', studio: 'Studio-grade', genericAi: 'Unpredictable', photoStudio: 'Studio-grade AI' },
];

const FAQ_ITEMS = [
  {
    question: 'Is this just another background remover?',
    answer: 'No. FrameFlow goes far beyond background removal. We automatically add realistic drop shadows, adjust lighting, and generate AI lifestyle scenes — everything you need for marketplace-ready product photos in one tool.',
  },
  {
    question: 'Will the results pass Amazon / Shopify image requirements?',
    answer: 'Yes. Our output is optimized for major marketplace standards including Amazon (pure white background, proper dimensions) and Shopify. Images are exported at up to 4K resolution.',
  },
  {
    question: 'How many photos can I process?',
    answer: 'It depends on your plan. Starter gives you 35 photos/month, Pro gives you 90, and Business gives you 210 — all at 2K resolution (Amazon & Shopify ready). Want 4K? It counts as 1.5 photo credits. Need more? Contact us for custom volume.',
  },
  {
    question: 'What if I\'m not happy with the results?',
    answer: 'You can regenerate any image with different settings at no extra cost. Our AI learns from your preferences to deliver better results over time. Plus, you get a 14-day free trial to test everything.',
  },
  {
    question: 'Can I use my own lifestyle scenes or just the AI ones?',
    answer: 'Both. You can use our AI-generated scenes or upload your own custom backgrounds. The editor gives you full control over placement, shadows, and lighting for each scene.',
  },
];

/* ─── Sub-components ─── */

type AppleTransition = { duration: number; ease: readonly [number, number, number, number] };

/** Single metric row with animated counter */
function MetricRow({ metric, index: _i, isReversed, appleTransition }: {
  metric: typeof METRICS[number];
  index: number;
  isReversed: boolean;
  appleTransition: AppleTransition;
}) {
  const { ref, value } = useCountUp(
    metric.statEnd,
    1800,
    (metric as { statDecimals?: number }).statDecimals ?? 0,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ ...appleTransition, delay: 0.05 }}
      className={`grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center ${isReversed ? 'md:[direction:rtl]' : ''}`}
    >
      {/* Text column */}
      <div className={`flex flex-col justify-center ${isReversed ? 'md:[direction:ltr]' : ''}`}>
        {/* Orange label */}
        <span className="text-sm font-semibold text-humble-orange tracking-wider uppercase mb-5">{metric.badgeText}</span>
        {/* Animated Stat + Title */}
        <div className="flex items-baseline gap-3 mb-3">
          <span ref={ref} className="text-4xl md:text-[48px] font-bold tracking-tight text-humble-text leading-none tabular-nums">
            {metric.statPrefix}{(metric as { statDecimals?: number }).statDecimals ? value.toFixed((metric as { statDecimals?: number }).statDecimals) : value}{metric.statSuffix}
          </span>
          <span className="text-xl md:text-2xl font-bold tracking-tight text-humble-gray/50 leading-none">
            {metric.title}
          </span>
        </div>
        {/* Subtitle — punchy one-liner */}
        <h4 className="text-base md:text-lg font-semibold text-humble-text mb-3 leading-snug">{metric.subtitle}</h4>
        {/* Description */}
        <p className="text-humble-gray text-[15px] leading-relaxed font-light max-w-md">{metric.description}</p>
      </div>

      {/* Image column */}
      <div className={`${isReversed ? 'md:[direction:ltr]' : ''}`}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ ...appleTransition, delay: 0.15 }}
          className="rounded-[2rem] overflow-hidden border border-humble-border shadow-humble-sm group"
        >
          <img
            src={metric.image}
            alt={`${metric.title} — FrameFlow AI product photography`}
            loading="lazy"
            style={{ width: '100%', height: 'auto', display: 'block', aspectRatio: '1/1', objectFit: 'cover', objectPosition: 'center' }}
            className="group-hover:scale-[1.03] transition-transform duration-700"
          />
        </motion.div>
      </div>
    </motion.div>
  );
}

function FaqAccordion({ question, answer, index: _index, appleTransition: _at }: { question: string; answer: string; index: number; appleTransition: { duration: number; ease: readonly [number, number, number, number] } }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        style={{ borderRadius: '22px' }}
        className="w-full flex items-center justify-between gap-4 py-5 px-6 bg-[#1A1A1A] hover:bg-[#222222] transition-colors text-left"
      >
        <span className="text-[15px] md:text-base font-semibold text-white">{question}</span>
        <span className={`shrink-0 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center transition-transform duration-300 ${open ? 'rotate-45' : ''}`}>
          <Plus size={16} className="text-white/50" />
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="px-6 pt-3 pb-5 text-base text-gray-300 leading-relaxed font-light">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ShowcaseGallery({ appleTransition }: { appleTransition: { duration: number; ease: readonly [number, number, number, number] } }) {
  const [activeTab, setActiveTab] = useState<typeof SHOWCASE_TABS[number]>('All Results');

  const filtered = activeTab === 'All Results'
    ? SHOWCASE_IMAGES
    : SHOWCASE_IMAGES.filter(img => img.category === activeTab);

  return (
    <>
    <hr className="max-w-3xl mx-auto border-t border-[#E2E2DE]" />
    <section className="py-28">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={appleTransition}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12"
        >
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-humble-border bg-humble-orange/5 mb-5">
              <span className="text-sm font-medium text-humble-orange">Gallery</span>
            </div>
            <h2 className="text-3xl md:text-[44px] font-bold tracking-tighter text-humble-text mb-5 leading-[1.1]">
              Crafted for every catalog.<br />
            <span className="text-humble-gray">See the results.</span>
          </h2>
          </div>
          <div className="flex gap-2">
            {SHOWCASE_TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${
                  activeTab === tab
                    ? 'bg-humble-text text-white shadow-humble-sm'
                    : 'bg-white text-humble-gray border border-humble-border hover:border-humble-text hover:text-humble-text'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((img, i) => (
              <motion.div
                key={`${img.url}-${i}`}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="aspect-square rounded-[1.5rem] overflow-hidden bg-white border border-humble-border shadow-humble-sm group cursor-pointer"
              >
                <img
                  src={img.url}
                  alt={`AI product photography - ${img.category.toLowerCase()} - FrameFlow`}
                  loading="lazy"
                  className={`w-full h-full group-hover:scale-[1.05] transition-transform duration-700 ${(img as any).fit?.includes('object-contain') ? '' : 'object-cover'} ${(img as any).fit ?? ''}`}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <p className="text-center text-sm text-humble-gray/70 mt-8 font-light">
          All images above were generated from smartphone photos using FrameFlow.
          <strong className="text-humble-gray"> No editing. No studio. No Photoshop.</strong>
        </p>
      </div>
    </section>
    </>
  );
}


interface PricingCardProps {
  name: string;
  desc: string;
  oldPrice: string;
  price: string;
  photos: number;
  spots: number;
  features: string[];
  ctaText: string;
  onCta: () => void;
  delay: number;
  transition: { duration: number; ease: readonly [number, number, number, number] };
}

function PricingCard({
  name,
  desc,
  oldPrice,
  price,
  photos,
  spots,
  features,
  ctaText,
  onCta,
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
        <span className="text-lg font-semibold tracking-tight text-gray-400 line-through decoration-1">
          &euro;{oldPrice}
        </span>
        <span className="text-4xl font-bold tracking-tighter text-gray-900">&euro;{price}</span>
      </div>
      <div className="mb-2">
        <span className="text-2xl font-bold text-gray-900">{photos}</span>
        <span className="text-sm text-gray-500 font-medium ml-1">photos / month</span>
      </div>
      <p className="text-xs text-gray-400 mb-2 font-medium">2K · Amazon &amp; Shopify ready</p>
      <p className="text-sm text-humble-orange font-medium mb-8">
        Join as founding customer ({spots} spots).
      </p>
      <button onClick={onCta} className="bg-black text-white rounded-full py-4 px-6 font-bold shadow-lg w-full mb-8 hover:bg-gray-900 transition-colors">
        {ctaText}
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


const DEMO_SLIDES = [
  { label: 'ORIGINAL',  url: '/inputImage.webp', scene: false },
  { label: 'FINAL',     url: '/autoCrop.webp', scene: false },
  { label: 'EDIT',      url: '/edit-0.webp',      scene: true },
  { label: 'EDIT 2',    url: '/edit-2.webp',      scene: true },
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
              <span className="font-semibold text-[15px] tracking-tight" style={{ color: '#1D1D1F' }}>FrameFlow</span>
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
                    alt={`FrameFlow ${slide.label} — AI product photo editing`}
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
                      <img src={slide.url} alt={`${slide.label} thumbnail`} />
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
