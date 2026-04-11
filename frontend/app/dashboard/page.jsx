"use client";
import Dashboard from "../../components/dashboard.jsx";
import { Confetti } from "../../components/ui/confetti";
export default function DashboardPage() {
  return (
    <>
    <Confetti className="absolute inset-0 z-50 pointer-events-none w-full h-full" options={{ spread: 360, ticks: 60, gravity: 0.5, decay: 0.9 }} />
      <Dashboard />;
    </>
  );
}
