import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Heart, X, Check, Sparkles } from "lucide-react";
import { sfx } from "@/lib/sfx";
import { useToast } from "@/hooks/use-toast";

export type Question = {
  type: "multiple_choice" | "short_answer";
  prompt: string;
  options?: string[];
  correct_index?: number;
  accepted_answers?: string[];
  key_concepts?: string[];
  explanation: string;
};

type Phase = "answering" | "checked";

type Props = {
  lessonPlanId: string;
  moduleIndex: number;
  moduleTitle: string;
  hearts: number;
  onClose: () => void;
  onWrong: () => Promise<{ hearts: number } | null>;
  onPass: (correctCount: number) => void;
  onOutOfHearts: () => void;
};

export const QuizScreen = ({
  lessonPlanId, moduleIndex, moduleTitle, hearts, onClose, onWrong, onPass, onOutOfHearts,
}: Props) => {
  const { toast } = useToast();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [phase, setPhase] = useState<Phase>("answering");
  const [wasCorrect, setWasCorrect] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [grading, setGrading] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [shake, setShake] = useState(false);
  const [hearts_, setHearts] = useState(hearts);

  useEffect(() => setHearts(hearts), [hearts]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonPlanId, moduleIndex]);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: { lesson_plan_id: lessonPlanId, module_index: moduleIndex },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setQuestions((data?.questions || []) as Question[]);
    } catch (err: any) {
      toast({ title: "Could not load quiz", description: err.message, variant: "destructive" });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const q = questions[idx];

  const handleCheck = async () => {
    if (!q || phase === "checked") return;
    let correct = false;
    let fb = q.explanation || "";

    if (q.type === "multiple_choice") {
      if (selected === null) return;
      correct = selected === q.correct_index;
    } else {
      if (!textAnswer.trim()) return;
      setGrading(true);
      try {
        const { data, error } = await supabase.functions.invoke("grade-answer", {
          body: {
            prompt: q.prompt,
            answer: textAnswer,
            accepted_answers: q.accepted_answers,
            key_concepts: q.key_concepts,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        correct = !!data?.correct;
        fb = data?.feedback || fb;
      } catch (err: any) {
        toast({
          title: "Couldn't grade that",
          description: (err?.message || "Try again or rephrase your answer.") + " You can retry.",
          variant: "destructive",
        });
        setGrading(false);
        return; // stay in answering phase so user can retry
      }
      setGrading(false);
    }

    setWasCorrect(correct);
    setFeedback(fb);
    setPhase("checked");

    if (correct) {
      setCorrectCount((c) => c + 1);
      sfx.correct();
    } else {
      sfx.wrong();
      setShake(true);
      setTimeout(() => setShake(false), 500);
      const next = await onWrong();
      if (next) setHearts(next.hearts);
      if (next && next.hearts <= 0) {
        // give a moment for feedback then bail
        setTimeout(() => onOutOfHearts(), 900);
      }
    }
  };

  const handleContinue = () => {
    if (idx + 1 >= questions.length) {
      onPass(correctCount + (wasCorrect && phase === "checked" ? 0 : 0));
      return;
    }
    setIdx((i) => i + 1);
    setSelected(null);
    setTextAnswer("");
    setPhase("answering");
    setFeedback("");
    setWasCorrect(false);
  };

  const progress = questions.length > 0 ? (idx / questions.length) * 100 : 0;
  const canCheck = q?.type === "multiple_choice" ? selected !== null : textAnswer.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background animate-in fade-in">
      {/* Top bar: close + progress + hearts */}
      <header className="flex items-center gap-3 px-4 py-4">
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Quit quiz"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center gap-1 text-sm font-semibold text-red-500">
          <Heart className={`h-5 w-5 ${hearts_ > 0 ? "fill-red-500" : ""}`} />
          <span>{hearts_}</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6">
        <div className="mx-auto max-w-xl">
          {loading ? (
            <div className="space-y-4 pt-12">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Sparkles className="h-5 w-5 animate-pulse text-primary" />
                <p className="font-mono uppercase tracking-wider">Compiling trial…</p>
              </div>
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : q ? (
            <div key={idx} className={`pt-8 animate-in fade-in slide-in-from-right-4 ${shake ? "animate-[shake_0.4s]" : ""}`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {moduleTitle}
              </p>
              <h2 className="mt-2 text-2xl font-bold leading-tight text-foreground">
                {q.prompt}
              </h2>

              {q.type === "multiple_choice" && q.options ? (
                <div className="mt-8 space-y-3">
                  {q.options.map((opt, i) => {
                    const isSelected = selected === i;
                    const isCorrect = i === q.correct_index;
                    let cls = "border-border bg-card hover:border-primary/60";
                    if (phase === "checked") {
                      if (isCorrect) cls = "border-green-500 bg-green-500/10 text-foreground";
                      else if (isSelected) cls = "border-red-500 bg-red-500/10 text-foreground";
                      else cls = "border-border bg-card opacity-60";
                    } else if (isSelected) {
                      cls = "border-primary bg-primary/10";
                    }
                    return (
                      <button
                        key={i}
                        onClick={() => phase === "answering" && setSelected(i)}
                        disabled={phase === "checked"}
                        className={`flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left text-base font-medium transition-all ${cls}`}
                      >
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                          isSelected || (phase === "checked" && isCorrect)
                            ? "border-current"
                            : "border-muted-foreground/40 text-muted-foreground"
                        }`}>
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span className="flex-1">{opt}</span>
                        {phase === "checked" && isCorrect && <Check className="h-5 w-5 text-green-500" />}
                        {phase === "checked" && isSelected && !isCorrect && <X className="h-5 w-5 text-red-500" />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-8">
                  <Input
                    autoFocus
                    value={textAnswer}
                    onChange={(e) => setTextAnswer(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && phase === "answering" && canCheck) {
                        e.preventDefault();
                        void handleCheck();
                      }
                    }}
                    placeholder="Type your answer…"
                    disabled={phase === "checked"}
                    className={`h-14 text-base ${
                      phase === "checked"
                        ? wasCorrect ? "border-green-500" : "border-red-500"
                        : ""
                    }`}
                  />
                  {q.accepted_answers && q.accepted_answers.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Hint: a short phrase is fine.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Footer: Check / Continue + feedback */}
      <footer
        className={`border-t px-6 py-4 transition-colors ${
          phase === "checked"
            ? wasCorrect
              ? "border-green-500/30 bg-green-500/10"
              : "border-red-500/30 bg-red-500/10"
            : "border-border bg-card"
        }`}
      >
        <div className="mx-auto max-w-xl">
          {phase === "checked" && (
            <div className="mb-3 flex items-start gap-2">
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-sm ${
                wasCorrect ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
              }`}>
                {wasCorrect ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              </div>
              <div>
                <p className={`font-mono uppercase tracking-wider ${wasCorrect ? "text-primary text-glow" : "text-accent text-glow-accent"}`}>
                  {wasCorrect ? "Correct" : "Negative"}
                </p>
                {feedback && <p className="text-sm text-foreground/80">{feedback}</p>}
              </div>
            </div>
          )}
          {phase === "answering" ? (
            <Button
              size="lg"
              className="h-14 w-full font-mono text-base font-bold uppercase tracking-widest glow-primary"
              disabled={!canCheck || grading || loading}
              onClick={handleCheck}
            >
              {grading ? "Analyzing…" : "Execute"}
            </Button>
          ) : (
            <Button
              size="lg"
              className={`h-14 w-full font-mono text-base font-bold uppercase tracking-widest ${
                wasCorrect ? "bg-primary hover:bg-primary/90 text-primary-foreground glow-primary" : "bg-accent hover:bg-accent/90 text-accent-foreground glow-accent"
              }`}
              onClick={handleContinue}
            >
              {idx + 1 >= questions.length ? "Finalize" : "Proceed"}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
};
