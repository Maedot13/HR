import React, { useState } from "react";
import {
  Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  Button, Alert, Stack, Checkbox, Chip, TextField,
} from "@mui/material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/axios.js";

interface OnboardingDoc { id: string; documentType: string; isCollected: boolean; }
interface AssetAssignment { id: string; assetName: string; isAssigned: boolean; }
interface OnboardingWorkflow { id: string; applicationId: string; status: string; documents: OnboardingDoc[]; assetAssignments: AssetAssignment[]; }

function WorkflowDetail({ workflow }: { workflow: OnboardingWorkflow }) {
  const qc = useQueryClient();
  const [completeError, setCompleteError] = useState("");

  const toggleDoc = useMutation({
    mutationFn: (docId: string) => api.put(`/onboarding/${workflow.id}/documents/${docId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding", workflow.id] }),
  });

  const toggleAsset = useMutation({
    mutationFn: (assetId: string) => api.put(`/onboarding/${workflow.id}/assets/${assetId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding", workflow.id] }),
  });

  const complete = useMutation({
    mutationFn: () => api.post(`/onboarding/${workflow.id}/complete`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding", workflow.id] }),
    onError: (e: any) => setCompleteError(e.response?.data?.error?.message ?? "Cannot complete onboarding"),
  });

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6">Workflow: {workflow.applicationId}</Typography>
        <Chip label={workflow.status} color={workflow.status === "COMPLETED" ? "success" : "warning"} />
      </Stack>

      <Typography variant="subtitle1" gutterBottom>Documents</Typography>
      <Table size="small" sx={{ mb: 2 }}>
        <TableHead><TableRow><TableCell>Document</TableCell><TableCell>Collected</TableCell></TableRow></TableHead>
        <TableBody>{workflow.documents.map(doc => (
          <TableRow key={doc.id}>
            <TableCell>{doc.documentType}</TableCell>
            <TableCell>
              <Checkbox checked={doc.isCollected} disabled={workflow.status === "COMPLETED"} onChange={() => toggleDoc.mutate(doc.id)} />
            </TableCell>
          </TableRow>
        ))}</TableBody>
      </Table>

      <Typography variant="subtitle1" gutterBottom>Assets</Typography>
      <Table size="small" sx={{ mb: 2 }}>
        <TableHead><TableRow><TableCell>Asset</TableCell><TableCell>Assigned</TableCell></TableRow></TableHead>
        <TableBody>{workflow.assetAssignments.map(asset => (
          <TableRow key={asset.id}>
            <TableCell>{asset.assetName}</TableCell>
            <TableCell>
              <Checkbox checked={asset.isAssigned} disabled={workflow.status === "COMPLETED"} onChange={() => toggleAsset.mutate(asset.id)} />
            </TableCell>
          </TableRow>
        ))}</TableBody>
      </Table>

      {completeError && <Alert severity="error" sx={{ mb: 1 }}>{completeError}</Alert>}
      {workflow.status !== "COMPLETED" && (
        <Button variant="contained" color="success" onClick={() => { setCompleteError(""); complete.mutate(); }} disabled={complete.isPending}>
          Complete Onboarding
        </Button>
      )}
    </Paper>
  );
}

export default function OnboardingPage() {
  const [workflowId, setWorkflowId] = useState("");
  const [searchId, setSearchId] = useState("");

  const { data, isLoading } = useQuery<{ data: OnboardingWorkflow }>({
    queryKey: ["onboarding", workflowId],
    queryFn: () => api.get(`/onboarding/${workflowId}`).then(r => r.data),
    enabled: !!workflowId,
  });

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Onboarding</Typography>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField label="Workflow ID" size="small" value={searchId} onChange={e => setSearchId(e.target.value)} />
        <Button variant="outlined" onClick={() => setWorkflowId(searchId)}>Load</Button>
      </Stack>
      {isLoading && <Typography>Loading...</Typography>}
      {data?.data && <WorkflowDetail workflow={data.data} />}
      {workflowId && !isLoading && !data?.data && <Alert severity="info">No workflow found for this ID</Alert>}
    </Box>
  );
}
