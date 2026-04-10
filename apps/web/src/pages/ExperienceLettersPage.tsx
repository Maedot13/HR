import React, { useState } from "react";
import {
  Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Alert, Stack, Chip, MenuItem, Select, InputLabel, FormControl, Tabs, Tab,
} from "@mui/material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/axios.js";
import { useAuth } from "../contexts/AuthContext.js";

interface ExperienceLetter { id: string; employeeId: string; format: string; fileUrl: string; generatedAt: string; }
interface Employee { id: string; employeeId: string; fullName: string; status: string; }

function GenerateForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ employeeId: "", format: "PDF" });
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: () => api.post(`/employees/${form.employeeId}/experience-letter`, { format: form.format }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["experience-letters"] }); onClose(); },
    onError: (e: any) => setError(e.response?.data?.error?.message ?? "Error"),
  });

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField label="Employee ID" value={form.employeeId} onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))} required />
      <FormControl required>
        <InputLabel>Format</InputLabel>
        <Select value={form.format} label="Format" onChange={e => setForm(p => ({ ...p, format: e.target.value }))}>
          <MenuItem value="PDF">PDF</MenuItem>
          <MenuItem value="DOCX">DOCX</MenuItem>
        </Select>
      </FormControl>
      <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>Generate Letter</Button>
    </Stack>
  );
}

export default function ExperienceLettersPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState(0);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [empId, setEmpId] = useState("");
  const [searchId, setSearchId] = useState("");

  const isHROfficer = user?.role === "HR_OFFICER" || user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const { data: lettersData, isLoading: lettersLoading } = useQuery<{ data: ExperienceLetter[] }>({
    queryKey: ["experience-letters", empId],
    queryFn: () => api.get(`/employees/${empId}/experience-letters`).then(r => r.data),
    enabled: !!empId,
  });

  const { data: deactivatedData, isLoading: deactivatedLoading } = useQuery<{ data: Employee[] }>({
    queryKey: ["deactivated-employees"],
    queryFn: () => api.get("/employees", { params: { status: "INACTIVE" } }).then(r => r.data),
    enabled: isSuperAdmin && tab === 1,
  });

  const letters: ExperienceLetter[] = lettersData?.data ?? [];
  const deactivated: Employee[] = deactivatedData?.data ?? [];

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Experience Letters & Records</Typography>
      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Experience Letters" />
          {isSuperAdmin && <Tab label="Deactivated Employees" />}
        </Tabs>
        <Box sx={{ p: 2 }}>
          {tab === 0 && (
            <Box>
              <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
                <TextField label="Employee ID" size="small" value={searchId} onChange={e => setSearchId(e.target.value)} />
                <Button variant="outlined" onClick={() => setEmpId(searchId)}>Load Letters</Button>
                {isHROfficer && <Button variant="contained" onClick={() => setGenerateOpen(true)}>Generate Letter</Button>}
              </Stack>
              {lettersLoading ? <Typography>Loading...</Typography> : (
                <Table size="small">
                  <TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Format</TableCell><TableCell>Generated</TableCell><TableCell>Download</TableCell></TableRow></TableHead>
                  <TableBody>{letters.map(l => (
                    <TableRow key={l.id}>
                      <TableCell>{l.employeeId}</TableCell>
                      <TableCell><Chip label={l.format} size="small" /></TableCell>
                      <TableCell>{new Date(l.generatedAt).toLocaleDateString()}</TableCell>
                      <TableCell><Button size="small" variant="outlined" href={l.fileUrl} target="_blank">Download</Button></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
              {letters.length === 0 && empId && <Typography sx={{ mt: 2, color: "text.secondary" }}>No letters found</Typography>}
            </Box>
          )}

          {tab === 1 && isSuperAdmin && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>Deactivated Employee Records (read-only)</Typography>
              {deactivatedLoading ? <Typography>Loading...</Typography> : (
                <Table size="small">
                  <TableHead><TableRow><TableCell>Employee ID</TableCell><TableCell>Full Name</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                  <TableBody>{deactivated.map(emp => (
                    <TableRow key={emp.id}>
                      <TableCell>{emp.employeeId}</TableCell>
                      <TableCell>{emp.fullName}</TableCell>
                      <TableCell><Chip label={emp.status} color="error" size="small" /></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
              {deactivated.length === 0 && <Typography sx={{ mt: 2, color: "text.secondary" }}>No deactivated employees</Typography>}
            </Box>
          )}
        </Box>
      </Paper>

      <Dialog open={generateOpen} onClose={() => setGenerateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Generate Experience Letter</DialogTitle>
        <DialogContent><GenerateForm onClose={() => setGenerateOpen(false)} /></DialogContent>
        <DialogActions><Button onClick={() => setGenerateOpen(false)}>Cancel</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
