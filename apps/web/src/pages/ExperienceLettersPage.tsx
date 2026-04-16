import React, { useState } from "react";
import {
  Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Alert, Stack, Chip, MenuItem, Select, InputLabel, FormControl, Tabs, Tab,
} from "@mui/material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/axios.js";
import { useAuth } from "../contexts/AuthContext.js";

interface ExperienceLetter {
  id: string;
  employeeId: string;
  format: string;
  fileUrl: string;
  generatedAt: string;
}
interface Employee { id: string; employeeId: string; fullName: string; status: string; }

// Resolve the API origin so download links point to the API server, not the
// Vite dev-server. Strips the trailing "/api/v1" segment from axios baseURL.
function getApiBase(): string {
  const base = (api.defaults.baseURL ?? "").replace(/\/api\/v1\/?$/, "");
  return base; // e.g. "http://localhost:3000"
}

// ─── Generate Form ────────────────────────────────────────────────────────────

function GenerateForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ employeeRef: "", format: "PDF" });
  const [error, setError] = useState("");

  const save = useMutation({
    // The route accepts either internal UUID or formatted ID (e.g. AAU-2026-00045)
    mutationFn: () =>
      api.post(`/employees/${encodeURIComponent(form.employeeRef)}/experience-letter`, {
        format: form.format,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["experience-letters"] });
      onClose();
    },
    onError: (e: any) =>
      setError(
        e.response?.data?.error?.message ??
          "Unable to generate the experience letter. Please check the Employee ID and try again."
      ),
  });

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}

      <TextField
        label="Employee ID"
        placeholder="e.g. AAU-2026-00045"
        helperText="Enter the employee's formatted ID (e.g. AAU-2026-00045) or internal UUID"
        value={form.employeeRef}
        onChange={e => setForm(p => ({ ...p, employeeRef: e.target.value }))}
        required
      />

      <FormControl required>
        <InputLabel>Format</InputLabel>
        <Select
          value={form.format}
          label="Format"
          onChange={e => setForm(p => ({ ...p, format: e.target.value }))}
        >
          <MenuItem value="PDF">PDF</MenuItem>
          <MenuItem value="DOCX">DOCX</MenuItem>
        </Select>
      </FormControl>

      <Button
        variant="contained"
        onClick={() => save.mutate()}
        disabled={save.isPending || !form.employeeRef.trim()}
      >
        {save.isPending ? "Generating…" : "Generate Letter"}
      </Button>
    </Stack>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExperienceLettersPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState(0);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [searchRef, setSearchRef] = useState("");   // what the user types
  const [resolvedRef, setResolvedRef] = useState(""); // committed on "Load"

  // FIXED: Only HR_OFFICER (and SUPER_ADMIN) have experience_letter:generate
  // ADMIN does NOT have this permission — showing the button would cause a 403.
  const canGenerateLetter =
    user?.role === "HR_OFFICER" || user?.role === "SUPER_ADMIN";

  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const apiBase = getApiBase();

  // ── Letters for a specific employee ──────────────────────────────────────
  const { data: lettersData, isLoading: lettersLoading, error: lettersError } =
    useQuery<{ data: ExperienceLetter[] }>({
      queryKey: ["experience-letters", resolvedRef],
      queryFn: () =>
        api
          .get(`/employees/${encodeURIComponent(resolvedRef)}/experience-letters`)
          .then(r => r.data),
      enabled: !!resolvedRef,
    });

  // ── Deactivated employees (SUPER_ADMIN only, second tab) ─────────────────
  const { data: deactivatedData, isLoading: deactivatedLoading } =
    useQuery<{ data: Employee[] }>({
      queryKey: ["deactivated-employees"],
      queryFn: () =>
        api.get("/employees", { params: { status: "INACTIVE" } }).then(r => r.data),
      enabled: isSuperAdmin && tab === 1,
    });

  const letters: ExperienceLetter[] = lettersData?.data ?? [];
  const deactivated: Employee[]     = deactivatedData?.data ?? [];

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Experience Letters &amp; Records
      </Typography>

      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Experience Letters" />
          {isSuperAdmin && <Tab label="Deactivated Employees" />}
        </Tabs>

        <Box sx={{ p: 2 }}>
          {/* ── Tab 0: Experience Letters ──────────────────────────────── */}
          {tab === 0 && (
            <Box>
              <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
                <TextField
                  label="Employee ID"
                  size="small"
                  placeholder="e.g. AAU-2026-00045"
                  value={searchRef}
                  onChange={e => setSearchRef(e.target.value)}
                />
                <Button
                  variant="outlined"
                  onClick={() => setResolvedRef(searchRef.trim())}
                  disabled={!searchRef.trim()}
                >
                  Load Letters
                </Button>

                {/* Only HR_OFFICER / SUPER_ADMIN see the Generate button */}
                {canGenerateLetter && (
                  <Button variant="contained" onClick={() => setGenerateOpen(true)}>
                    Generate Letter
                  </Button>
                )}
              </Stack>

              {lettersError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  Failed to load letters. Check the Employee ID and try again.
                </Alert>
              )}

              {lettersLoading ? (
                <Typography>Loading…</Typography>
              ) : (
                <>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Employee ID</TableCell>
                        <TableCell>Format</TableCell>
                        <TableCell>Generated</TableCell>
                        <TableCell>Download</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {letters.map(l => (
                        <TableRow key={l.id}>
                          <TableCell>{l.employeeId}</TableCell>
                          <TableCell>
                            <Chip label={l.format} size="small" />
                          </TableCell>
                          <TableCell>
                            {new Date(l.generatedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {/* FIXED: prefix with API origin so the link hits the API
                                server (where express.static serves /uploads) */}
                            <Button
                              size="small"
                              variant="outlined"
                              href={`${apiBase}${l.fileUrl}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Download
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {letters.length === 0 && resolvedRef && (
                    <Typography sx={{ mt: 2, color: "text.secondary" }}>
                      No letters found for this employee.
                    </Typography>
                  )}
                </>
              )}
            </Box>
          )}

          {/* ── Tab 1: Deactivated Employees (SUPER_ADMIN only) ──────── */}
          {tab === 1 && isSuperAdmin && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Deactivated Employee Records (read-only)
              </Typography>
              {deactivatedLoading ? (
                <Typography>Loading…</Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Employee ID</TableCell>
                      <TableCell>Full Name</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {deactivated.map(emp => (
                      <TableRow key={emp.id}>
                        <TableCell>{emp.employeeId}</TableCell>
                        <TableCell>{emp.fullName}</TableCell>
                        <TableCell>
                          <Chip label={emp.status} color="error" size="small" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {deactivated.length === 0 && (
                <Typography sx={{ mt: 2, color: "text.secondary" }}>
                  No deactivated employees found.
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </Paper>

      {/* ── Generate Letter Dialog ──────────────────────────────────────── */}
      <Dialog
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Generate Experience Letter</DialogTitle>
        <DialogContent>
          <GenerateForm onClose={() => setGenerateOpen(false)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerateOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
