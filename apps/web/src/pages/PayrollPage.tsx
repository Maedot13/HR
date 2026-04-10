import React, { useState } from "react";
import {
  Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Alert, Stack, Chip, MenuItem, Select, InputLabel, FormControl,
} from "@mui/material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/axios.js";
import { useAuth } from "../contexts/AuthContext.js";

interface PayrollExport { format: string; fileUrl: string; }
interface PayrollReport { id: string; period: string; status: string; generatedAt: string; exports: PayrollExport[]; }

function GenerateForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [period, setPeriod] = useState("");
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: () => api.post("/payroll/reports", { period }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payroll-reports"] }); onClose(); },
    onError: (e: any) => setError(e.response?.data?.error?.message ?? "Error"),
  });

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField label="Period (e.g. 2026-03)" value={period} onChange={e => setPeriod(e.target.value)} required />
      <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>Generate Report</Button>
    </Stack>
  );
}

export default function PayrollPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [generateOpen, setGenerateOpen] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState("EXCEL");

  const canGenerate = user?.role !== "EMPLOYEE";
  const canValidate = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";

  const { data, isLoading, error } = useQuery<{ data: PayrollReport[] }>({
    queryKey: ["payroll-reports"],
    queryFn: () => api.get("/payroll/reports").then(r => r.data),
  });

  const exportReport = useMutation({
    mutationFn: ({ id, format }: { id: string; format: string }) => api.post(`/payroll/reports/${id}/export`, { format }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payroll-reports"] }); setExportingId(null); },
  });

  const validate = useMutation({
    mutationFn: (id: string) => api.put(`/payroll/reports/${id}/validate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll-reports"] }),
  });

  const reports: PayrollReport[] = data?.data ?? [];
  const statusColor = (s: string) => s === "VALIDATED" ? "success" : s === "SENT" ? "info" : "default";

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Payroll Reporting</Typography>
      {canGenerate && <Button variant="contained" onClick={() => setGenerateOpen(true)} sx={{ mb: 2 }}>Generate Report</Button>}

      {error && <Alert severity="error" sx={{ mb: 2 }}>Failed to load reports</Alert>}
      {isLoading ? <Typography>Loading...</Typography> : (
        <Paper>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Period</TableCell><TableCell>Generated</TableCell><TableCell>Status</TableCell>
              <TableCell>Exports</TableCell><TableCell>Actions</TableCell>
            </TableRow></TableHead>
            <TableBody>{reports.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.period}</TableCell>
                <TableCell>{new Date(r.generatedAt).toLocaleDateString()}</TableCell>
                <TableCell><Chip label={r.status} color={statusColor(r.status) as any} size="small" /></TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    {(r.exports ?? []).map(ex => (
                      <Button key={ex.format} size="small" variant="outlined" href={ex.fileUrl} target="_blank">{ex.format}</Button>
                    ))}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    <Button size="small" onClick={() => setExportingId(r.id)}>Export</Button>
                    {canValidate && r.status !== "VALIDATED" && (
                      <Button size="small" color="success" onClick={() => validate.mutate(r.id)}>Validate</Button>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
          {reports.length === 0 && <Typography sx={{ p: 2, textAlign: "center", color: "text.secondary" }}>No reports yet</Typography>}
        </Paper>
      )}

      <Dialog open={generateOpen} onClose={() => setGenerateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Generate Payroll Report</DialogTitle>
        <DialogContent><GenerateForm onClose={() => setGenerateOpen(false)} /></DialogContent>
        <DialogActions><Button onClick={() => setGenerateOpen(false)}>Cancel</Button></DialogActions>
      </Dialog>

      <Dialog open={!!exportingId} onClose={() => setExportingId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Export Report</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Format</InputLabel>
            <Select value={exportFormat} label="Format" onChange={e => setExportFormat(e.target.value)}>
              <MenuItem value="EXCEL">Excel</MenuItem>
              <MenuItem value="PDF">PDF</MenuItem>
              <MenuItem value="DOCX">DOCX</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportingId(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => exportingId && exportReport.mutate({ id: exportingId, format: exportFormat })} disabled={exportReport.isPending}>Export</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
