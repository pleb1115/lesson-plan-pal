import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStats } from "@/hooks/useStats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, BookOpen, Plus, LogOut, Send, Sparkles, Check, Lock, Play, Youtube, ExternalLink, Heart, Trophy } from "lucide-react";
import { StatsHeader } from "@/components/StatsHeader";
import { QuizScreen } from "@/components/QuizScreen";
import { Confetti } from "@/components/Confetti";
import { sfx } from "@/lib/sfx";

type Subject = { id: string; name: string; completed?: number; total?: number };
type Module = { title: string; summary: string; exercises: string[] };
type LessonPlan = {
  id: string;
  subject_id: string;
  title: string;
  level: string | null;
  goals: string | null;
  modules: Module[];
  completed_modules: number[];
};
type Message = { id: string; role: string; content: string; created_at: string };
type View = "subjects" | "lesson" | "module" | "chat" | "quiz" | "noHearts" | "moduleComplete";

const SUGGESTIONS = ["Explain this", "Give me an example", "Quiz me"];

const Dashboard = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { stats, loseHeart, awardXp } = useStats();

  const [view, setView] = useState<View>("subjects");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [activePlan, setActivePlan] = useState<LessonPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);
  const [confettiTick, setConfettiTick] = useState(0);
  const [lastReward, setLastReward] = useState<{ xp: number; correct: number; total: number } | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");

  const [newOpen, setNewOpen] = useState(false);
  const [newPrompt, setNewPrompt] = useState("");
  const [creating, setCreating] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  type Video = { id: string; title: string; channel: string; url: string };
  const [videos, setVideos] = useState<Video[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) void loadSubjects();
  }, [user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamBuffer]);

  const loadSubjects = async () => {
    setSubjectsLoading(true);
    const { data, error } = await supabase
      .from("subjects")
      .select("id, name")
      .order("created_at", { ascending: false });
    if (error) {
      setSubjectsLoading(false);
      toast({ title: "Could not load subjects", description: error.message, variant: "destructive" });
      return;
    }
    const subs = (data || []) as Subject[];
    // fetch progress per subject
    const ids = subs.map((s) => s.id);
    if (ids.length) {
      const { data: plans } = await supabase
        .from("lesson_plans")
        .select("subject_id, modules, completed_modules")
        .in("subject_id", ids);
      const map = new Map<string, { completed: number; total: number }>();
      (plans || []).forEach((p: any) => {
        const total = Array.isArray(p.modules) ? p.modules.length : 0;
        const completed = Array.isArray(p.completed_modules) ? p.completed_modules.length : 0;
        // keep highest progress per subject if multiple plans
        const prev = map.get(p.subject_id);
        if (!prev || completed > prev.completed) map.set(p.subject_id, { completed, total });
      });
      subs.forEach((s) => {
        const m = map.get(s.id);
        s.completed = m?.completed || 0;
        s.total = m?.total || 0;
      });
    }
    setSubjects(subs);
    setSubjectsLoading(false);
  };

  // Deterministic gradient + emoji based on subject name
  const subjectVisual = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    const hue1 = hash % 360;
    const hue2 = (hue1 + 40) % 360;
    const gradient = `linear-gradient(135deg, hsl(${hue1} 80% 60%), hsl(${hue2} 75% 50%))`;
    const lower = name.toLowerCase();
    const map: [RegExp, string][] = [
      [/math|algebra|calc|geometry|stat/, "🧮"],
      [/phys/, "⚛️"],
      [/chem/, "🧪"],
      [/bio|anatom/, "🧬"],
      [/hist/, "📜"],
      [/geo|earth|map/, "🌍"],
      [/program|code|python|java|web|software|comput/, "💻"],
      [/art|draw|paint|design/, "🎨"],
      [/music|guitar|piano/, "🎵"],
      [/lang|spanish|french|german|english|writ|gramm/, "📚"],
      [/cook|food|chef/, "🍳"],
      [/space|astro/, "🚀"],
      [/sport|fit|gym|run/, "🏋️"],
      [/finance|econ|money|invest/, "💰"],
      [/photo|camera/, "📷"],
    ];
    let emoji = "✨";
    for (const [re, e] of map) if (re.test(lower)) { emoji = e; break; }
    return { gradient, emoji };
  };

  const openSubject = async (subjectId: string) => {
    setPlanLoading(true);
    setView("lesson");
    const { data } = await supabase
      .from("lesson_plans")
      .select("*")
      .eq("subject_id", subjectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setPlanLoading(false);
    if (data) {
      const plan = data as unknown as LessonPlan;
      setActivePlan(plan);
      // jump to first non-completed module
      const next = plan.modules.findIndex((_, i) => !plan.completed_modules?.includes(i));
      setActiveModuleIndex(next === -1 ? 0 : next);
    } else {
      setActivePlan(null);
    }
  };

  const openModule = (idx: number) => {
    setActiveModuleIndex(idx);
    setView("module");
    void loadVideos(idx);
  };

  const loadVideos = async (idx: number) => {
    if (!activePlan) return;
    const mod = activePlan.modules[idx];
    if (!mod) return;
    const subjectName = subjects.find((s) => s.id === activePlan.subject_id)?.name || "";
    const query = `${mod.title} ${subjectName}`.trim();
    setVideosLoading(true);
    setVideos([]);
    try {
      const { data, error } = await supabase.functions.invoke("youtube-videos", {
        body: { query, limit: 4 },
      });
      if (error) throw error;
      setVideos((data?.videos || []) as Video[]);
    } catch (err) {
      console.error("youtube fetch failed", err);
    } finally {
      setVideosLoading(false);
    }
  };

  const openChat = async () => {
    if (!activePlan) return;
    setView("chat");
    const { data } = await supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("lesson_plan_id", activePlan.id)
      .order("created_at", { ascending: true });
    setMessages((data || []) as Message[]);
  };

  const startQuiz = () => {
    if (!stats || stats.hearts <= 0) {
      setView("noHearts");
      return;
    }
    sfx.tap();
    setView("quiz");
  };

  const handleQuizPass = async (correctCount: number) => {
    if (!activePlan) return;
    const total = 5;
    const passed = correctCount >= 4;
    if (!passed) {
      setLastReward({ xp: 0, correct: correctCount, total });
      toast({ title: "Almost there", description: `You got ${correctCount}/${total}. Try again to complete this module.` });
      setView("module");
      return;
    }
    const xp = 10 + correctCount * 5;
    const completed = Array.from(new Set([...(activePlan.completed_modules || []), activeModuleIndex]));
    const { error } = await supabase
      .from("lesson_plans")
      .update({ completed_modules: completed })
      .eq("id", activePlan.id);
    if (error) {
      toast({ title: "Could not save progress", description: error.message, variant: "destructive" });
      return;
    }
    setActivePlan({ ...activePlan, completed_modules: completed });
    await awardXp(xp);
    setLastReward({ xp, correct: correctCount, total });
    setConfettiTick((t) => t + 1);
    sfx.complete();
    setView("moduleComplete");
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newPrompt.trim()) return;
    setCreating(true);
    try {
      const { data: subj, error: sErr } = await supabase
        .from("subjects")
        .insert({ user_id: user.id, name: newPrompt.trim() })
        .select()
        .single();
      if (sErr) throw sErr;

      const { data: fnData, error: fnErr } = await supabase.functions.invoke("generate-lesson-plan", {
        body: { subject: newPrompt.trim(), level: "", goals: "", subject_id: subj.id },
      });
      if (fnErr) throw fnErr;
      if (fnData?.error) throw new Error(fnData.error);

      setNewOpen(false);
      setNewPrompt("");
      await loadSubjects();
      if (fnData.lesson_plan) {
        const plan = { ...fnData.lesson_plan, completed_modules: [] } as LessonPlan;
        setActivePlan(plan);
        setActiveModuleIndex(0);
        setView("lesson");
      }
    } catch (err: any) {
      toast({ title: "Could not create lesson", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const sendMessage = async (text: string) => {
    if (!activePlan || !text.trim() || streaming) return;
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
        if (resp.status === 429) toast({ title: "Slow down", description: "AI rate limit hit.", variant: "destructive" });
        else if (resp.status === 402) toast({ title: "Out of credits", variant: "destructive" });
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
            if (delta) { acc += delta; setStreamBuffer(acc); }
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

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Sparkles className="h-6 w-6 animate-pulse text-primary" />
      </main>
    );
  }

  const goBack = () => {
    if (view === "chat") setView("module");
    else if (view === "module") setView("lesson");
    else if (view === "lesson") setView("subjects");
  };

  const currentModule = activePlan?.modules[activeModuleIndex];

  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        {view === "subjects" || view === "lesson" ? (
          view === "subjects" ? (
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h1 className="font-semibold text-foreground">Your subjects</h1>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={goBack} className="gap-2 -ml-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          )
        ) : view === "module" ? (
          <Button variant="ghost" size="sm" onClick={goBack} className="gap-2 -ml-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        ) : <div />}
        <div className="flex items-center gap-2">
          {(view === "subjects" || view === "lesson" || view === "module") && (
            <StatsHeader stats={stats} />
          )}
          {view === "subjects" && (
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-2 ml-1">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-xl px-6 py-8">
        {/* SUBJECTS */}
        {view === "subjects" && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
            {subjectsLoading ? (
              <>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </>
            ) : (
              <>
                {subjects.length === 0 && (
                  <p className="py-8 text-center text-muted-foreground">
                    No subjects yet. Create your first below.
                  </p>
                )}
                {subjects.map((s) => {
                  const total = s.total || 0;
                  const completed = s.completed || 0;
                  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                  const { gradient, emoji } = subjectVisual(s.name);
                  return (
                    <button
                      key={s.id}
                      onClick={() => openSubject(s.id)}
                      className="group flex w-full items-stretch gap-0 overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition-all hover:border-primary hover:shadow-md"
                    >
                      <div
                        className="flex w-20 shrink-0 items-center justify-center text-4xl"
                        style={{ background: gradient }}
                        aria-hidden
                      >
                        <span className="drop-shadow">{emoji}</span>
                      </div>
                      <div className="flex flex-1 items-center justify-between gap-3 p-4">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-semibold text-foreground">{s.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {total > 0 ? `${completed} / ${total} modules` : "Lesson ready"}
                            {pct > 0 && <span className="ml-2 font-medium text-primary">{pct}%</span>}
                          </p>
                        </div>
                        <span className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1">→</span>
                      </div>
                      {/* Vertical progress bar on the side */}
                      <div className="relative w-2 shrink-0 bg-muted" aria-label={`${pct}% complete`}>
                        <div
                          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-primary to-primary/70 transition-all"
                          style={{ height: `${pct}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </>
            )}

            <Dialog open={newOpen} onOpenChange={setNewOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="mt-6 h-14 w-full gap-2 text-base font-semibold">
                  <Plus className="h-5 w-5" /> New subject
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>What do you want to learn?</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateSubject} className="space-y-4">
                  <Input
                    autoFocus
                    required
                    value={newPrompt}
                    onChange={(e) => setNewPrompt(e.target.value)}
                    placeholder="e.g. Linear algebra for beginners"
                    className="h-12 text-base"
                  />
                  <Button type="submit" size="lg" className="w-full" disabled={creating}>
                    {creating ? "Building lesson..." : "Create lesson"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* LESSON PATH */}
        {view === "lesson" && (
          <div className="animate-in fade-in slide-in-from-right-4">
            {planLoading || !activePlan ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-foreground">{activePlan.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activePlan.completed_modules?.length || 0} of {activePlan.modules.length} complete
                </p>

                <div className="mt-8 space-y-3">
                  {activePlan.modules.map((m, i) => {
                    const done = activePlan.completed_modules?.includes(i);
                    const firstUndone = activePlan.modules.findIndex((_, j) => !activePlan.completed_modules?.includes(j));
                    const isCurrent = i === firstUndone;
                    const locked = !done && !isCurrent;
                    return (
                      <button
                        key={i}
                        onClick={() => !locked && openModule(i)}
                        disabled={locked}
                        className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
                          isCurrent
                            ? "border-primary bg-primary/5 shadow-md hover:shadow-lg"
                            : done
                            ? "border-border bg-card hover:border-primary/40"
                            : "border-border bg-muted/30 opacity-60"
                        }`}
                      >
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                            done ? "bg-primary text-primary-foreground" : isCurrent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {done ? <Check className="h-5 w-5" /> : locked ? <Lock className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Module {i + 1}
                          </p>
                          <p className="font-semibold text-foreground">{m.title}</p>
                        </div>
                        {isCurrent && (
                          <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                            Start
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* MODULE */}
        {view === "module" && currentModule && activePlan && (
          <div className="animate-in fade-in slide-in-from-right-4">
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Module {activeModuleIndex + 1} of {activePlan.modules.length}
            </p>
            <h2 className="mt-1 text-3xl font-bold text-foreground">{currentModule.title}</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">{currentModule.summary}</p>

            {currentModule.exercises?.length > 0 && (
              <Card className="mt-6 p-4">
                <p className="text-sm font-semibold text-foreground">Practice</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {currentModule.exercises.slice(0, 3).map((ex, j) => (
                    <li key={j}>{ex}</li>
                  ))}
                </ul>
              </Card>
            )}

            {/* YouTube further learning — real videos */}
            <div className="mt-6">
              <div className="mb-2 flex items-center gap-2">
                <Youtube className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Watch on YouTube</p>
              </div>
              {videosLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-xl" />
                  ))}
                </div>
              ) : videos.length === 0 ? (
                <p className="text-sm text-muted-foreground">No videos found.</p>
              ) : (
                <div className="space-y-2">
                  {videos.map((v) => (
                    <a
                      key={v.id}
                      href={v.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-3 rounded-xl border border-border bg-card p-2 transition-all hover:border-primary hover:shadow-sm"
                    >
                      <img
                        src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`}
                        alt={v.title}
                        loading="lazy"
                        className="h-16 w-28 shrink-0 rounded-lg object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium text-foreground">{v.title}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{v.channel}</p>
                      </div>
                      <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-8 space-y-3">
              {!activePlan.completed_modules?.includes(activeModuleIndex) ? (
                <Button size="lg" className="h-14 w-full gap-2 text-base font-bold" onClick={startQuiz}>
                  <Play className="h-5 w-5" /> Start lesson
                </Button>
              ) : (
                <div className="flex items-center justify-center gap-2 rounded-2xl bg-green-500/10 py-3 text-sm font-semibold text-green-600 dark:text-green-400">
                  <Check className="h-4 w-4" /> Module complete
                </div>
              )}
              <Button size="lg" variant="outline" className="h-12 w-full gap-2" onClick={openChat}>
                Chat with teacher
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* CHAT — full screen */}
      {view === "chat" && currentModule && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background animate-in fade-in slide-in-from-bottom-4">
          <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
            <Button variant="ghost" size="sm" onClick={() => setView("module")} className="-ml-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Module {activeModuleIndex + 1}</p>
              <p className="truncate font-semibold text-foreground">{currentModule.title}</p>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="mx-auto max-w-2xl space-y-3">
              {messages.length === 0 && !streaming && (
                <div className="flex flex-col items-center py-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <p className="mt-4 text-foreground">Ask anything about this module.</p>
                </div>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "mr-auto bg-muted text-foreground"
                  }`}
                >
                  {m.content}
                </div>
              ))}
              {streaming && streamBuffer && (
                <div className="mr-auto max-w-[85%] rounded-2xl bg-muted px-4 py-2.5 text-sm leading-relaxed text-foreground">
                  {streamBuffer}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>

          <div className="border-t border-border bg-card px-4 py-3">
            <div className="mx-auto max-w-2xl">
              {messages.length === 0 && !streaming && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(`${s}: ${currentModule.title}`)}
                      className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary hover:bg-primary/5"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage(chatInput);
                }}
                className="flex gap-2"
              >
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask the teacher..."
                  disabled={streaming}
                  className="h-12"
                />
                <Button type="submit" size="icon" className="h-12 w-12" disabled={streaming || !chatInput.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* QUIZ — full screen */}
      {view === "quiz" && currentModule && activePlan && stats && (
        <QuizScreen
          lessonPlanId={activePlan.id}
          moduleIndex={activeModuleIndex}
          moduleTitle={currentModule.title}
          hearts={stats.hearts}
          onClose={() => setView("module")}
          onWrong={async () => {
            const next = await loseHeart();
            return next ? { hearts: next.hearts } : null;
          }}
          onPass={handleQuizPass}
          onOutOfHearts={() => setView("noHearts")}
        />
      )}

      {/* NO HEARTS */}
      {view === "noHearts" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-6 animate-in fade-in">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
            <Heart className="h-10 w-10 text-red-500" />
          </div>
          <h2 className="mt-6 text-2xl font-bold text-foreground">Out of hearts</h2>
          <p className="mt-2 max-w-sm text-center text-muted-foreground">
            You'll get a heart back every 30 minutes. Come back soon to keep learning.
          </p>
          <Button size="lg" className="mt-8 h-14 px-8 text-base font-bold" onClick={() => setView("lesson")}>
            Back to lessons
          </Button>
        </div>
      )}

      {/* MODULE COMPLETE celebration */}
      {view === "moduleComplete" && lastReward && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-6 animate-in fade-in">
          <div className="flex h-24 w-24 animate-pop items-center justify-center rounded-full bg-primary/10">
            <Trophy className="h-12 w-12 text-primary" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-foreground">Module complete!</h2>
          <p className="mt-2 text-muted-foreground">{lastReward.correct} of {lastReward.total} correct</p>
          <div className="mt-6 flex items-center gap-2 rounded-full bg-primary/10 px-5 py-2 text-lg font-bold text-primary">
            <Sparkles className="h-5 w-5" /> +{lastReward.xp} XP
          </div>
          <Button
            size="lg"
            className="mt-10 h-14 px-8 text-base font-bold"
            onClick={() => { setLastReward(null); setView("lesson"); }}
          >
            Continue
          </Button>
        </div>
      )}

      <Confetti trigger={confettiTick} />
    </main>
  );
};

export default Dashboard;
