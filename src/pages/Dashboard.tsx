import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Plus, LogOut, Send, Sparkles, GraduationCap } from "lucide-react";

type Subject = { id: string; name: string; icon: string | null };
type Module = { title: string; summary: string; exercises: string[] };
type LessonPlan = {
  id: string;
  subject_id: string;
  title: string;
  level: string | null;
  goals: string | null;
  modules: Module[];
};
type Message = { id: string; role: string; content: string; created_at: string };

const Dashboard = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activePlan, setActivePlan] = useState<LessonPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");

  const [newOpen, setNewOpen] = useState(false);
  const [subjName, setSubjName] = useState("");
  const [subjLevel, setSubjLevel] = useState("");
  const [subjGoals, setSubjGoals] = useState("");
  const [creating, setCreating] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    void loadSubjects();
  }, [user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamBuffer]);

  const loadSubjects = async () => {
    const { data, error } = await supabase
      .from("subjects")
      .select("id, name, icon")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Could not load subjects", description: error.message, variant: "destructive" });
      return;
    }
    setSubjects(data || []);
    if (data && data.length && !activePlan) {
      void loadLatestPlan(data[0].id);
    }
  };

  const loadLatestPlan = async (subjectId: string) => {
    setPlanLoading(true);
    const { data } = await supabase
      .from("lesson_plans")
      .select("*")
      .eq("subject_id", subjectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setPlanLoading(false);
    if (data) {
      setActivePlan(data as unknown as LessonPlan);
      void loadMessages(data.id);
    } else {
      setActivePlan(null);
      setMessages([]);
    }
  };

  const loadMessages = async (planId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("lesson_plan_id", planId)
      .order("created_at", { ascending: true });
    setMessages((data || []) as Message[]);
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !subjName.trim()) return;
    setCreating(true);
    try {
      const { data: subj, error: sErr } = await supabase
        .from("subjects")
        .insert({ user_id: user.id, name: subjName.trim() })
        .select()
        .single();
      if (sErr) throw sErr;

      const { data: fnData, error: fnErr } = await supabase.functions.invoke("generate-lesson-plan", {
        body: { subject: subjName.trim(), level: subjLevel, goals: subjGoals, subject_id: subj.id },
      });
      if (fnErr) throw fnErr;
      if (fnData?.error) throw new Error(fnData.error);

      toast({ title: "Lesson plan ready!", description: fnData.lesson_plan?.title });
      setNewOpen(false);
      setSubjName("");
      setSubjLevel("");
      setSubjGoals("");
      await loadSubjects();
      if (fnData.lesson_plan) {
        setActivePlan(fnData.lesson_plan as unknown as LessonPlan);
        setMessages([]);
      }
    } catch (err: any) {
      toast({ title: "Could not create lesson", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlan || !chatInput.trim() || streaming) return;
    const text = chatInput.trim();
    setChatInput("");
    setMessages((p) => [...p, { id: `tmp-${Date.now()}`, role: "user", content: text, created_at: new Date().toISOString() }]);
    setStreaming(true);
    setStreamBuffer("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tutor-chat`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ lesson_plan_id: activePlan.id, message: text }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) toast({ title: "Slow down", description: "AI rate limit hit. Try again shortly.", variant: "destructive" });
        else if (resp.status === 402) toast({ title: "Out of credits", description: "Add AI credits in Settings → Workspace → Usage.", variant: "destructive" });
        else toast({ title: "Chat error", description: `HTTP ${resp.status}`, variant: "destructive" });
        setStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              acc += delta;
              setStreamBuffer(acc);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
      setMessages((p) => [...p, { id: `a-${Date.now()}`, role: "assistant", content: acc, created_at: new Date().toISOString() }]);
      setStreamBuffer("");
    } catch (err: any) {
      toast({ title: "Chat failed", description: err.message, variant: "destructive" });
    } finally {
      setStreaming(false);
    }
  };

  const focusChat = searchParams.get("focus") === "chat";

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Sparkles className="h-6 w-6 animate-pulse text-primary" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          <h1 className="font-semibold text-foreground">AI Teacher Classroom</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="gap-2">
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </header>

      <div className="grid h-[calc(100vh-3.5rem)] grid-cols-1 md:grid-cols-[260px_1fr_360px]">
        {/* Subjects sidebar */}
        <aside className="border-r border-border bg-secondary/40 p-4">
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild>
              <Button className="mb-4 w-full gap-2">
                <Plus className="h-4 w-4" /> New subject
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a subject</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateSubject} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sn">Subject</Label>
                  <Input id="sn" required value={subjName} onChange={(e) => setSubjName(e.target.value)} placeholder="e.g. Linear algebra" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sl">Level</Label>
                  <Input id="sl" value={subjLevel} onChange={(e) => setSubjLevel(e.target.value)} placeholder="beginner / intermediate / advanced" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sg">Goals</Label>
                  <Textarea id="sg" value={subjGoals} onChange={(e) => setSubjGoals(e.target.value)} placeholder="What do you want to learn?" />
                </div>
                <Button type="submit" className="w-full" disabled={creating}>
                  {creating ? "Building lesson plan..." : "Generate lesson plan"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subjects</h2>
          <div className="space-y-1">
            {subjects.length === 0 && (
              <p className="px-2 text-sm text-muted-foreground">No subjects yet. Create one to begin.</p>
            )}
            {subjects.map((s) => (
              <button
                key={s.id}
                onClick={() => loadLatestPlan(s.id)}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                  activePlan?.subject_id === s.id ? "bg-accent text-accent-foreground" : "text-foreground"
                }`}
              >
                <BookOpen className="h-4 w-4" /> {s.name}
              </button>
            ))}
          </div>
        </aside>

        {/* Lesson plan */}
        <section className="overflow-y-auto p-6">
          {planLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : activePlan ? (
            <div className="mx-auto max-w-2xl space-y-6">
              <div>
                <p className="text-sm text-muted-foreground">{activePlan.level || "Lesson plan"}</p>
                <h2 className="text-3xl font-bold text-foreground">{activePlan.title}</h2>
                {activePlan.goals && <p className="mt-2 text-muted-foreground">{activePlan.goals}</p>}
              </div>
              <div className="space-y-3">
                {activePlan.modules.map((m, i) => (
                  <Card key={i} className="p-4">
                    <h3 className="font-semibold text-foreground">
                      {i + 1}. {m.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">{m.summary}</p>
                    {m.exercises?.length > 0 && (
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-foreground">
                        {m.exercises.map((ex, j) => <li key={j}>{ex}</li>)}
                      </ul>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Sparkles className="mx-auto h-10 w-10 text-primary" />
                <p className="mt-3 text-foreground">Create your first subject to begin learning.</p>
              </div>
            </div>
          )}
        </section>

        {/* Chat */}
        <aside className={`flex flex-col border-l border-border bg-card ${focusChat ? "ring-2 ring-primary" : ""}`}>
          <div className="border-b border-border px-4 py-3">
            <h3 className="font-semibold text-foreground">Chat with your teacher</h3>
            <p className="text-xs text-muted-foreground">{activePlan ? activePlan.title : "Pick or create a lesson"}</p>
          </div>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              {messages.length === 0 && !streaming && (
                <p className="text-sm text-muted-foreground">Ask anything about the lesson to get started.</p>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    m.role === "user" ? "ml-6 bg-primary text-primary-foreground" : "mr-6 bg-muted text-foreground"
                  }`}
                >
                  {m.content}
                </div>
              ))}
              {streaming && streamBuffer && (
                <div className="mr-6 rounded-lg bg-muted px-3 py-2 text-sm text-foreground">{streamBuffer}</div>
              )}
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>
          <form onSubmit={handleSend} className="flex gap-2 border-t border-border p-3">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={activePlan ? "Ask the teacher..." : "Create a lesson first"}
              disabled={!activePlan || streaming}
            />
            <Button type="submit" size="icon" disabled={!activePlan || streaming || !chatInput.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </aside>
      </div>
    </main>
  );
};

export default Dashboard;
