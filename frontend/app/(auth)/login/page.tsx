"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loginUser } from "../../(protected)/dashboard/modules/accounts/services";
import { saveToken } from "../../utils/auth";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Shield,
  Users,
  BookOpen,
  BarChart3,
  Eye,
  EyeOff,
  CheckCircle,
  Smartphone,
  Tablet,
  Monitor,
  Lock,
  Mail,
  UserPlus,
} from "lucide-react";

// Brand Colors
const colors = {
  primary: "#1E3A8A",
  secondary: "#10B981",
  accent: "#38BDF8",
  background: "#F8FAFC",
  textPrimary: "#0F172A",
  textMuted: "#64748B",
  danger: "#EF4444",
  warning: "#F59E0B",
};

export default function Welcome() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  // Particles state
  const [particles, setParticles] = useState<{ left: number; top: number }[]>([]);

  const features = [
    { icon: <Users className="w-5 h-5" />, text: "Student & Staff Management", color: colors.primary, bgColor: "rgba(30, 58, 138, 0.1)" },
    { icon: <BookOpen className="w-5 h-5" />, text: "Academic Management", color: colors.secondary, bgColor: "rgba(16, 185, 129, 0.1)" },
    { icon: <Shield className="w-5 h-5" />, text: "Secure Role-Based Access", color: colors.warning, bgColor: "rgba(245, 158, 11, 0.1)" },
    { icon: <BarChart3 className="w-5 h-5" />, text: "Real-time Analytics", color: colors.accent, bgColor: "rgba(56, 189, 248, 0.1)" },
  ];

  // Detect screen size
  useEffect(() => {
    const checkScreen = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
    };
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  // Generate particles on client only
  useEffect(() => {
    if (isMobile) return;
    const count = isTablet ? 10 : 15;
    const arr = Array.from({ length: count }, () => ({
      left: Math.random() * 100,
      top: Math.random() * 100,
    }));
    setParticles(arr);
  }, [isTablet, isMobile]);

  // Authentication handler
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (activeTab === "signup") {
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        setLoading(false);
        return;
      }
      setTimeout(() => {
        setLoading(false);
        router.push("/dashboard");
      }, 1500);
    } else {
      try {
        const data = await loginUser(email, password);
        saveToken(data.access);
        localStorage.setItem("refreshToken", data.refresh);
        router.push("/dashboard");
      } catch {
        setError("Invalid email or password");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: colors.background }}>
      {/* Particles */}
      {!isMobile && particles.length > 0 && (
        <div className="absolute inset-0 overflow-hidden">
          {particles.map((p, i) => (
            <div
              key={i}
              className="particle absolute w-1 h-1 rounded-full"
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
                backgroundColor: `${colors.primary}33`,
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Main layout */}
      <div className="relative min-h-screen flex flex-col lg:flex-row">
        {/* Hero section */}
        <div className={`flex-1 ${isMobile ? 'px-4 py-8' : 'px-12 py-8 lg:py-0'} flex flex-col justify-center`}>
          <motion.div
            initial={{ opacity: 0, x: isMobile ? 0 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className={isMobile ? 'text-center' : ''}
          >
            {/* Logo */}
            <div className="flex items-center gap-3 mb-6">
              <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.accent})` }}>
                <BookOpen className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold" style={{ color: colors.primary }}>
                  School<span style={{ color: colors.textPrimary }}>ERP</span>
                </h1>
                <p className="text-sm" style={{ color: colors.textMuted }}>Next Generation Education Platform</p>
              </div>
            </div>

            {/* Heading */}
            <h2 className={`font-bold ${isMobile ? 'text-2xl mb-3' : 'text-3xl md:text-4xl mb-4'}`} style={{ color: colors.textPrimary }}>
              {isMobile ? "Transform Your School's Operations" : "Transform Your School's Digital Experience"}
            </h2>
            <p className={`${isMobile ? 'text-base mb-6' : 'text-lg mb-8 max-w-xl'}`} style={{ color: colors.textMuted }}>
              A comprehensive platform that streamlines academic operations, enhances collaboration, and provides actionable insights for educational institutions.
            </p>

            {/* Features */}
            <div className={`grid ${isMobile ? 'grid-cols-1 gap-3' : 'grid-cols-2 gap-4'} mb-8`}>
              {features.map((f, idx) => (
                <motion.div
                  key={f.text}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + idx * 0.1 }}
                  className="flex items-center gap-3 p-3 rounded-xl border shadow-sm hover:shadow-md transition-shadow"
                  style={{ backgroundColor: 'white', borderColor: `${colors.primary}20` }}
                >
                  <div className="p-2 rounded-lg flex-shrink-0" style={{ backgroundColor: f.bgColor }}>
                    <div style={{ color: f.color }}>{f.icon}</div>
                  </div>
                  <span className="font-medium" style={{ color: colors.textPrimary }}>{f.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Auth card */}
        <div className={`flex-1 flex items-center justify-center ${isMobile ? 'px-4 pb-8' : 'px-8 py-8'}`}>
          <motion.div initial={{ opacity: 0, scale: isMobile ? 1 : 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className={`w-full ${isMobile ? 'max-w-md' : 'max-w-lg'}`}>
            <div className="rounded-2xl shadow-xl border overflow-hidden" style={{ backgroundColor: 'white', borderColor: `${colors.primary}20` }}>
              <div className="h-2" style={{ background: `linear-gradient(to right, ${colors.primary}, ${colors.accent})` }} />
              <div className="p-6 lg:p-8">
                {/* Tabs */}
                <div className="flex mb-6 lg:mb-8 relative">
                  <button
                    onClick={() => setActiveTab("login")}
                    className={`flex-1 text-center py-3 font-semibold`}
                    style={{ color: activeTab === "login" ? colors.primary : colors.textMuted }}
                  >
                    <Lock className="w-4 h-4 inline mr-1" /> Sign In
                  </button>
                  <button
                    onClick={() => setActiveTab("signup")}
                    className={`flex-1 text-center py-3 font-semibold`}
                    style={{ color: activeTab === "signup" ? colors.primary : colors.textMuted }}
                  >
                    <UserPlus className="w-4 h-4 inline mr-1" /> Sign Up
                  </button>
                  {!isMobile && (
                    <motion.div
                      animate={{ x: activeTab === "login" ? "0%" : "100%" }}
                      transition={{ type: "spring", damping: 20 }}
                      className="absolute bottom-0 w-1/2 h-1 rounded-full"
                      style={{ backgroundColor: colors.primary }}
                    />
                  )}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {error && (
                      <div className="mb-4 p-3 rounded-xl text-sm flex items-center gap-2" style={{ backgroundColor: `${colors.danger}10`, border: `1px solid ${colors.danger}30`, color: colors.danger }}>
                        <Shield className="w-4 h-4" /> {error}
                      </div>
                    )}

                    <form onSubmit={handleAuth} className="space-y-4 lg:space-y-5">
                      {activeTab === "signup" && (
                        <div>
                          <label className="block text-sm font-medium mb-2">Full Name</label>
                          <input
                            type="text"
                            placeholder="John Doe"
                            className="w-full p-3 lg:p-4 border rounded-xl"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium mb-2">Email Address</label>
                        <div className="relative">
                          <input
                            type="email"
                            placeholder="you@school.edu"
                            className="w-full p-3 lg:p-4 border rounded-xl pl-10"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                          />
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2" size={18} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Password</label>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            className="w-full p-3 lg:p-4 border rounded-xl pr-12"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                          />
                          <button type="button" className="absolute right-3 top-1/2 transform -translate-y-1/2" onClick={() => setShowPassword(!showPassword)}>
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                          </button>
                        </div>
                      </div>
                      {activeTab === "signup" && (
                        <div>
                          <label className="block text-sm font-medium mb-2">Confirm Password</label>
                          <input
                            type="password"
                            placeholder="Confirm your password"
                            className="w-full p-3 lg:p-4 border rounded-xl"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                          />
                        </div>
                      )}

                      <motion.button
                        type="submit"
                        disabled={loading}
                        className="w-full text-white py-3 lg:py-4 rounded-xl font-semibold text-lg hover:shadow-lg transition-all flex items-center justify-center gap-2"
                        style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.accent})` }}
                      >
                        {loading ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            {activeTab === "login" ? "Sign In" : "Create Account"}
                            <ArrowRight className="w-5 h-5" />
                          </>
                        )}
                      </motion.button>
                    </form>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
