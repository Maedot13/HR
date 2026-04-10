import React, { useState } from "react";
import {
  Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  Button, TextField, Alert, Stack, Chip, TablePagination, MenuItem, Select,
  InputLabel, FormControl,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import api from "../lib/axios.js";

interface ActivityLog { id: string; actingUserId: string; actingRole: string; actionType: string; resourceType: string; resourceId: string; timestamp: string; ipAddress: string; }

const ACTION_TYPES = ["", "LOGIN", "LOGOUT", "EMPLOYEE_CREATED", "EMPLOYEE_UPDATED", "LEAVE_APPROVED", "LEAVE_REJECTED", "CLEARANCE_TASK_APPROVED", "ACCOUNT_DEACTIVATED"];
const RESOURCE_TYPES = ["", "Employee", "Campus", "College", "Department", "Unit", "JobPosting", "Application", "LeaveApplication", "Evaluation", "TrainingAssignment", "PayrollReport", "ClearanceRecord", "ExperienceLetter"];

export default function ActivityLogPage() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [filters, setFilters] = useState({ userId: "", actionType: "", resourceType: "", startDate: "", endDate: "", campusId: "" });
  const [applied, setApplied] = useState(filters);

  const { data, isLoading, error } = useQuery<{ data: ActivityLog[] }>({
    queryKey: ["activity-logs", applied, page, rowsPerPage],
    queryFn: () => api.get("/activity-logs", {
      params: {
        userId: applied.userId || undefined,
        actionType: applied.actionType || undefined,
        resourceType: applied.resourceType || undefined,
        startDate: applied.startDate || undefined,
        endDate: applied.endDate || undefined,
        campusId: applied.campusId || undefined,
      },
    }).then(r => r.data),
  });

  const logs: ActivityLog[] = data?.data ?? [];
  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => setFilters(p => ({ ...p, [field]: e.target.value }));

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Activity Log</Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <TextField label="User ID" size="small" value={filters.userId} onChange={f("userId")} sx={{ minWidth: 140 }} />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Action Type</InputLabel>
            <Select value={filters.actionType} label="Action Type" onChange={e => setFilters(p => ({ ...p, actionType: e.target.value }))}>
              {ACTION_TYPES.map(t => <MenuItem key={t} value={t}>{t || "All"}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Resource Type</InputLabel>
            <Select value={filters.resourceType} label="Resource Type" onChange={e => setFilters(p => ({ ...p, resourceType: e.target.value }))}>
              {RESOURCE_TYPES.map(t => <MenuItem key={t} value={t}>{t || "All"}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Start Date" type="date" size="small" value={filters.startDate} onChange={f("startDate")} InputLabelProps={{ shrink: true }} />
          <TextField label="End Date" type="date" size="small" value={filters.endDate} onChange={f("endDate")} InputLabelProps={{ shrink: true }} />
          <TextField label="Campus ID" size="small" value={filters.campusId} onChange={f("campusId")} sx={{ minWidth: 140 }} />
          <Button variant="contained" onClick={() => { setPage(0); setApplied(filters); }}>Apply</Button>
          <Button variant="outlined" onClick={() => { const e = { userId: "", actionType: "", resourceType: "", startDate: "", endDate: "", campusId: "" }; setFilters(e); setApplied(e); setPage(0); }}>Clear</Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>Failed to load activity logs</Alert>}

      <Paper>
        {isLoading ? <Typography sx={{ p: 2 }}>Loading...</Typography> : (
          <>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp</TableCell><TableCell>User</TableCell><TableCell>Role</TableCell>
                  <TableCell>Action</TableCell><TableCell>Resource</TableCell><TableCell>Resource ID</TableCell><TableCell>IP</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{new Date(log.timestamp).toLocaleString()}</TableCell>
                    <TableCell>{log.actingUserId}</TableCell>
                    <TableCell>{log.actingRole}</TableCell>
                    <TableCell><Chip label={log.actionType} size="small" /></TableCell>
                    <TableCell>{log.resourceType}</TableCell>
                    <TableCell sx={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>{log.resourceId}</TableCell>
                    <TableCell>{log.ipAddress}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {logs.length === 0 && <Typography sx={{ p: 2, textAlign: "center", color: "text.secondary" }}>No logs found</Typography>}
            <TablePagination
              component="div"
              count={-1}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          </>
        )}
      </Paper>
    </Box>
  );
}
