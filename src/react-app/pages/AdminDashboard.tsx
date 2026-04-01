import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GROUPS, DIMENSIONS, getStoredSubmissions, type SurveySubmission } from "@/lib/survey-data";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
import { motion } from "framer-motion";
import { toast } from "sonner";

const COLORS = ["hsl(220,60%,22%)", "hsl(38,80%,55%)", "hsl(160,50%,40%)", "hsl(340,60%,50%)"];

function computeAverages(submissions: SurveySubmission[]) {
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
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["submissions"],
    queryFn: getStoredSubmissions,
    enabled: sessionStorage.getItem("admin-auth") === "true",
  });

  if (sessionStorage.getItem("admin-auth") !== "true") {
    navigate("/admin/login");
    return null;
  }

  const averages = useMemo(() => computeAverages(submissions), [submissions]);

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

  const handleReset = async () => {
    if (!window.confirm("Are you sure you want to delete ALL survey submissions? This cannot be undone.")) return;
    const token = sessionStorage.getItem("admin-token") ?? "";
    const res = await fetch("/api/admin/reset", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if ((await res.json() as { ok: boolean }).ok) {
      toast.success("All data has been reset.");
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
    } else {
      toast.error("Reset failed — please log in again.");
      navigate("/admin/login");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("admin-auth");
    sessionStorage.removeItem("admin-token");
    navigate("/admin/login");
  };

  const handleDownloadPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Please allow pop-ups to download PDF."); return; }

    const tableRows = overallScores.map((s) =>
      `<tr><td style="padding:8px;border:1px solid #ddd;">${s.group}</td><td style="padding:8px;border:1px solid #ddd;text-align:center;">${s.average}</td></tr>`
    ).join("");

    const detailTables = GROUPS.map((g) => {
      const rows = DIMENSIONS.map((d) =>
        `<tr><td style="padding:6px;border:1px solid #ddd;">${d.label}</td><td style="padding:6px;border:1px solid #ddd;text-align:center;">${averages[g][d.key]}</td></tr>`
      ).join("");
      return `<div style="margin-bottom:24px;"><h3 style="margin:0 0 8px;">${g}</h3><table style="width:100%;border-collapse:collapse;font-size:14px;"><thead><tr><th style="padding:6px;border:1px solid #ccc;background:#f5f5f5;text-align:left;">Dimension</th><th style="padding:6px;border:1px solid #ccc;background:#f5f5f5;text-align:center;">Avg Score</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }).join("");

    const submissionLog = submissions.map((s, i) => {
      const ratingRows = Object.entries(s.ratings).map(([target, dims]) => {
        const scores = DIMENSIONS.map(d => `${d.label}: ${(dims as Record<string,number>)[d.key] || '-'}`).join(', ');
        return `<li><strong>${target}</strong>: ${scores}</li>`;
      }).join('');
      return `<div style="margin-bottom:12px;"><strong>Submission ${i+1}</strong> — by ${s.evaluatorGroup} (${new Date(s.submittedAt).toLocaleString()})<ul style="margin:4px 0;">${ratingRows}</ul></div>`;
    }).join('');

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Survey Report</title><style>body{font-family:system-ui,sans-serif;padding:40px;color:#1a1a2e;}h1{font-size:24px;}h2{font-size:18px;margin-top:32px;}table{width:100%;border-collapse:collapse;}@media print{body{padding:20px;}}</style></head><body>
      <h1>Peer Evaluation Survey Report</h1>
      <p style="color:#666;">Generated: ${new Date().toLocaleString()} &bull; ${submissions.length} submissions</p>
      <h2>Overall Ranking</h2>
      <table><thead><tr><th style="padding:8px;border:1px solid #ccc;background:#f5f5f5;text-align:left;">Group</th><th style="padding:8px;border:1px solid #ccc;background:#f5f5f5;text-align:center;">Average Score</th></tr></thead><tbody>${tableRows}</tbody></table>
      <h2>Scores by Dimension</h2>
      ${detailTables}
      <h2>Individual Submissions</h2>
      ${submissionLog}
    </body></html>`);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl text-primary">Teacher Dashboard</h1>
            <p className="text-muted-foreground font-sans">
              {isLoading ? "Loading…" : `${submissions.length} submission${submissions.length !== 1 ? "s" : ""} recorded`}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleDownloadPDF} disabled={submissions.length === 0}>Download PDF</Button>
            <Button variant="destructive" onClick={handleReset} disabled={submissions.length === 0}>Reset All Data</Button>
            <Button variant="outline" onClick={handleLogout}>Logout</Button>
          </div>
        </motion.div>

        {isLoading ? (
          <Card><CardContent className="py-16 text-center"><p className="text-muted-foreground font-sans text-lg">Loading submissions…</p></CardContent></Card>
        ) : submissions.length === 0 ? (
          <Card><CardContent className="py-16 text-center"><p className="text-muted-foreground font-sans text-lg">No submissions yet.</p></CardContent></Card>
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

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
              <Card>
                <CardHeader><CardTitle>Submission Log</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {submissions.map((sub, i) => (
                    <div key={i} className="p-4 rounded-lg bg-muted/30 space-y-2">
                      <div className="flex justify-between items-center">
                        <p className="font-sans font-semibold text-sm text-foreground">Submission {i + 1} — {sub.evaluatorGroup}</p>
                        <p className="text-xs text-muted-foreground font-sans">{new Date(sub.submittedAt).toLocaleString()}</p>
                      </div>
                      <div className="grid sm:grid-cols-3 gap-2">
                        {Object.entries(sub.ratings).map(([target, dims]) => (
                          <div key={target} className="text-xs font-sans">
                            <p className="font-semibold text-foreground">{target}</p>
                            {DIMENSIONS.map(d => (
                              <p key={d.key} className="text-muted-foreground">{d.label}: {(dims as Record<string,number>)[d.key]}</p>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
