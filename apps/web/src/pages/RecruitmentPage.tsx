import React, { useState } from "react";
import {
  Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Alert, Stack, Chip, MenuItem, Select, InputLabel, FormControl, Stepper, Step, StepLabel,
} from "@mui/material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/axios.js";
import { useAuth } from "../contexts/AuthContext.js";

interface JobPosting { id: string; title: string; type: string; deadline: string; isAcademic: boolean; }
interface Application { id: string; candidateName: string; candidateEmail: string; currentStage: string; publicationEvalScore: number | null; }

const STAGES = ["SCREENING", "INTERVIEW", "SELECTION", "OFFER"];

function PostingForm({ posting, onClose }: { posting: JobPosting | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    type: posting?.type ?? "EXTERNAL",
    title: posting?.title ?? "",
    description: "",
    requirements: "",
    deadline: posting?.deadline?.slice(0, 10) ?? "",
    isAcademic: posting?.isAcademic ?? false,
  });
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: () => posting
      ? api.put(`/job-postings/${posting.id}`, form)
      : api.post("/job-postings", { ...form, deadline: new Date(form.deadline).toISOString() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["job-postings"] }); onClose(); },
    onError: (e: any) => setError(
      e.response?.data?.error?.message ??
      "Unable to save job posting. Check the details and try again."
    ),
  });

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField label="Title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
      <FormControl required>
        <InputLabel>Type</InputLabel>
        <Select value={form.type} label="Type" onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
          <MenuItem value="INTERNAL">Internal</MenuItem>
          <MenuItem value="EXTERNAL">External</MenuItem>
        </Select>
      </FormControl>
      <TextField label="Description" multiline rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} required />
      <TextField label="Requirements" multiline rows={2} value={form.requirements} onChange={e => setForm(p => ({ ...p, requirements: e.target.value }))} required />
      <TextField label="Deadline" type="date" value={form.deadline} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} InputLabelProps={{ shrink: true }} required />
      <FormControl>
        <InputLabel>Role Type</InputLabel>
        <Select
          value={form.isAcademic ? "academic" : "non-academic"}
          label="Role Type"
          onChange={e => setForm(p => ({ ...p, isAcademic: e.target.value === "academic" }))}
        >
          <MenuItem value="academic">Academic</MenuItem>
          <MenuItem value="non-academic">Non-Academic</MenuItem>
        </Select>
      </FormControl>
      <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
    </Stack>
  );
}

