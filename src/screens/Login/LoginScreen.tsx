import './LoginScreen.css';
import { signInWithGoogle } from '../../services/db/supabase';
import { useState } from 'react';
import { Camera, ArrowLeft } from 'lucide-react';

const DEV_BYPASS = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true';

interface LoginScreenProps {
  onDevLogin?: () => void;
  onBack?: () => void;
}

function LoginScreen({ onDevLogin, onBack }: LoginScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <Camera size={28} color="white" />
          </div>
        </div>

        <h1 className="login-title">FrameFlow</h1>
        <p className="login-subtitle">
          The AI product photography tool built for<br />Amazon &amp; Shopify sellers.
        </p>

        {/* Auth card */}
        <div className="login-auth-card">
          <button
            className="login-google-btn"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            {loading ? (
              <span className="login-spinner" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
            )}
            {loading ? 'Connecting...' : 'Sign in with Google'}
          </button>

          {DEV_BYPASS && onDevLogin && (
            <button className="login-dev-btn" onClick={onDevLogin}>
              Dev Mode
            </button>
          )}

          {error && <p className="login-error">{error}</p>}
        </div>

        {/* Trust proofs */}
        <div className="login-trust">
          <p className="login-trust-headline">10,000+ photos generated</p>
          <div className="login-trust-badges">
            <div className="login-trust-badge">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 12V4.5L8 2l6 2.5V12l-6 2.5L2 12zm2-1.2l4 1.7 4-1.7V5.7L8 4 4 5.7v5.1z" fill="#E8613A"/><path d="M6 7.5l1.5 1.5L11 5.5l-1-1-2.5 2.5L6.5 6 6 7.5z" fill="#E8613A"/></svg>
              <span>High-end Images</span>
            </div>
            <div className="login-trust-badge">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1l1.5 3.5L13 5l-2.5 2.5.5 3.5L8 9.5 4.5 11l.5-3.5L2.5 5l3.5-.5L8 1z" fill="#E8613A"/></svg>
              <span>90% cheaper</span>
            </div>
            <div className="login-trust-badge">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 2a5 5 0 110 10A5 5 0 018 3zm-.5 2v3.5l2.5 1.5.5-.87-2-1.2V5h-1z" fill="#E8613A"/></svg>
              <span>Results in 60s</span>
            </div>
          </div>
        </div>

        {/* Back to home */}
        {onBack && (
          <button className="login-back" onClick={onBack}>
            <ArrowLeft size={14} />
            Back to Home
          </button>
        )}
      </div>
    </div>
  );
}

export default LoginScreen;
