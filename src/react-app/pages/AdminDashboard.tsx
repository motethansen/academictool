import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GROUPS, DIMENSIONS, getStoredSubmissions, type SurveySubmission } from "@/lib/survey-data";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
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
  const [pdfLoading, setPdfLoading] = useState(false);

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

  // ── handlers ──────────────────────────────────────────────────────────────

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

  const handleDownloadPDF = async () => {
    const el = document.getElementById("pdf-content");
    if (!el) { toast.error("Could not find content to export."); return; }

    setPdfLoading(true);
    toast.info("Generating PDF — this may take a few seconds…");

    try {
      // Dynamic imports keep them out of the main bundle
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      // Capture the full content area at 2× for crisp output
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW  = pdf.internal.pageSize.getWidth();   // 210 mm
      const pageH  = pdf.internal.pageSize.getHeight();  // 297 mm
      const margin = 12; // mm
      const contentW = pageW - margin * 2;

      // How many mm equals one canvas pixel
      const mmPerPx = contentW / canvas.width;
      const totalH  = canvas.height * mmPerPx;          // total content height in mm
      const usableH = pageH - margin * 2;               // usable height per page

      let yMm = 0;
      while (yMm < totalH) {
        if (yMm > 0) pdf.addPage();

        const sliceHMm = Math.min(usableH, totalH - yMm);
        const srcY     = yMm / mmPerPx;
        const srcH     = sliceHMm / mmPerPx;

        // Create a temporary canvas for just this page's slice
        const tmp = document.createElement("canvas");
        tmp.width  = canvas.width;
        tmp.height = Math.ceil(srcH);
        const ctx = tmp.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, tmp.width, tmp.height);
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

        pdf.addImage(
          tmp.toDataURL("image/jpeg", 0.92),
          "JPEG",
          margin, margin,
          contentW, sliceHMm,
        );

        yMm += sliceHMm;
      }

      pdf.save(`peer-evaluation-${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("PDF downloaded!");
    } catch (err) {
      toast.error("PDF generation failed.");
      console.error(err);
    } finally {
      setPdfLoading(false);
    }
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header — NOT included in PDF capture */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl text-primary">Teacher Dashboard</h1>
            <p className="text-muted-foreground font-sans">
              {isLoading ? "Loading…" : `${submissions.length} submission${submissions.length !== 1 ? "s" : ""} recorded`}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleDownloadPDF} disabled={submissions.length === 0 || pdfLoading}>
              {pdfLoading ? "Generating…" : "Download PDF"}
            </Button>
            <Button variant="destructive" onClick={handleReset} disabled={submissions.length === 0}>Reset All Data</Button>
            <Button variant="outline" onClick={handleLogout}>Logout</Button>
          </div>
        </motion.div>

        {isLoading ? (
          <Card><CardContent className="py-16 text-center">
            <p className="text-muted-foreground font-sans text-lg">Loading submissions…</p>
          </CardContent></Card>
        ) : submissions.length === 0 ? (
          <Card><CardContent className="py-16 text-center">
            <p className="text-muted-foreground font-sans text-lg">No submissions yet.</p>
          </CardContent></Card>
        ) : (
          /* ── PDF capture starts here ─────────────────────────────────── */
          <div id="pdf-content" className="space-y-8 bg-background p-2 rounded-xl">

            {/* Report header (visible in PDF) */}
            <div className="pt-2 pb-1">
              <h2 className="text-2xl font-bold text-primary">Peer Evaluation Report</h2>
              <p className="text-sm text-muted-foreground font-sans">
                Generated {new Date().toLocaleString()} · {submissions.length} submission{submissions.length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* ── 1. Overall Ranking ── */}
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

            {/* ── 2. Bar chart ── */}
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

            {/* ── 3. Radar charts ── */}
            <div className="grid md:grid-cols-2 gap-6">
              {radarDataByGroup.map((item, idx) => (
                <Card key={item.group}>
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
              ))}
            </div>

            {/* ── 4. Detail scores table (groups × dimensions) ── */}
            <Card>
              <CardHeader><CardTitle>Detail Scores by Group</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm font-sans border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left p-3 bg-muted font-semibold border rounded-tl-md">Group</th>
                        {DIMENSIONS.map((d) => (
                          <th key={d.key} className="text-center p-3 bg-muted font-semibold border text-xs leading-tight">
                            {d.label}
                          </th>
                        ))}
                        <th className="text-center p-3 bg-primary text-primary-foreground font-bold border rounded-tr-md">
                          Average
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {GROUPS.map((g, i) => {
                        const avg = overallScores.find((s) => s.group === g)?.average ?? 0;
                        return (
                          <tr key={g} className={i % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                            <td className="p-3 border font-semibold">{g}</td>
                            {DIMENSIONS.map((d) => (
                              <td key={d.key} className="text-center p-3 border tabular-nums">
                                {averages[g][d.key]}
                              </td>
                            ))}
                            <td className="text-center p-3 border font-bold tabular-nums"
                              style={{ color: COLORS[i] }}>
                              {avg}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* ── 5. Individual submission detail table ── */}
            <Card>
              <CardHeader><CardTitle>Individual Submissions</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                {submissions.map((sub, i) => (
                  <div key={i}>
                    <div className="flex justify-between items-center mb-2">
                      <p className="font-sans font-semibold text-sm text-foreground">
                        Submission {i + 1} — evaluated by <span className="text-primary">{sub.evaluatorGroup}</span>
                      </p>
                      <p className="text-xs text-muted-foreground font-sans">
                        {new Date(sub.submittedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs font-sans border-collapse">
                        <thead>
                          <tr>
                            <th className="text-left p-2 bg-muted border font-semibold">Dimension</th>
                            {GROUPS.map((g) => (
                              <th key={g} className="text-center p-2 bg-muted border font-semibold">{g}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {DIMENSIONS.map((d, di) => (
                            <tr key={d.key} className={di % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                              <td className="p-2 border font-medium">{d.label}</td>
                              {GROUPS.map((g) => (
                                <td key={g} className="text-center p-2 border tabular-nums">
                                  {(sub.ratings[g] as Record<string, number>)?.[d.key] ?? "—"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

          </div>
          /* ── PDF capture ends here ─────────────────────────────────── */
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
