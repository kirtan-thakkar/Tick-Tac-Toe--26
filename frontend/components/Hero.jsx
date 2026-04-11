"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
    Activity,
    ArrowRight,
    Bot,
    Building2,
    ShieldAlert,
    ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = ["Platform", "Use Cases", "Docs"];

const trustStats = [
    { label: "Signals / sec", value: "1.8M" },
    { label: "Detection latency", value: "220ms" },
    { label: "Pipeline uptime", value: "99.99%" },
];

const featureCards = [
    {
        title: "Live Monitoring",
        description: "Real-time multi-signal telemetry with fast drift visibility.",
        icon: Activity,
    },
    {
        title: "Anomalies",
        description: "Severity-first triage with context and investigation workflows.",
        icon: ShieldAlert,
    },
    {
        title: "Assets",
        description: "Unified asset health view across substations and feeders.",
        icon: Building2,
    },
    {
        title: "AI Assistant",
        description: "RAG-backed diagnosis and recommended mitigation actions.",
        icon: Bot,
    },
];

// Helper to generate initial chart data for the Hero graph
const generateInitialData = (pts = 40) => {
    return Array.from({ length: pts }).map((_, i) => ({
        time: i,
        freq: 50 + (Math.random() * 0.1 - 0.05),
        volt: 230 + (Math.random() * 2 - 1),
        therm: 45 + (Math.random() * 5 - 2.5),
    }));
};

