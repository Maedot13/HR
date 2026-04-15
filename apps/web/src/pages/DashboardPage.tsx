import React from "react";
import {
  Box, Grid, Card, CardActionArea, CardContent, Typography, Chip,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.js";

const MODULES = [
  { label: "Org Hierarchy",       path: "/org",              desc: "Manage campuses, colleges, departments and units." },
  { label: "Employees",           path: "/employees",        desc: "Create, edit and activate employee profiles." },
  { label: "Recruitment",         path: "/recruitment",      desc: "Post jobs and track applicant pipelines." },
  { label: "Onboarding",          path: "/onboarding",       desc: "Manage onboarding documents and asset assignments." },
  { label: "Timetable",           path: "/timetable",        desc: "View and manage teaching schedules." },
  { label: "Leave",               path: "/leave",            desc: "Apply for leave and manage balances." },
  { label: "Appraisal",           path: "/appraisal",        desc: "Run performance evaluations." },
  { label: "Training",            path: "/training",         desc: "Assign and track training programs." },
  { label: "Payroll",             path: "/payroll",          desc: "Generate and export payroll reports." },
  { label: "Clearance",           path: "/clearance",        desc: "Initiate and track employee clearance." },
  { label: "Experience Letters",  path: "/experience-letters", desc: "Generate and download experience letters." },
  { label: "Activity Log",        path: "/activity-log",     desc: "Audit all system actions." },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Welcome back 👋
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Logged in as&nbsp;
          <Chip label={user?.role?.replace(/_/g, " ")} size="small" color="primary" sx={{ ml: 0.5 }} />
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {MODULES.map((mod) => (
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
