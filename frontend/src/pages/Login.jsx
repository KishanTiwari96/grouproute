import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navigation, Lock, Mail, ArrowRight, Sparkles } from 'lucide-react';
import useAuthStore from '../store/authStore.js';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const { login, isLoading, error } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setLocalError(err.message || 'Login failed.');
    }
  };

  const handleDemoLogin = async (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setLocalError('');
    try {
      await login(demoEmail, demoPass);
      navigate('/dashboard');
    } catch (err) {
      try {
        // If demo user doesn't exist, create it automatically
        const name = demoEmail.split('@')[0];
        const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
        const { register } = useAuthStore.getState();
        await register(capitalized, demoEmail, demoPass);
        navigate('/dashboard');
      } catch (regErr) {
        setLocalError('Demo login failed: Incorrect password for existing account or registration failed.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#f8f9fa]">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-full bg-[#e8f0fe] items-center justify-center border border-[#d2e3fc] shadow-xs mb-3">
            <Navigation className="w-6 h-6 text-[#1a73e8] transform -rotate-45" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#202124] tracking-tight">
            Group<span className="text-[#1a73e8]">Route</span>
          </h1>
          <p className="text-xs text-[#5f6368] mt-1">Real-Time Group Travel & Convoy Intelligence</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-md border border-[#dadce0]">
          <h2 className="text-lg font-bold text-[#202124] mb-5">Welcome Back</h2>

          {(localError || error) && (
            <div className="mb-5 p-3 rounded-2xl bg-[#fce8e6] border border-[#fad2cf] text-[#c5221f] text-xs font-bold">
              {localError || error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#3c4043] mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#80868b] absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="rahul@example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-[#dadce0] text-[#202124] placeholder-[#80868b] text-sm focus:outline-none focus:border-[#1a73e8] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#3c4043] mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#80868b] absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-[#dadce0] text-[#202124] placeholder-[#80868b] text-sm focus:outline-none focus:border-[#1a73e8] transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-full bg-[#1a73e8] hover:bg-[#1557d0] text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              <span>{isLoading ? 'Signing In...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* 1-Click Demo Accounts */}
          <div className="mt-6 pt-5 border-t border-[#f1f3f4]">
            <div className="flex items-center gap-1.5 mb-3 text-xs font-bold text-[#5f6368]">
              <Sparkles className="w-3.5 h-3.5 text-[#f9ab00]" />
              <span>Quick Demo 1-Click Login</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDemoLogin('rahul@example.com', 'password123')}
                className="p-2.5 rounded-2xl bg-[#f8f9fa] hover:bg-[#f1f3f4] border border-[#dadce0] text-xs text-left transition-colors"
              >
                <p className="font-bold text-[#202124]">Rahul (Owner)</p>
                <p className="text-[10px] text-[#5f6368]">rahul@example.com</p>
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('aman@example.com', 'password123')}
                className="p-2.5 rounded-2xl bg-[#f8f9fa] hover:bg-[#f1f3f4] border border-[#dadce0] text-xs text-left transition-colors"
              >
                <p className="font-bold text-[#202124]">Aman (Member)</p>
                <p className="text-[10px] text-[#5f6368]">aman@example.com</p>
              </button>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-[#5f6368]">
            Don't have an account?{' '}
            <Link to="/register" className="text-[#1a73e8] font-bold hover:underline">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
