import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { GridBackground } from "@/components/GridBackground";
import robotLogo from "@/assets/robot-logo.png";

const Auth = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
  }, [user, loading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast({ title: "Access denied", description: error.message, variant: "destructive" });
    else navigate("/dashboard", { replace: true });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setBusy(false);
    if (error) toast({ title: "Registration failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Operator registered", description: "Routing to command center." });
      navigate("/dashboard", { replace: true });
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <GridBackground />
      <div className="panel glow-primary relative z-10 w-full max-w-md p-8">
        <div className="mb-6 flex items-center gap-3">
          <img src={robotLogo} alt="ORACLE" className="h-9 w-9 object-contain drop-shadow-[0_0_10px_hsl(var(--primary)/0.6)]" />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary text-glow">ORACLE</p>
            <h1 className="font-mono text-lg font-bold uppercase tracking-wider text-foreground">Operator Access</h1>
          </div>
        </div>
        <Tabs defaultValue="signin">
          <TabsList className="grid w-full grid-cols-2 font-mono uppercase">
            <TabsTrigger value="signin">Authenticate</TabsTrigger>
            <TabsTrigger value="signup">Register</TabsTrigger>
          </TabsList>
          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="si-email" className="font-mono text-xs uppercase tracking-wider">Identity</Label>
                <Input id="si-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="si-pw" className="font-mono text-xs uppercase tracking-wider">Cipher</Label>
                <Input id="si-pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono" />
              </div>
              <Button type="submit" className="w-full font-mono uppercase tracking-wider glow-primary" disabled={busy}>
                {busy ? "Verifying..." : "Authenticate"}
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="su-email" className="font-mono text-xs uppercase tracking-wider">Identity</Label>
                <Input id="su-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-pw" className="font-mono text-xs uppercase tracking-wider">Cipher</Label>
                <Input id="su-pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono" />
              </div>
              <Button type="submit" className="w-full font-mono uppercase tracking-wider glow-primary" disabled={busy}>
                {busy ? "Provisioning..." : "Register Operator"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
};

export default Auth;
