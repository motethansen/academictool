import { cn } from "@/lib/utils";

interface ScoreSelectorProps {
  value: number;
  onChange: (val: number) => void;
}

const ScoreSelector = ({ value, onChange }: ScoreSelectorProps) => {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((score) => (
        <button
          key={score}
          type="button"
          onClick={() => onChange(score)}
          className={cn(
            "w-10 h-10 rounded-lg text-sm font-sans font-semibold transition-all duration-200",
            "border-2 hover:scale-110",
            value === score
              ? "bg-primary border-primary text-primary-foreground shadow-md"
              : "bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
          )}
        >
          {score}
        </button>
      ))}
    </div>
  );
};

export default ScoreSelector;
