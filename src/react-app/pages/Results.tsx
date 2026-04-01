import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GROUPS, DIMENSIONS, getStoredSubmissions } from "@/lib/survey-data";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
import { motion } from "framer-motion";

const COLORS = ["hsl(220,60%,22%)", "hsl(38,80%,55%)", "hsl(160,50%,40%)", "hsl(340,60%,50%)"];

const Results = () => {
  const navigate = useNavigate();

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["submissions"],
    queryFn: getStoredSubmissions,
  });

  const averages = useMemo(() => {
    const acc: Record<string, Record<string, { total: number; count: number }>> = {};
    GROUPS.forEach((g) => {
      acc[g] = {};
      DIMENSIONS.forEach((d) => { acc[g][d.key] = { total: 0, count: 0 }; });
    });

    submissions.forEach((sub) => {
      Object.entries(sub.ratings).forEach(([targetGroup, dims]) => {
        Object.entries(dims).forEach(([dimKey, score]) => {
          if (acc[targetGroup]?.[dimKey]) {
            acc[targetGroup][dimKey].total += score as number;
            acc[targetGroup][dimKey].count += 1;
          }
        });
      });
    });

    const result: Record<string, Record<string, number>> = {};
    GROUPS.forEach((g) => {
      result[g] = {};
      DIMENSIONS.forEach((d) => {
        const { total, count } = acc[g][d.key];
        result[g][d.key] = count > 0 ? Math.round((total / count) * 100) / 100 : 0;
      });
    });
    return result;
  }, [submissions]);

  const barData = DIMENSIONS.map((d) => {
    const entry: Record<string, string | number> = { dimension: d.label };
    GROUPS.forEach((g) => { entry[g] = averages[g][d.key]; });
    return entry;
  });

  const radarDataByGroup = GROUPS.map((g) => ({
    group: g,
    data: DIMENSIONS.map((d) => ({ dimension: d.label, score: averages[g][d.key] })),
  }));

  const overallScores = GROUPS.map((g) => {
    const vals = Object.values(averages[g]);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return { group: g, average: Math.round(avg * 100) / 100 };
  }).sort((a, b) => b.average - a.average);

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl text-primary">Results</h1>
            <p className="text-muted-foreground font-sans">
              {isLoading ? "Loading…" : `${submissions.length} submission${submissions.length !== 1 ? "s" : ""} recorded`}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/")}>Back to Survey</Button>
        </motion.div>

        {isLoading ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-muted-foreground font-sans text-lg">Loading results…</p>
            </CardContent>
          </Card>
        ) : submissions.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-muted-foreground font-sans text-lg">No submissions yet. Complete the survey to see results here.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              <Card>
                <CardHeader><CardTitle>Overall Ranking</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {overallScores.map((item, i) => (
                      <div key={item.group} className="text-center p-4 rounded-xl bg-muted/50">
                        <p className="text-3xl font-bold font-sans" style={{ color: COLORS[i] }}>#{i + 1}</p>
                        <p className="font-sans font-semibold text-foreground mt-1">{item.group}</p>
                        <p className="text-2xl font-bold font-sans text-primary mt-1">{item.average}</p>
                        <p className="text-xs text-muted-foreground font-sans">avg score</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
              <Card>
                <CardHeader><CardTitle>Scores by Dimension</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={barData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,88%)" />
                      <XAxis dataKey="dimension" tick={{ fontSize: 11, fontFamily: "system-ui" }} angle={-20} textAnchor="end" height={80} />
                      <YAxis domain={[0, 5]} tick={{ fontFamily: "system-ui" }} />
                      <Tooltip contentStyle={{ fontFamily: "system-ui", borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontFamily: "system-ui" }} />
                      {GROUPS.map((g, i) => (
                        <Bar key={g} dataKey={g} fill={COLORS[i]} radius={[4, 4, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-6">
              {radarDataByGroup.map((item, idx) => (
                <motion.div key={item.group} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + idx * 0.1 }}>
                  <Card>
                    <CardHeader><CardTitle className="text-lg">{item.group}</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={280}>
                        <RadarChart data={item.data}>
                          <PolarGrid stroke="hsl(220,15%,88%)" />
                          <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10, fontFamily: "system-ui" }} />
                          <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
                          <Radar dataKey="score" stroke={COLORS[idx]} fill={COLORS[idx]} fillOpacity={0.25} strokeWidth={2} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Results;
