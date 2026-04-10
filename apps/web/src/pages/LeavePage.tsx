import React, { useState } from "react";
import {
  Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Alert, Stack, Chip, MenuItem, Select, InputLabel, FormControl, Grid,
} from "@mui/material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/axios.js";
import { useAuth } from "../contexts/AuthContext.js";

interface LeaveType { id: string; name: string; }
interface LeaveBalance { leaveTypeId: string; leaveType: { name: string }; balance: number; }
interface LeaveApplication { id: string; leaveTypeId: string; leaveType: { name: string }; startDate: string; endDate: string; reason: string; status: string; rejectionReason?: string; }

function ApplicationForm({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ leaveTypeId: "", startDate: "", endDate: "", reason: "" });
  const [error, setError] = useState("");

  const { data: typesData } = useQuery<{ data: LeaveType[] }>({ queryKey: ["leave-types"], queryFn: () => api.get("/leave/types").then(r => r.data) });
  const types: LeaveType[] = typesData?.data ?? [];

  const save = useMutation({
    mutationFn: () => api.post(`/employees/${user?.userId}/leave/applications`, { ...form, startDate: new Date(form.startDate).toISOString(), endDate: new Date(form.endDate).toISOString() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leave-applications"] }); onClose(); },
    onError: (e: any) => setError(e.response?.data?.error?.message ?? "Error"),
  });

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <FormControl required>
        <InputLabel>Leave Type</InputLabel>
        <Select value={form.leaveTypeId} label="Leave Type" onChange={e => setForm(p => ({ ...p, leaveTypeId: e.target.value }))}>
          {types.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
        </Select>
      </FormControl>
      <TextField label="Start Date" type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} InputLabelProps={{ shrink: true }} required />
      <TextField label="End Date" type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} InputLabelProps={{ shrink: true }} required />
      <TextField label="Reason" multiline rows={3} value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} required />
      <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>Submit Application</Button>
    </Stack>
  );
}

function RejectDialog({ application, onClose }: { application: LeaveApplication; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const reject = useMutation({
    mutationFn: () => api.put(`/leave/applications/${application.id}/reject`, { rejectionReason: reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leave-applications"] }); onClose(); },
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

export default function LeavePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [applyOpen, setApplyOpen] = useState(false);
  const [rejectApp, setRejectApp] = useState<LeaveApplication | null>(null);
  const [empId, setEmpId] = useState(user?.userId ?? "");
  const [searchId, setSearchId] = useState(user?.userId ?? "");

  const canApprove = user?.role !== "EMPLOYEE";

  const { data: balancesData } = useQuery<{ data: LeaveBalance[] }>({
    queryKey: ["leave-balances", empId],
    queryFn: () => api.get(`/employees/${empId}/leave/balances`).then(r => r.data),
    enabled: !!empId,
  });

  const { data: appsData, isLoading } = useQuery<{ data: LeaveApplication[] }>({
    queryKey: ["leave-applications", empId],
    queryFn: () => api.get(`/employees/${empId}/leave/applications`).then(r => r.data),
    enabled: !!empId,
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.put(`/leave/applications/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leave-applications"] }),
  });

  const balances: LeaveBalance[] = balancesData?.data ?? [];
  const applications: LeaveApplication[] = appsData?.data ?? [];
  const statusColor = (s: string) => s === "APPROVED" ? "success" : s === "REJECTED" ? "error" : "warning";

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Leave Management</Typography>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
        {canApprove && (
          <>
            <TextField label="Employee ID" size="small" value={searchId} onChange={e => setSearchId(e.target.value)} />
            <Button variant="outlined" onClick={() => setEmpId(searchId)}>Load</Button>
          </>
        )}
        <Button variant="contained" onClick={() => setApplyOpen(true)}>Apply for Leave</Button>
      </Stack>

      {balances.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>Leave Balances</Typography>
          <Grid container spacing={2}>
            {balances.map(b => (
              <Grid item xs={6} sm={4} md={3} key={b.leaveTypeId}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center" }}>
                  <Typography variant="caption" color="text.secondary">{b.leaveType.name}</Typography>
                  <Typography variant="h5">{b.balance}</Typography>
                  <Typography variant="caption">days</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      <Paper>
        <Typography variant="h6" sx={{ p: 2, pb: 0 }}>Applications</Typography>
        {isLoading ? <Typography sx={{ p: 2 }}>Loading...</Typography> : (
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Type</TableCell><TableCell>Start</TableCell><TableCell>End</TableCell>
              <TableCell>Reason</TableCell><TableCell>Status</TableCell>
              {canApprove && <TableCell>Actions</TableCell>}
            </TableRow></TableHead>
            <TableBody>{applications.map(app => (
              <TableRow key={app.id}>
                <TableCell>{app.leaveType.name}</TableCell>
                <TableCell>{new Date(app.startDate).toLocaleDateString()}</TableCell>
                <TableCell>{new Date(app.endDate).toLocaleDateString()}</TableCell>
                <TableCell>{app.reason}</TableCell>
                <TableCell>
                  <Stack spacing={0.5}>
                    <Chip label={app.status} color={statusColor(app.status) as any} size="small" />
                    {app.rejectionReason && <Typography variant="caption" color="error">{app.rejectionReason}</Typography>}
                  </Stack>
                </TableCell>
                {canApprove && (
                  <TableCell>
                    {app.status === "PENDING" && (
                      <Stack direction="row" spacing={0.5}>
                        <Button size="small" color="success" onClick={() => approve.mutate(app.id)}>Approve</Button>
                        <Button size="small" color="error" onClick={() => setRejectApp(app)}>Reject</Button>
                      </Stack>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </Paper>

      <Dialog open={applyOpen} onClose={() => setApplyOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Apply for Leave</DialogTitle>
        <DialogContent><ApplicationForm onClose={() => setApplyOpen(false)} /></DialogContent>
        <DialogActions><Button onClick={() => setApplyOpen(false)}>Cancel</Button></DialogActions>
      </Dialog>

      <Dialog open={!!rejectApp} onClose={() => setRejectApp(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject Leave Application</DialogTitle>
        {rejectApp && <RejectDialog application={rejectApp} onClose={() => setRejectApp(null)} />}
      </Dialog>
    </Box>
  );
}
