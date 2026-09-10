import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navigation, Lock, Mail, User, ArrowRight } from 'lucide-react';
import useAuthStore from '../store/authStore.js';

export function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const { register, isLoading, error } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    try {
      await register(name, email, password);
      navigate('/dashboard');
    } catch (err) {
      setLocalError(err.message || 'Registration failed.');
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

        {/* Register Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-md border border-[#dadce0]">
          <h2 className="text-lg font-bold text-[#202124] mb-5">Create Your Account</h2>

          {(localError || error) && (
            <div className="mb-5 p-3 rounded-2xl bg-[#fce8e6] border border-[#fad2cf] text-[#c5221f] text-xs font-bold">
              {localError || error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#3c4043] mb-1.5">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-[#80868b] absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Rahul Sharma"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-[#dadce0] text-[#202124] placeholder-[#80868b] text-sm focus:outline-none focus:border-[#1a73e8] transition-colors"
                />
              </div>
            </div>

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
                  minLength={6}
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
              <span>{isLoading ? 'Creating Account...' : 'Get Started'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-[#5f6368]">
            Already have an account?{' '}
            <Link to="/login" className="text-[#1a73e8] font-bold hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;