function HeroGraph() {
    const [data, setData] = useState([]);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setData(generateInitialData());
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!isMounted) return;

        const interval = setInterval(() => {
            setData((prev) => {
                const last = prev[prev.length - 1];
                const next = {
                    time: last.time + 1,
                    freq: 50 + (Math.random() * 0.12 - 0.06),
                    volt: 230 + (Math.random() * 2.5 - 1.25),
                    therm: Math.max(30, Math.min(80, last.therm + (Math.random() * 2 - 1))),
                };
                return [...prev.slice(1), next];
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isMounted]);

    const renderPath = (key, color, scaleMin, scaleMax) => {
        if (data.length === 0) return null;
        const min = scaleMin;
        const max = scaleMax;
        const range = max - min;
        const path = data.map((d, i) => {
            const x = (i / (data.length - 1)) * 100;
            const y = 100 - ((d[key] - min) / range) * 100;
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(" ");

        return (
            <path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
                className="transition-all duration-300 ease-linear drop-shadow-sm"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        );
    };

    if (!isMounted) {
        return <div className="h-full w-full bg-grid-page/40 animate-pulse rounded-lg" />;
    }

    return (
        <div className="relative w-full h-full bg-grid-page/40 rounded-lg border border-grid-border/30 overflow-hidden flex flex-col">
            {/* Header Overlay */}
            <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-grid-surface/90 to-transparent">
                <div className="flex items-center gap-3">
                    <Activity className="size-4 text-emerald-500" />
                    <span className="text-sm font-semibold text-grid-title">Multisignal Telemetry</span>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-grid-page/80 px-2.5 py-1 ring-1 ring-inset ring-grid-border/50 backdrop-blur-sm shadow-sm">
                    <span className="relative flex size-1.5 items-center justify-center">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75"></span>
                        <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500"></span>
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500">Live</span>
                </div>
            </div>

            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between py-12 px-4 opacity-10 pointer-events-none z-0">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-full border-t border-grid-title/50 border-dashed" />
                ))}
            </div>

            {/* SVG Chart */}
            <svg className="absolute inset-0 w-full h-full z-10 pt-10" preserveAspectRatio="none" viewBox="0 0 100 100">
                {renderPath('freq', '#3b82f6', 49.8, 50.2)}
                {renderPath('volt', '#8b5cf6', 225, 235)}
                {renderPath('therm', '#ef4444', 20, 90)}
            </svg>

            {/* Scanning line effect */}
            <div className="absolute top-0 bottom-0 right-0 w-32 bg-gradient-to-r from-transparent to-grid-page/80 z-20 pointer-events-none" />

            {/* Legend Overlay at bottom */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-4 rounded-full bg-grid-surface/90 px-4 py-2 ring-1 ring-grid-border/50 backdrop-blur-md shadow-sm">
                <div className="flex items-center gap-2 text-[11px] font-medium text-grid-muted">
                    <span className="size-2 rounded-full bg-[#3b82f6]" /> Freq
                </div>
                <div className="flex items-center gap-2 text-[11px] font-medium text-grid-muted">
                    <span className="size-2 rounded-full bg-[#8b5cf6]" /> Volt
                </div>
                <div className="flex items-center gap-2 text-[11px] font-medium text-grid-muted">
                    <span className="size-2 rounded-full bg-[#ef4444]" /> Therm
                </div>
            </div>
        </div>
    );
}

function TopNav() {
    return (
        <header className="sticky top-0 z-50 flex items-center justify-between border-b border-grid-border/50 bg-grid-page/80 px-6 py-4 backdrop-blur-md lg:px-10">
            <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl border border-grid-border bg-grid-surface shadow-sm">
                    <ShieldCheck className="size-5 text-emerald-500" />
                </div>
                <div className="flex flex-col">
                    <span className="text-base font-bold tracking-tight text-grid-title">SENTINEL</span>
                    <span className="text-[0.65rem] font-bold tracking-widest uppercase text-grid-muted">Intelligence</span>
                </div>
            </div>

            <nav className="hidden items-center gap-8 md:flex">
                {navItems.map((item) => (
                    <a key={item} href="#" className="text-sm font-medium text-grid-muted transition-colors hover:text-grid-title">
                        {item}
                    </a>
                ))}
            </nav>

            <Button asChild size="sm" className="bg-grid-title text-grid-surface hover:opacity-90 rounded-lg px-5 shadow-sm">
                <Link href="/signup">Sign Up</Link>
            </Button>
        </header>
    );
}

function HeroIntro() {
    return (
        <section className="grid gap-12 px-6 pb-16 pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10 lg:px-10 lg:pt-24">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex flex-col items-start justify-center"
            >
                <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-500">
                    <span className="relative flex size-1.5 items-center justify-center">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75"></span>
                        <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500"></span>
                    </span>
                    Platform Status: All Systems Operational
                </span>

                <h1 className="mt-6 max-w-2xl text-4xl font-bold tracking-tight text-grid-title sm:text-5xl lg:text-6xl lg:leading-[1.15]">
                    Grid intelligence for faster incident response.
                </h1>

                <p className="mt-5 max-w-xl text-base leading-relaxed text-grid-muted sm:text-lg">
                    Monitor, investigate, and resolve anomalies from one workspace using the same dashboard primitives your team already relies on.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                    <Button asChild size="lg" className="bg-grid-title text-grid-surface hover:opacity-90 rounded-lg px-6 font-medium shadow-sm">
                        <Link href="/dashboard">
                            Go to Dashboard
                            <ArrowRight className="ml-2 size-4" />
                        </Link>
                    </Button>
                    <Button variant="outline" size="lg" className="border-grid-border bg-grid-surface/50 text-grid-title hover:bg-grid-surface rounded-lg px-6 font-medium shadow-sm">
                        View Architecture
                    </Button>
                </div>

                <div className="mt-12 grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
                    {trustStats.map((stat) => (
                        <div key={stat.label} className="flex flex-col rounded-xl border border-grid-border bg-grid-surface/40 p-4 shadow-sm transition-colors hover:bg-grid-surface">
                            <p className="text-2xl font-bold text-grid-title">{stat.value}</p>
                            <p className="mt-1 text-xs font-medium uppercase tracking-wider text-grid-muted">{stat.label}</p>
                        </div>
                    ))}
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
                className="relative flex flex-col overflow-hidden rounded-2xl border border-grid-border bg-grid-surface/30 shadow-lg lg:mt-0 h-[450px]"
            >
                <div className="p-2 w-full h-full bg-grid-surface/80 backdrop-blur-sm">
                   <HeroGraph />
                </div>
            </motion.div>
        </section>
    );
}

function FeatureGrid() {
    return (
        <section className="px-6 pb-20 lg:px-10">
            <div className="mb-8">
                <h2 className="text-2xl font-bold tracking-tight text-grid-title">Core Capabilities</h2>
                <p className="mt-2 text-sm text-grid-muted">Integrated tooling to observe, analyze, and remediate grid events.</p>
            </div>
            
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {featureCards.map((feature, index) => (
                    <motion.article
                        key={feature.title}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.1 + index * 0.05, ease: "easeOut" }}
                        className="group flex flex-col rounded-2xl border border-grid-border bg-grid-surface/40 p-6 transition-all hover:bg-grid-surface hover:shadow-md"
                    >
                        <div className="mb-5 inline-flex size-12 items-center justify-center rounded-xl border border-grid-border/50 bg-grid-page text-grid-title shadow-sm transition-transform group-hover:scale-105">
                            <feature.icon className="size-5" />
                        </div>
                        <h3 className="text-base font-semibold text-grid-title">{feature.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-grid-muted">{feature.description}</p>
                    </motion.article>
                ))}
            </div>
        </section>
    );
}

const HeroSection = () => {
    return (
        <div className="min-h-screen bg-grid-page text-grid-title selection:bg-grid-title selection:text-grid-surface">
            <div className="mx-auto min-h-screen max-w-7xl bg-grid-page">
                <TopNav />
                <HeroIntro />
                <FeatureGrid />
            </div>
        </div>
    );
};

export default HeroSection;