function ApplicationsPanel({ posting }: { posting: JobPosting }) {
  const qc = useQueryClient();
  const [advanceApp, setAdvanceApp] = useState<Application | null>(null);
  const [pubScore, setPubScore] = useState("");
  const [mutationError, setMutationError] = useState("");

  const { data, isLoading, error: loadError } = useQuery<{ data: Application[] }>({
    queryKey: ["applications", posting.id],
    queryFn: () => api.get(`/job-postings/${posting.id}/applications`).then(r => r.data),
  });

  const advance = useMutation({
    mutationFn: (app: Application) =>
      api.put(`/applications/${app.id}/advance`, {
        publicationEvalScore:
          posting.isAcademic && app.currentStage === "SCREENING" ? Number(pubScore) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applications", posting.id] });
      setAdvanceApp(null);
      setPubScore("");
      setMutationError("");
    },
    onError: (e: any) => setMutationError(
      e.response?.data?.error?.message ??
      "Unable to advance this application. Check the stage requirements and try again."
    ),
  });

  const issueOffer = useMutation({
    mutationFn: (app: Application) => api.post(`/applications/${app.id}/offer`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["applications", posting.id] }); setMutationError(""); },
    onError: (e: any) => setMutationError(
      e.response?.data?.error?.message ??
      "Unable to issue offer. Ensure the application is at the Selection stage and try again."
    ),
  });

  const apps: Application[] = data?.data ?? [];

  return (
    <Box>
      {/* Load failure — the table would be silently empty without this */}
      {loadError && (
        <Alert severity="error" sx={{ mb: 1 }}>
          Failed to load applications for this posting. Check your connection and try again.
        </Alert>
      )}
      {mutationError && (
        <Alert
          severity="error"
          sx={{ mb: 1 }}
          action={<Button size="small" color="inherit" onClick={() => setMutationError("")}>Dismiss</Button>}
        >
          {mutationError}
        </Alert>
      )}
      {isLoading ? <Typography>Loading...</Typography> : (
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>Applicant</TableCell><TableCell>Stage</TableCell><TableCell>Actions</TableCell>
          </TableRow></TableHead>
          <TableBody>{apps.map(app => (
            <TableRow key={app.id}>
              <TableCell>{app.candidateName}</TableCell>
              <TableCell>
                <Stepper activeStep={STAGES.indexOf(app.currentStage)} alternativeLabel sx={{ minWidth: 280 }}>
                  {STAGES.map(s => <Step key={s}><StepLabel>{s}</StepLabel></Step>)}
                </Stepper>
              </TableCell>
              <TableCell>
                <Stack direction="row" spacing={0.5}>
                  {app.currentStage !== "OFFER" && (
                    <Button size="small" onClick={() => { setMutationError(""); setAdvanceApp(app); }}>
                      Advance
                    </Button>
                  )}
                  {app.currentStage === "SELECTION" && (
                    <Button size="small" color="success" onClick={() => issueOffer.mutate(app)}>
                      Issue Offer
                    </Button>
                  )}
                </Stack>
              </TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      )}

      <Dialog open={!!advanceApp} onClose={() => setAdvanceApp(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Advance Stage</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {mutationError && <Alert severity="error">{mutationError}</Alert>}
            {posting.isAcademic && advanceApp?.currentStage === "SCREENING" && (
              <TextField
                label="Publication Evaluation Score"
                type="number"
                value={pubScore}
                onChange={e => setPubScore(e.target.value)}
                required
              />
            )}
            <Typography>Advance {advanceApp?.candidateName} to next stage?</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdvanceApp(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => advanceApp && advance.mutate(advanceApp)}
            disabled={advance.isPending}
          >
            Advance
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function RecruitmentPage() {
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [editPosting, setEditPosting] = useState<JobPosting | null>(null);
  const [selectedPosting, setSelectedPosting] = useState<JobPosting | null>(null);

  const canManage = user?.role !== "EMPLOYEE";

  const { data, isLoading, error } = useQuery<{ data: JobPosting[] }>({
    queryKey: ["job-postings"],
    queryFn: () => api.get("/job-postings").then(r => r.data),
  });

  const postings: JobPosting[] = data?.data ?? [];

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Recruitment</Typography>
      {canManage && (
        <Button variant="contained" onClick={() => setCreateOpen(true)} sx={{ mb: 2 }}>
          New Job Posting
        </Button>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load job postings. Check your connection and try again.
        </Alert>
      )}
      {isLoading ? <Typography>Loading...</Typography> : (
        <Paper sx={{ mb: 3 }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Title</TableCell><TableCell>Type</TableCell><TableCell>Deadline</TableCell>
              <TableCell>Academic</TableCell><TableCell>Actions</TableCell>
            </TableRow></TableHead>
            <TableBody>{postings.map(p => (
              <TableRow key={p.id} selected={selectedPosting?.id === p.id}>
                <TableCell>{p.title}</TableCell>
                <TableCell>{p.type}</TableCell>
                <TableCell>{p.deadline ? new Date(p.deadline).toLocaleDateString() : "—"}</TableCell>
                <TableCell>
                  <Chip label={p.isAcademic ? "Yes" : "No"} size="small" color={p.isAcademic ? "primary" : "default"} />
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    <Button size="small" onClick={() => setSelectedPosting(p)}>Applications</Button>
                    {canManage && <Button size="small" onClick={() => setEditPosting(p)}>Edit</Button>}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </Paper>
      )}

      {selectedPosting && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>Applications — {selectedPosting.title}</Typography>
          <ApplicationsPanel posting={selectedPosting} />
        </Paper>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Job Posting</DialogTitle>
        <DialogContent><PostingForm posting={null} onClose={() => setCreateOpen(false)} /></DialogContent>
        <DialogActions><Button onClick={() => setCreateOpen(false)}>Cancel</Button></DialogActions>
      </Dialog>

      <Dialog open={!!editPosting} onClose={() => setEditPosting(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Job Posting</DialogTitle>
        <DialogContent>{editPosting && <PostingForm posting={editPosting} onClose={() => setEditPosting(null)} />}</DialogContent>
        <DialogActions><Button onClick={() => setEditPosting(null)}>Cancel</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
