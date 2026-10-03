"use client";

import { useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  FileText,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

type AuthMode = "login" | "signup";

export default function Home() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);

  const isLogin = mode === "login";

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setShowPassword(false);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLogin) {
      console.log("Login submitted");
    } else {
      console.log("Signup submitted");
    }
  };

  return (
    <main className="min-h-screen bg-[#EEF0FF] p-4 md:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl overflow-hidden rounded-3xl bg-white shadow-[0_20px_60px_rgba(20,20,43,0.12)] md:min-h-[calc(100vh-4rem)]">

        {/* =====================================================
            LEFT BRANDING PANEL
        ====================================================== */}
        <section className="relative hidden w-1/2 overflow-hidden bg-[#EEF0FF] p-10 lg:flex lg:flex-col">

          {/* Decorative background shapes */}
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#4F46E5]/10" />

          <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-[#FBBF24]/15" />

          <div className="absolute right-20 top-1/2 h-20 w-20 rounded-full bg-[#10B981]/5" />

          {/* Logo */}
          <div className="relative z-10">
            <LumenLogo />
          </div>

          {/* Main product introduction */}
          <div className="relative z-10 mt-20 max-w-xl">

            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#4F46E5] shadow-sm">
              <Sparkles size={15} />
              AI-powered knowledge workspace
            </div>

            <h1 className="text-5xl font-bold leading-[1.08] tracking-tight text-[#14142B]">
              Your knowledge.
              <br />

              <span className="text-[#4F46E5]">
                Intelligently connected.
              </span>
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-8 text-[#14142B]/60">
              Lumen is a multi-tenant AI knowledge assistant that lets
              you chat with your documents, get answers with citations,
              and use AI agents to work with your knowledge.
            </p>
          </div>

          {/* Product features */}
          <div className="relative z-10 mt-12 space-y-5">

            <Feature
              icon={<FileText size={20} />}
              title="Chat with your knowledge"
              description="Ask questions across your documents using RAG."
            />

            <Feature
              icon={<ShieldCheck size={20} />}
              title="Answers with citations"
              description="Trace AI responses back to their source."
            />

            <Feature
              icon={<Sparkles size={20} />}
              title="AI agents with tools"
              description="Let agents retrieve information and take action."
            />

          </div>

          {/* Technology stack */}
          <div className="relative z-10 mt-auto pt-10">

            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#14142B]/40">
              Built with
            </p>

            <div className="flex flex-wrap gap-2">

              {["Next.js", "FastAPI", "RAG", "pgvector"].map((tech) => (
                <span
                  key={tech}
                  className="rounded-full border border-[#4F46E5]/10 bg-white px-3 py-1.5 text-xs font-medium text-[#14142B]/60"
                >
                  {tech}
                </span>
              ))}

            </div>

            <div className="mt-6 flex items-center gap-2">

              <span className="h-2 w-2 rounded-full bg-[#10B981]" />

              <span className="text-sm text-[#14142B]/40">
                Intelligent knowledge, one workspace.
              </span>

            </div>

          </div>
        </section>

        {/* =====================================================
            RIGHT AUTH PANEL
        ====================================================== */}
        <section className="flex w-full flex-col px-6 py-8 sm:px-10 md:px-16 lg:w-1/2 lg:px-20">

          {/* Top navigation */}
          <div className="flex justify-end">

            <p className="text-sm text-[#14142B]/50">

              {isLogin
                ? "New to Lumen?"
                : "Already have an account?"}

              <button
                type="button"
                onClick={() => switchMode(isLogin ? "signup" : "login")}
                className="ml-1 font-semibold text-[#4F46E5] transition hover:text-[#4338CA]"
              >
                {isLogin ? "Sign up" : "Log in"}
              </button>

            </p>

          </div>

          {/* Authentication container */}
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">

            {/* Mobile logo */}
            <div className="mb-10 lg:hidden">
              <LumenLogo />
            </div>

            {/* Heading */}
            <div className="mb-8">

              <h2 className="text-4xl font-bold tracking-tight text-[#14142B]">
                {isLogin
                  ? "Welcome back"
                  : "Create your account"}
              </h2>

              <p className="mt-3 text-[#14142B]/55">
                {isLogin
                  ? "Log in to continue to your Lumen workspace."
                  : "Start building your knowledge workspace with Lumen."}
              </p>

            </div>

            {/* Login / Signup tabs */}
            <div className="mb-8 border-b border-[#14142B]/10">

              <div className="flex">

                <AuthTab
                  active={isLogin}
                  onClick={() => switchMode("login")}
                >
                  Log in
                </AuthTab>

                <AuthTab
                  active={!isLogin}
                  onClick={() => switchMode("signup")}
                >
                  Sign up
                </AuthTab>

              </div>

            </div>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >

              {/* Full name - Signup only */}
              {!isLogin && (
                <div>

                  <label
                    htmlFor="name"
                    className="mb-2 block text-sm font-semibold text-[#14142B]"
                  >
                    Full name
                  </label>

                  <input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="Your name"
                    autoComplete="name"
                    className="h-13 w-full rounded-xl border border-[#14142B]/10 bg-white px-4 text-[#14142B] outline-none transition placeholder:text-[#14142B]/30 focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/10"
                  />

                </div>
              )}

              {/* Email */}
              <div>

                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold text-[#14142B]"
                >
                  Email address
                </label>

                <div className="relative">

                  <Mail
                    size={19}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[#14142B]/35"
                  />

                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    className="h-13 w-full rounded-xl border border-[#14142B]/10 bg-white pl-12 pr-4 text-[#14142B] outline-none transition placeholder:text-[#14142B]/30 focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/10"
                  />

                </div>

              </div>

              {/* Password */}
              <div>

                <div className="mb-2 flex items-center justify-between">

                  <label
                    htmlFor="password"
                    className="block text-sm font-semibold text-[#14142B]"
                  >
                    Password
                  </label>

                  {isLogin && (
                    <button
                      type="button"
                      className="text-sm font-medium text-[#4F46E5] transition hover:text-[#4338CA]"
                    >
                      Forgot password?
                    </button>
                  )}

                </div>

                <div className="relative">

                  <Lock
                    size={19}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[#14142B]/35"
                  />

                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete={
                      isLogin
                        ? "current-password"
                        : "new-password"
                    }
                    required
                    minLength={8}
                    className="h-13 w-full rounded-xl border border-[#14142B]/10 bg-white pl-12 pr-12 text-[#14142B] outline-none transition placeholder:text-[#14142B]/30 focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/10"
                  />

                  <button
                    type="button"
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    onClick={() =>
                      setShowPassword(!showPassword)
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#14142B]/35 transition hover:text-[#14142B]"
                  >
                    {showPassword ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>

                </div>

              </div>

              {/* Remember me */}
              {isLogin && (
                <div className="flex items-center gap-3">

                  <input
                    id="remember"
                    name="remember"
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 accent-[#4F46E5]"
                  />

                  <label
                    htmlFor="remember"
                    className="text-sm text-[#14142B]/60"
                  >
                    Remember me
                  </label>

                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                className="group flex h-13 w-full items-center justify-center gap-3 rounded-xl bg-[#4F46E5] font-semibold text-white shadow-lg shadow-[#4F46E5]/20 transition hover:bg-[#4338CA] hover:shadow-xl hover:shadow-[#4F46E5]/25"
              >

                {isLogin
                  ? "Log in"
                  : "Create account"}

                <ArrowRight
                  size={19}
                  className="transition-transform group-hover:translate-x-1"
                />

              </button>

            </form>

            {/* Divider */}
            <div className="my-7 flex items-center gap-4">

              <div className="h-px flex-1 bg-[#14142B]/10" />

              <span className="text-sm text-[#14142B]/35">
                or
              </span>

              <div className="h-px flex-1 bg-[#14142B]/10" />

            </div>

            {/* Social authentication */}
            <div className="grid grid-cols-2 gap-3">

              <SocialButton
                icon="G"
                text="Google"
                onClick={() =>
                  console.log("Google login")
                }
              />

              <SocialButton
                icon="GH"
                text="GitHub"
                onClick={() =>
                  console.log("GitHub login")
                }
              />

            </div>

            {/* Terms */}
            <p className="mt-8 text-center text-xs leading-5 text-[#14142B]/40">

              By continuing, you agree to our{" "}

              <button
                type="button"
                className="font-medium text-[#4F46E5] hover:text-[#4338CA]"
              >
                Terms of Service
              </button>

              {" "}and{" "}

              <button
                type="button"
                className="font-medium text-[#4F46E5] hover:text-[#4338CA]"
              >
                Privacy Policy
              </button>

              .

            </p>

          </div>
        </section>
      </div>
    </main>
  );
}


/* ============================================================
   LUMEN LOGO
============================================================ */

function LumenLogo() {
  return (
    <div className="flex items-center gap-3">

      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#4F46E5] text-white shadow-lg shadow-[#4F46E5]/25">

        <FileText
          size={23}
          strokeWidth={2}
        />

      </div>

      <span className="text-2xl font-bold tracking-tight text-[#14142B]">
        Lumen
      </span>

    </div>
  );
}


/* ============================================================
   AUTH TAB
============================================================ */

function AuthTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-1/2 pb-4 text-sm font-semibold transition ${
        active
          ? "text-[#4F46E5]"
          : "text-[#14142B]/40 hover:text-[#14142B]/70"
      }`}
    >
      {children}

      {active && (
        <span className="absolute bottom-0 left-0 h-0.5 w-full bg-[#4F46E5]" />
      )}
    </button>
  );
}


/* ============================================================
   FEATURE
============================================================ */

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-4">

      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#4F46E5] shadow-sm">
        {icon}
      </div>

      <div>

        <h3 className="font-semibold text-[#14142B]">
          {title}
        </h3>

        <p className="mt-1 text-sm text-[#14142B]/50">
          {description}
        </p>

      </div>

    </div>
  );
}


/* ============================================================
   SOCIAL BUTTON
============================================================ */

function SocialButton({
  icon,
  text,
  onClick,
}: {
  icon: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-12 items-center justify-center gap-3 rounded-xl border border-[#14142B]/10 bg-white text-sm font-medium text-[#14142B] transition hover:border-[#4F46E5]/30 hover:bg-[#EEF0FF]"
    >

      <span className="font-bold text-[#14142B]">
        {icon}
      </span>

      {text}

    </button>
  );
}