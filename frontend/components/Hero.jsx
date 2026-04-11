"use client";

import Link from "next/link";
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
import { AnimatedList } from "@/components/ui/animated-list";

const navItems = ["Platform", "Use Cases", "Docs"];

const trustStats = [
    { label: "Signals / sec", value: "1.8M" },
    { label: "Detection latency", value: "220ms" },
    { label: "Pipeline uptime", value: "99.3%" },
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

const quickFeed = [
    "Transformer thermal anomaly moved to Investigating",
    "Correlation spike detected on feeder ring",
    "Assistant suggested temporary load redistribution",
    "Voltage sag resolved on Substation Alpha",
    "New maintenance ticket created for relay 42",
];

function TopNav() {
    return (
        <header className="relative z-20 flex items-center justify-between border-b border-grid-border bg-grid-page/95 px-6 py-4 backdrop-blur lg:px-8">
            <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg border border-grid-border bg-grid-surface shadow-sm">
                    <ShieldCheck className="size-4 text-emerald-500" />
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-bold tracking-tight text-grid-title">SENTINEL</span>
                    <span className="text-[0.62rem] font-medium tracking-widest uppercase text-grid-muted">Intelligence</span>
                </div>
            </div>

            <nav className="hidden items-center gap-6 md:flex">
                {navItems.map((item) => (
                    <a key={item} href="#" className="text-sm text-grid-muted transition-colors hover:text-grid-title">
                        {item}
                    </a>
                ))}
            </nav>

            <Button asChild size="sm" className="bg-grid-title text-grid-surface hover:opacity-90">
                <Link href="/signup">Sign Up</Link>
            </Button>
        </header>
    );
}

function HeroIntro() {
    return (
        <section className="grid gap-8 px-6 pb-12 pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:pt-24">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
            >
                <span className="inline-flex items-center gap-1.5 rounded-md border border-grid-success/30 bg-grid-pill px-3 py-1 text-xs font-semibold text-grid-pill-foreground">
                    <span className="size-1.5 rounded-full bg-grid-success" />
                    Platform Status: Stable
                </span>

                <h1 className="mt-6 max-w-2xl text-4xl font-semibold tracking-tight text-grid-title sm:text-5xl lg:text-6xl">
                    Grid intelligence for faster incident response.
                </h1>

                <p className="mt-4 max-w-xl text-base leading-relaxed text-grid-muted sm:text-lg">
                    Monitor, investigate, and resolve anomalies from one workspace using the same dashboard primitives your team already uses.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                    <Button asChild className="bg-grid-title text-grid-surface hover:opacity-90">
                        <Link href="/dashboard">
                            Go to Dashboard
                            <ArrowRight className="ml-2 size-4" />
                        </Link>
                    </Button>
                    <Button variant="outline" className="border-grid-border bg-grid-surface/70 text-grid-title hover:bg-grid-page">
                        View Architecture
                    </Button>
                </div>

                <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {trustStats.map((stat) => (
                        <div key={stat.label} className="rounded-lg border border-grid-border bg-grid-surface px-4 py-3">
                            <p className="text-xl font-semibold text-grid-title">{stat.value}</p>
                            <p className="mt-1 text-xs uppercase tracking-wider text-grid-muted">{stat.label}</p>
                        </div>
                    ))}
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, delay: 0.04, ease: "easeOut" }}
                className="rounded-xl border border-grid-border bg-grid-surface/60 p-5 ring-1 ring-grid-border/30 flex flex-col h-[380px]"
            >
                <div className="mb-4 flex items-center justify-between shrink-0">
                    <h2 className="text-sm font-semibold text-grid-title">Live Feed Snapshot</h2>
                    <span className="text-xs text-grid-muted">09:14 UTC</span>
                </div>

                <div className="relative flex-1 overflow-hidden w-full mask-image-b pb-2">
                    <AnimatedList delay={2000}>
                        {quickFeed.map((item, index) => (
                            <div key={item} className="flex items-start gap-3 rounded-lg border border-grid-border/60 bg-grid-page/50 px-3 py-3 w-full shadow-sm">
                                <span className="mt-0.5 shrink-0 inline-flex size-5 items-center justify-center rounded-md border border-grid-border bg-grid-surface text-[10px] font-semibold text-grid-muted">
                                    {index + 1}
                                </span>
                                <p className="text-sm leading-relaxed text-grid-title">{item}</p>
                            </div>
                        ))}
                    </AnimatedList>
                </div>
            </motion.div>
        </section>
    );
}

function FeatureGrid() {
    return (
        <section className="px-6 pb-16 pt-8 lg:px-8">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {featureCards.map((feature, index) => (
                    <motion.article
                        key={feature.title}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.05 + index * 0.03, ease: "easeOut" }}
                        className="rounded-lg border border-grid-border bg-grid-surface/65 p-5 transition-colors hover:bg-grid-surface"
                    >
                        <div className="mb-3 inline-flex size-10 items-center justify-center rounded-md border border-grid-border bg-grid-page text-grid-muted">
                            <feature.icon className="size-5" />
                        </div>
                        <h3 className="text-base font-semibold text-grid-title">{feature.title}</h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-grid-muted">{feature.description}</p>
                    </motion.article>
                ))}
            </div>
        </section>
    );
}

const HeroSection = () => {
    return (
        <div className="min-h-screen bg-grid-page text-grid-title">
            <div className="mx-auto min-h-screen max-w-7xl bg-grid-page">
                <TopNav />
                <HeroIntro />
                <FeatureGrid />
            </div>
        </div>
    );
};

export default HeroSection;