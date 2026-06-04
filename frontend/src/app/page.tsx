import Dashboard from "@/components/Dashboard";

export default function Home() {
  return (
    <main className="flex-1 w-full h-full min-h-screen relative flex flex-col bg-[#090d16]">
      {/* Dynamic layout for the earthquake cluster visualizer */}
      <Dashboard />
    </main>
  );
}
