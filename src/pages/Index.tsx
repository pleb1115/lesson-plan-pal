import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import aiTeacher from "@/assets/ai-teacher-hero.png";

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <img
          src={aiTeacher}
          alt="Friendly AI teacher robot holding a book"
          className="mb-8 h-auto w-64"
        />
        <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          Learn anything, one step at a time
        </h1>
        <Button
          size="lg"
          className="mt-8 h-14 w-full text-base font-semibold"
          onClick={() => navigate(user ? "/dashboard" : "/auth")}
        >
          Start learning
        </Button>
      </div>
    </main>
  );
};

export default Index;
