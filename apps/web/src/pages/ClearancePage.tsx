import React, { useState } from "react";
import {
  Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Alert, Stack, Chip, MenuItem, Select, InputLabel, FormControl, Tabs, Tab,
} from "@mui/material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/axios.js";
import { useAuth } from "../contexts/AuthContext.js";

interface ClearanceBody { id: string; name: string; approvalMode: string; order: number; }
interface ClearanceTask { id: string; clearanceBodyId: string; clearanceBody: { name: string }; status: string; approvedBy?: string; rejectionReason?: string; }
interface ClearanceRecord { id: string; employeeId: string; status: string; tasks: ClearanceTask[]; }

function BodyForm({ body, onClose }: { body: ClearanceBody | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: body?.name ?? "", approvalMode: body?.approvalMode ?? "PARALLEL", order: body?.order?.toString() ?? "1" });
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: () => body
      ? api.put(`/clearance/bodies/${body.id}`, { ...form, order: Number(form.order) })
      : api.post("/clearance/bodies", [{ ...form, order: Number(form.order) }]),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clearance-bodies"] }); onClose(); },
    onError: (e: any) => setError(e.response?.data?.error?.message ?? "Error"),
  });

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField label="Name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
      <FormControl required>
        <InputLabel>Approval Mode</InputLabel>
        <Select value={form.approvalMode} label="Approval Mode" onChange={e => setForm(p => ({ ...p, approvalMode: e.target.value }))}>
          <MenuItem value="SEQUENTIAL">Sequential</MenuItem>
          <MenuItem value="PARALLEL">Parallel</MenuItem>
        </Select>
      </FormControl>
      <TextField label="Order" type="number" value={form.order} onChange={e => setForm(p => ({ ...p, order: e.target.value }))} required />
      <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
    </Stack>
  );
}

