"use client";

import { useState, useRef, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Confetti } from "@/components/ui/confetti";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const router = useRouter();
  const confettiRef = useRef(null);

  const handleSendCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.isLocal) {
            setSuccessMsg("Local mode active. Check your server terminal/console for the OTP code.");
        } else {
            setSuccessMsg(`We sent a verification code to ${email}`);
        }
        setStep(2);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to send code");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        code,
      });

      if (res?.error) {
        setError("Invalid code or code expired");
        setLoading(false);
      } else {
        setIsVerified(true);
        setSuccessMsg("Verification successful! Redirecting...");
        confettiRef.current?.fire({
            spread: 90,
            startVelocity: 60,
            particleCount: 150,
            origin: { y: 0.8 },
            colors: ['#10b981', '#34d399', '#059669', '#ffffff']
        });
        
        setTimeout(() => {
            router.push("/dashboard");
        }, 1800);
      }
    } catch (err) {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-grid-page p-4 text-grid-title selection:bg-emerald-500/30 selection:text-emerald-500 relative">
      <Confetti ref={confettiRef} manualstart className="absolute inset-0 z-50 pointer-events-none w-full h-full" />
      
      <div className="w-full max-w-md space-y-8 rounded-3xl border border-grid-border/60 bg-grid-surface/40 p-8 sm:p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden transition-all duration-500 hover:border-grid-border">
        
        {/* Decorative Grid and Gradients inside the card */}
        <div className="absolute inset-0 pointer-events-none opacity-20">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-[60px]"></div>
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-[60px]"></div>
        </div>

        <div className="relative z-10 flex flex-col items-center text-center">
          <div className={cn(
              "mb-6 flex size-16 items-center justify-center rounded-2xl border shadow-lg transition-colors duration-500",
              isVerified ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : "border-grid-border bg-grid-page text-emerald-500"
          )}>
            {isVerified ? (
              <CheckCircle2 className="size-8" />
            ) : (
              <ShieldCheck className="size-8" />
            )}
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-grid-title sm:text-4xl">
            {step === 1 ? "SentinelIQ" : "Identity Check"}
          </h2>
          <p className="mt-3 text-sm text-grid-muted font-medium">
            {step === 1 
              ? "Access the intelligence dashboard" 
              : "Enter the secure code sent to your email"}
          </p>
        </div>

        <div className="relative z-10">
            {error && (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-medium text-red-400 flex items-center justify-center text-center animate-in fade-in slide-in-from-top-2 duration-300">
                {error}
            </div>
            )}
            
            {successMsg && (
            <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-400 flex items-center justify-center text-center animate-in fade-in slide-in-from-top-2 duration-300">
                {successMsg}
            </div>
            )}

            {step === 1 ? (
            <form className="mt-8 space-y-6" onSubmit={handleSendCode}>
                <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-semibold text-grid-muted">
                    Operator Email
                </label>
                <div className="mt-1 group relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-grid-muted/50 group-focus-within:text-emerald-500 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                    </div>
                    <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full appearance-none rounded-xl border border-grid-border/80 bg-grid-page/80 pl-11 pr-4 py-4 text-grid-title placeholder-grid-muted/40 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium"
                    placeholder="operator@sentineliq.com"
                    />
                </div>
                </div>

                <div>
                <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl py-6 text-base font-semibold shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-70 disabled:hover:bg-emerald-500 flex items-center justify-center"
                >
                    {loading ? (
                    <Loader2 className="mr-2 size-5 animate-spin" />
                    ) : (
                    <>
                        Continue <ArrowRight className="ml-2 size-5" />
                    </>
                    )}
                </Button>
                </div>
            </form>
            ) : (
            <form className="mt-8 space-y-6" onSubmit={handleVerifyCode}>
                <div className="space-y-2">
                <label htmlFor="code" className="block text-sm font-semibold text-grid-muted text-center">
                    6-Digit Access Code
                </label>
                <div className="mt-2">
                    <input
                    id="code"
                    name="code"
                    type="text"
                    maxLength="6"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    disabled={isVerified}
                    className="block w-full appearance-none rounded-2xl border-2 border-grid-border/80 bg-grid-page/80 px-4 py-5 text-center text-4xl tracking-[0.5em] font-bold font-mono text-emerald-500 placeholder-grid-muted/20 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 transition-all disabled:opacity-50"
                    placeholder="000000"
                    autoFocus
                    />
                </div>
                </div>

                <div>
                <Button
                    type="submit"
                    disabled={loading || code.length !== 6 || isVerified}
                    className={cn(
                        "w-full rounded-xl py-6 text-base font-semibold shadow-lg transition-all flex items-center justify-center",
                        isVerified 
                            ? "bg-emerald-500 text-white shadow-emerald-500/20" 
                            : "bg-white text-black hover:bg-gray-100 disabled:opacity-50"
                    )}
                >
                    {loading ? (
                    <Loader2 className="mr-2 size-5 animate-spin text-current" />
                    ) : isVerified ? (
                    <CheckCircle2 className="mr-2 size-5" />
                    ) : (
                    "Verify Identity"
                    )}
                </Button>
                </div>

                {!isVerified && (
                    <div className="text-center mt-6">
                        <button
                            type="button"
                            onClick={() => {
                            setStep(1);
                            setCode("");
                            setError("");
                            setSuccessMsg("");
                            }}
                            className="text-sm font-medium text-grid-muted hover:text-emerald-500 transition-colors underline-offset-4 hover:underline"
                        >
                            Use a different email
                        </button>
                    </div>
                )}
            </form>
            )}
        </div>
      </div>
    </div>
  );
}