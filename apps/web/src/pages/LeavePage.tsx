import React, { useState } from "react";
import {
  Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Alert, Stack, Chip, MenuItem, Select, InputLabel, FormControl, Grid,
} from "@mui/material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/axios.js";
import { useAuth } from "../contexts/AuthContext.js";
import { useWithCache } from "../hooks/useWithCache.js";

interface LeaveType { id: string; name: string; }
interface LeaveBalance { leaveTypeId: string; leaveType: { name: string }; balance: number; }
interface LeaveApplication { id: string; leaveTypeId: string; leaveType: { name: string }; startDate: string; endDate: string; reason: string; status: string; rejectionReason?: string; }

function ApplicationForm({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ leaveTypeId: "", startDate: "", endDate: "", reason: "" });
  const [apiError, setApiError] = useState("");

  // ── Tier 1→2→3 fallback for leave types ──────────────────────────────────
  const typesQuery = useQuery<{ data: LeaveType[] }>({
    queryKey: ["leave-types"],
    queryFn: () => api.get("/leave/types").then(r => r.data),
  });
  const {
    resolvedData: typesResolved,
    isFromCache:  typesFromCache,
    isManualFallback: typesManual,
  } = useWithCache("leave-types", typesQuery);
  const types: LeaveType[] = typesResolved?.data ?? [];

  // ── Per-field validation ──────────────────────────────────────────────
  const errs = {
    leaveTypeId: !typesManual && !form.leaveTypeId
      ? "Please select a leave type."
      : undefined,
    startDate: !form.startDate ? "Start date is required." : undefined,
    endDate: !form.endDate
      ? "End date is required."
      : (form.startDate && form.endDate < form.startDate
          ? "End date must be on or after the start date."
          : undefined),
    reason: !form.reason.trim() ? "Please provide a reason for your leave request." : undefined,
  } as const;

  const hasErrors = Object.values(errs).some(Boolean);
  // Track which fields the user has interacted with
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const show = (f: keyof typeof errs) => (touched[f] || submitAttempted) ? errs[f] : undefined;
  const touch = (f: string) => setTouched(p => ({ ...p, [f]: true }));

  const save = useMutation({
    mutationFn: () => api.post(`/employees/${user?.userId}/leave/applications`, {
      ...form,
      startDate: new Date(form.startDate).toISOString(),
      endDate:   new Date(form.endDate).toISOString(),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leave-applications"] }); onClose(); },
    onError: (e: any) => setApiError(
      e.response?.data?.error?.message ??
      "Unable to submit leave application. Check your dates and balance, then try again."
    ),
  });

  // Only show the manual-entry fallback when the API actually failed — not while loading
  const typesUnavailable = typesManual;

  // Submit is never disabled by validation — clicking always reveals field errors
  const handleSubmit = () => {
    setSubmitAttempted(true);
    if (hasErrors) return;
    setApiError("");
    save.mutate();
  };

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      {/* API error is kept separate from field-level validation */}
      {apiError && (
        <Alert severity="error" action={<Button size="small" onClick={handleSubmit}>Retry</Button>}>
          {apiError}
        </Alert>
      )}
      {/* Tier 2: cache banner — dropdown still usable, data may be stale */}
      {typesFromCache && (
        <Alert severity="warning">
          Showing saved leave types from your last session. The list may not include recent changes — check your connection to refresh.
        </Alert>
      )}
      {typesUnavailable ? (
        // Graceful degradation: if leave-types endpoint is unavailable, fall back to free text
        <TextField
          label="Leave Type (type manually — list unavailable)"
          value={form.leaveTypeId}
          onChange={e => setForm(p => ({ ...p, leaveTypeId: e.target.value }))}
          helperText="The leave type list could not be loaded. Type the leave type name or retry later."
          required
        />
      ) : (
        <FormControl required error={!!show("leaveTypeId")}>
          <InputLabel>Leave Type</InputLabel>
          <Select
            value={form.leaveTypeId}
            label="Leave Type"
            onChange={e => { setForm(p => ({ ...p, leaveTypeId: e.target.value })); touch("leaveTypeId"); }}
          >
            {types.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
          </Select>
          {show("leaveTypeId") && (
            <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
              {show("leaveTypeId")}
            </Typography>
          )}
        </FormControl>
      )}
      <TextField
        label="Start Date"
        type="date"
        value={form.startDate}
        onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
        onBlur={() => touch("startDate")}
        error={!!show("startDate")}
        helperText={show("startDate")}
        InputLabelProps={{ shrink: true }}
        required
      />
      <TextField
        label="End Date"
        type="date"
        value={form.endDate}
        onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
        onBlur={() => touch("endDate")}
        error={!!show("endDate")}
        helperText={show("endDate") ?? "Must be on or after the start date"}
        InputLabelProps={{ shrink: true }}
        required
      />
      <TextField
        label="Reason"
        multiline
        rows={3}
        value={form.reason}
        onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
        onBlur={() => touch("reason")}
        error={!!show("reason")}
        helperText={show("reason") ?? "Briefly describe the reason for your leave request"}
        required
      />
      {/* Submit is only disabled while the API call is in-flight — never by validation */}
      <Button variant="contained" onClick={handleSubmit} disabled={save.isPending}>
        Submit Application
      </Button>
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
    onError: (e: any) => setError(
      e.response?.data?.error?.message ??
      "Unable to reject application. Please try again or contact support."
    ),
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

  const [approveError, setApproveError] = useState("");

  const approve = useMutation({
    mutationFn: (id: string) => api.put(`/leave/applications/${id}/approve`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leave-applications"] }); setApproveError(""); },
    onError: (e: any) => setApproveError(
      e.response?.data?.error?.message ??
      "Unable to approve leave. Check the application details and try again."
    ),
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
        {approveError && (
          <Alert severity="error" sx={{ mx: 2, mt: 1 }}
            action={<Button size="small" color="inherit" onClick={() => setApproveError("")}>Dismiss</Button>}
          >
            {approveError}
          </Alert>
        )}
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