function RejectTaskDialog({ task, onClose }: { task: ClearanceTask; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const reject = useMutation({
    mutationFn: () => api.put(`/clearance/tasks/${task.id}/reject`, { rejectionReason: reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clearance-record"] }); onClose(); },
    onError: (e: any) => setError(e.response?.data?.error?.message ?? "Error"),
  });

  return (
    <>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Rejection Reason" multiline rows={3} value={reason} onChange={e => setReason(e.target.value)} required />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="error" onClick={() => reject.mutate()} disabled={reject.isPending || !reason}>Reject</Button>
      </DialogActions>
    </>
  );
}

export default function ClearancePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [bodyOpen, setBodyOpen] = useState(false);
  const [editBody, setEditBody] = useState<ClearanceBody | null>(null);
  const [initiateEmpId, setInitiateEmpId] = useState("");
  const [loadEmpId, setLoadEmpId] = useState("");
  const [activeEmpId, setActiveEmpId] = useState("");
  const [rejectTask, setRejectTask] = useState<ClearanceTask | null>(null);

  const canAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const { data: bodiesData, isLoading: bodiesLoading } = useQuery<{ data: ClearanceBody[] }>({
    queryKey: ["clearance-bodies"],
    queryFn: () => api.get("/clearance/bodies").then(r => r.data),
  });

  const { data: recordData } = useQuery<{ data: ClearanceRecord }>({
    queryKey: ["clearance-record", activeEmpId],
    queryFn: () => api.get(`/employees/${activeEmpId}/clearance`).then(r => r.data),
    enabled: !!activeEmpId,
  });

  const initiate = useMutation({
    mutationFn: (empId: string) => api.post(`/employees/${empId}/clearance`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clearance-record"] }),
  });

  const approve = useMutation({
    mutationFn: (taskId: string) => api.put(`/clearance/tasks/${taskId}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clearance-record", activeEmpId] }),
  });

  const bodies: ClearanceBody[] = bodiesData?.data ?? [];
  const record = recordData?.data;

  const taskStatusColor = (s: string) => s === "APPROVED" ? "success" : s === "REJECTED" ? "error" : s === "ACTIVE" ? "warning" : "default";

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Clearance & Offboarding</Typography>
      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Clearance Bodies" /><Tab label="Clearance Board" />
        </Tabs>
        <Box sx={{ p: 2 }}>
          {tab === 0 && (
            <Box>
              {canAdmin && <Button variant="contained" onClick={() => { setEditBody(null); setBodyOpen(true); }} sx={{ mb: 2 }}>Add Body</Button>}
              {bodiesLoading ? <Typography>Loading...</Typography> : (
                <Table size="small">
                  <TableHead><TableRow><TableCell>Name</TableCell><TableCell>Mode</TableCell><TableCell>Order</TableCell>{canAdmin && <TableCell>Actions</TableCell>}</TableRow></TableHead>
                  <TableBody>{bodies.map(b => (
                    <TableRow key={b.id}>
                      <TableCell>{b.name}</TableCell>
                      <TableCell><Chip label={b.approvalMode} size="small" /></TableCell>
                      <TableCell>{b.order}</TableCell>
                      {canAdmin && <TableCell><Button size="small" onClick={() => { setEditBody(b); setBodyOpen(true); }}>Edit</Button></TableCell>}
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </Box>
          )}

          {tab === 1 && (
            <Box>
              <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
                <TextField label="Employee ID to Initiate" size="small" value={initiateEmpId} onChange={e => setInitiateEmpId(e.target.value)} />
                <Button variant="outlined" color="warning" onClick={() => initiate.mutate(initiateEmpId)} disabled={!initiateEmpId}>Initiate Clearance</Button>
                <TextField label="Load Employee ID" size="small" value={loadEmpId} onChange={e => setLoadEmpId(e.target.value)} />
                <Button variant="outlined" onClick={() => setActiveEmpId(loadEmpId)} disabled={!loadEmpId}>Load</Button>
              </Stack>

              {record && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Typography variant="h6">Employee: {record.employeeId}</Typography>
                    <Chip label={record.status} color={record.status === "COMPLETED" ? "success" : "warning"} />
                  </Stack>
                  <Table size="small">
                    <TableHead><TableRow>
                      <TableCell>Body</TableCell><TableCell>Status</TableCell><TableCell>Approved By</TableCell>
                      <TableCell>Rejection Reason</TableCell><TableCell>Actions</TableCell>
                    </TableRow></TableHead>
                    <TableBody>{record.tasks.map(task => (
                      <TableRow key={task.id}>
                        <TableCell>{task.clearanceBody.name}</TableCell>
                        <TableCell><Chip label={task.status} color={taskStatusColor(task.status) as any} size="small" /></TableCell>
                        <TableCell>{task.approvedBy ?? "—"}</TableCell>
                        <TableCell>{task.rejectionReason ?? "—"}</TableCell>
                        <TableCell>
                          {task.status === "ACTIVE" && (
                            <Stack direction="row" spacing={0.5}>
                              <Button size="small" color="success" onClick={() => approve.mutate(task.id)}>Approve</Button>
                              <Button size="small" color="error" onClick={() => setRejectTask(task)}>Reject</Button>
                            </Stack>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                </Paper>
              )}
            </Box>
          )}
        </Box>
      </Paper>

      <Dialog open={bodyOpen} onClose={() => setBodyOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editBody ? "Edit Clearance Body" : "Add Clearance Body"}</DialogTitle>
        <DialogContent><BodyForm body={editBody} onClose={() => setBodyOpen(false)} /></DialogContent>
        <DialogActions><Button onClick={() => setBodyOpen(false)}>Cancel</Button></DialogActions>
      </Dialog>

      <Dialog open={!!rejectTask} onClose={() => setRejectTask(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject Task</DialogTitle>
        {rejectTask && <RejectTaskDialog task={rejectTask} onClose={() => setRejectTask(null)} />}
      </Dialog>
    </Box>
  );
}
