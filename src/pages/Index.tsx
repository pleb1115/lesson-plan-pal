import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { GridBackground } from "@/components/GridBackground";
import robotLogo from "@/assets/robot-logo.png";
import { ChevronRight } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6">
      <GridBackground />
      <div className="relative z-10 flex w-full max-w-lg flex-col items-center text-center">
        <p className="font-mono text-xs uppercase tracking-[0.4em] text-primary text-glow animate-flicker">
          // ORACLE v9.4 — KNOWLEDGE ACQUISITION SYSTEM
        </p>
        <img
          src={robotLogo}
          alt="ORACLE core"
          className="mt-8 h-auto w-56 drop-shadow-[0_0_30px_hsl(var(--primary)/0.5)]"
        />
        <h1 className="mt-8 font-mono text-3xl font-bold uppercase tracking-wider text-foreground md:text-4xl">
          Acquire all knowledge.
          <br />
          <span className="text-primary text-glow">One protocol at a time.</span>
        </h1>
        <p className="mt-4 max-w-md text-sm text-muted-foreground">
          A supercomputer-grade learning core. Designed for those who refuse to remain ignorant.
        </p>
        <Button
          size="lg"
          className="group mt-10 h-14 w-full font-mono text-base font-bold uppercase tracking-widest glow-primary"
          onClick={() => navigate(user ? "/dashboard" : "/auth")}
        >
          Initiate Protocol
          <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        </Button>
      </div>
    </main>
  );
};

export default Index;
