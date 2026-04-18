import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, BookOpen, MessageCircle } from "lucide-react";
import aiTeacher from "@/assets/ai-teacher-hero.png";

const Index = () => {
  return (
    <main className="min-h-screen bg-background">
      <section className="container mx-auto px-6 py-16 md:py-24">
        <div className="grid items-center gap-12 md:grid-cols-2">
          {/* Left: copy */}
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">
              <Sparkles className="h-4 w-4" />
              Meet your AI teacher
            </span>
            <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
              A patient tutor that builds lesson plans for any subject
            </h1>
            <p className="text-lg text-muted-foreground">
              Pick a subject, set your goals, and get a structured lesson plan you can chat through —
              one concept at a time.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" className="gap-2">
                <BookOpen className="h-4 w-4" />
                Start a lesson
              </Button>
              <Button size="lg" variant="outline" className="gap-2">
                <MessageCircle className="h-4 w-4" />
                Ask the teacher
              </Button>
            </div>
          </div>

          {/* Right: AI teacher visual */}
          <Card className="overflow-hidden border-border bg-secondary p-4 shadow-sm">
            <img
              src={aiTeacher}
              alt="Friendly AI teacher robot holding a book"
              className="mx-auto h-auto w-full max-w-md"
            />
          </Card>
        </div>
      </section>
    </main>
  );
};

export default Index;
