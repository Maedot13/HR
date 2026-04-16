import React from "react";
import {
  Box, Grid, Card, CardActionArea, CardContent, Typography, Chip, Stack,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.js";
import { usePermissions } from "../hooks/usePermissions.js";

// permission: null = shown to everyone; otherwise must be in effective permission set
const MODULES = [
  { label: "Org Hierarchy",       path: "/org",              permission: "college:create",              desc: "Manage campuses, colleges, departments and units." },
  { label: "Employees",           path: "/employees",        permission: "employee:create",             desc: "Create, edit and activate employee profiles." },
  { label: "Recruitment",         path: "/recruitment",      permission: "job_posting:create",          desc: "Post jobs and track applicant pipelines." },
  { label: "Onboarding",          path: "/onboarding",       permission: "onboarding:read",             desc: "Manage onboarding documents and asset assignments." },
  { label: "Timetable",           path: "/timetable",        permission: "schedule:read",               desc: "View and manage teaching schedules." },
  { label: "Leave",               path: "/leave",            permission: "leave:read",                  desc: "Apply for leave and manage balances." },
  { label: "Appraisal",           path: "/appraisal",        permission: "evaluation:read",             desc: "Run performance evaluations." },
  { label: "Training",            path: "/training",         permission: "training:read",               desc: "Assign and track training programs." },
  { label: "Payroll",             path: "/payroll",          permission: "payroll:read",                desc: "Generate and export payroll reports." },
  { label: "Clearance",           path: "/clearance",        permission: "clearance:initiate",          desc: "Initiate and track employee clearance." },
  { label: "Experience Letters",  path: "/experience-letters", permission: "experience_letter:generate",  desc: "Generate and download experience letters." },
  { label: "Activity Log",        path: "/activity-log",     permission: "activity_log:read",           desc: "Audit all system actions." },
] as const;

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const permissions = usePermissions();

  const visibleModules = MODULES.filter((m) => permissions.has(m.permission));

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Welcome back 👋
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body1" color="text.secondary">Logged in as</Typography>
          <Chip label={user?.role?.replace(/_/g, " ")} size="small" color="primary" />
          {user?.specialPrivilege && (
            <Chip label={user.specialPrivilege.replace(/_/g, " ")} size="small" color="secondary" />
          )}
        </Stack>
      </Box>

      <Grid container spacing={2}>
        {visibleModules.map((mod) => (
          <Grid item xs={12} sm={6} md={4} key={mod.path}>
            <Card variant="outlined" sx={{ height: "100%", "&:hover": { borderColor: "primary.main" } }}>
              <CardActionArea sx={{ height: "100%" }} onClick={() => navigate(mod.path)}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    {mod.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {mod.desc}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
