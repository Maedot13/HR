import React, { useState } from "react";
import {
  Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Alert, Stack, Chip, MenuItem, Select, InputLabel, FormControl,
} from "@mui/material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/axios.js";
import { useAuth } from "../contexts/AuthContext.js";

interface PayrollExport { id: string; format: string; fileUrl: string; }
interface PayrollReport {
  id: string;
  period: string;
  status: string;
  generatedAt: string;
  PayrollExport: PayrollExport[];
}

// Resolve the API origin so download links point to the API static server,
// not the Vite dev-server.
function getApiBase(): string {
  return (api.defaults.baseURL ?? "").replace(/\/api\/v1\/?$/, "");
}

// ─── Generate Form ────────────────────────────────────────────────────────────

function GenerateForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [period, setPeriod] = useState("");
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: () => api.post("/payroll/reports", { period }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll-reports"] });
      onClose();
    },
    onError: (e: any) =>
      setError(
        e.response?.data?.error?.message ??
          "Unable to generate report. The period must be in YYYY-MM format (e.g. 2026-03)."
      ),
  });

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField
        label="Payroll Period"
        placeholder="e.g. 2026-03"
        value={period}
        onChange={e => setPeriod(e.target.value)}
        helperText="Year and month in YYYY-MM format"
        required
      />
      <Button
        variant="contained"
        onClick={() => save.mutate()}
        disabled={save.isPending || !period.trim()}
      >
        {save.isPending ? "Generating…" : "Generate Report"}
      </Button>
    </Stack>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PayrollPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [generateOpen, setGenerateOpen] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState("EXCEL");
  const [actionError, setActionError] = useState("");

  const apiBase = getApiBase();

  // FIXED: Only HR_OFFICER and SUPER_ADMIN have payroll:generate
  // ADMIN does NOT — showing the button would always result in a 403.
  const canGenerate =
    user?.role === "HR_OFFICER" || user?.role === "SUPER_ADMIN";

  // FIXED: ADMIN now has payroll:validate (per constants.ts patch) acting as
  // Finance-proxy (Req 12). SUPER_ADMIN inherits all permissions.
  const canValidate =
    user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";

  // FIXED: Export is also HR_OFFICER + SUPER_ADMIN only (payroll:export)
  const canExport =
    user?.role === "HR_OFFICER" || user?.role === "SUPER_ADMIN";

  const { data, isLoading, error } = useQuery<{ data: PayrollReport[] }>({
    queryKey: ["payroll-reports"],
    queryFn: () => api.get("/payroll/reports").then(r => r.data),
  });

  const exportReport = useMutation({
    mutationFn: ({ id, format }: { id: string; format: string }) =>
      api.post(`/payroll/reports/${id}/export`, { format }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll-reports"] });
      setExportingId(null);
      setActionError("");
    },
    onError: (e: any) =>
      setActionError(
        e.response?.data?.error?.message ??
          "Export failed. Try a different format or check your connection and try again."
      ),
  });

  const validate = useMutation({
    mutationFn: (id: string) => api.put(`/payroll/reports/${id}/validate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll-reports"] });
      setActionError("");
    },
    onError: (e: any) =>
      setActionError(
        e.response?.data?.error?.message ??
          "Validation failed. Ensure the report is complete and try again."
      ),
  });

  const reports: PayrollReport[] = data?.data ?? [];
  const statusColor = (s: string) =>
    s === "VALIDATED" ? "success" : s === "SENT" ? "info" : "default";

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Payroll Reporting
      </Typography>

      {/* Generate button — only for HR_OFFICER / SUPER_ADMIN */}
      {canGenerate && (
        <Button
          variant="contained"
          onClick={() => setGenerateOpen(true)}
          sx={{ mb: 2 }}
        >
          Generate Report
        </Button>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load reports. Check your connection and try again.
        </Alert>
      )}
      {actionError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button size="small" color="inherit" onClick={() => setActionError("")}>
              Dismiss
            </Button>
          }
        >
          {actionError}
        </Alert>
      )}

      {isLoading ? (
        <Typography>Loading…</Typography>
      ) : (
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Period</TableCell>
                <TableCell>Generated</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Exports</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reports.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{r.period}</TableCell>
                  <TableCell>{new Date(r.generatedAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Chip
                      label={r.status}
                      color={statusColor(r.status) as any}
                      size="small"
                    />
                  </TableCell>

                  {/* Export download links — prefix with API origin */}
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap">
                      {(r.PayrollExport ?? []).map(ex => (
                        <Button
                          key={ex.id}
                          size="small"
                          variant="outlined"
                          href={`${apiBase}${ex.fileUrl}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {ex.format}
                        </Button>
                      ))}
                    </Stack>
                  </TableCell>

                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      {/* Export: HR_OFFICER / SUPER_ADMIN only */}
                      {canExport && (
                        <Button
                          size="small"
                          onClick={() => {
                            setActionError("");
                            setExportingId(r.id);
                          }}
                        >
                          Export
                        </Button>
                      )}

                      {/* Validate: ADMIN (Finance-proxy) + SUPER_ADMIN */}
                      {canValidate && r.status !== "VALIDATED" && (
                        <Button
                          size="small"
                          color="success"
                          onClick={() => validate.mutate(r.id)}
                          disabled={validate.isPending}
                        >
                          Validate
                        </Button>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {reports.length === 0 && (
            <Typography sx={{ p: 2, textAlign: "center", color: "text.secondary" }}>
              No reports yet. Generate one to get started.
            </Typography>
          )}
        </Paper>
      )}

      {/* ── Generate Report Dialog ──────────────────────────────────────── */}
      <Dialog
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Generate Payroll Report</DialogTitle>
        <DialogContent>
          <GenerateForm onClose={() => setGenerateOpen(false)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerateOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* ── Export Format Dialog ────────────────────────────────────────── */}
      <Dialog
        open={!!exportingId}
        onClose={() => { setExportingId(null); setActionError(""); }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Export Report</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Format</InputLabel>
            <Select
              value={exportFormat}
              label="Format"
              onChange={e => setExportFormat(e.target.value)}
            >
              {/* Salary & bonus data → Excel (Req 12.2) */}
              <MenuItem value="EXCEL">Excel (.xlsx) — Salary &amp; Bonus</MenuItem>
              {/* Penalty data → PDF or DOCX (Req 12.3) */}
              <MenuItem value="PDF">PDF — Full Report</MenuItem>
              <MenuItem value="DOCX">DOCX — Full Report</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setExportingId(null); setActionError(""); }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() =>
              exportingId &&
              exportReport.mutate({ id: exportingId, format: exportFormat })
            }
            disabled={exportReport.isPending}
          >
            {exportReport.isPending ? "Exporting…" : "Export"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
