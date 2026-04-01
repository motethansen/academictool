import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DIMENSIONS, type DimensionKey, type GroupRanking } from "@/lib/survey-data";
import ScoreSelector from "./ScoreSelector";
import { motion } from "framer-motion";

interface GroupRatingCardProps {
  groupName: string;
  ratings: GroupRanking;
  onRate: (dimension: DimensionKey, score: number) => void;
  index: number;
}

const GroupRatingCard = ({ groupName, ratings, onRate, index }: GroupRatingCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
    >
      <Card className="border-2 hover:border-primary/20 transition-colors">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl text-primary">{groupName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {DIMENSIONS.map((dim) => (
            <div key={dim.key} className="space-y-2">
              <div>
                <p className="font-sans font-semibold text-sm text-foreground">{dim.label}</p>
                <p className="text-xs text-muted-foreground font-sans">{dim.description}</p>
              </div>
              <ScoreSelector
                value={ratings[dim.key] || 0}
                onChange={(score) => onRate(dim.key as DimensionKey, score)}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default GroupRatingCard;
