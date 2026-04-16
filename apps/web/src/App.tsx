import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { CssBaseline, CircularProgress, Box } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import theme from "./theme.js";
import { AuthProvider } from "./contexts/AuthContext.js";
import ProtectedRoute from "./components/ProtectedRoute.js";
import Layout from "./components/Layout.js";
import LoginPage from "./pages/LoginPage.js";
import ChangePasswordPage from "./pages/ChangePasswordPage.js";

// Lazy-loaded module pages
const OrgPage = lazy(() => import("./pages/OrgPage.js"));
const DashboardPage = lazy(() => import("./pages/DashboardPage.js"));
const EmployeesPage = lazy(() => import("./pages/EmployeesPage.js"));
const RecruitmentPage = lazy(() => import("./pages/RecruitmentPage.js"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage.js"));
const TimetablePage = lazy(() => import("./pages/TimetablePage.js"));
const LeavePage = lazy(() => import("./pages/LeavePage.js"));
const AppraisalPage = lazy(() => import("./pages/AppraisalPage.js"));
const TrainingPage = lazy(() => import("./pages/TrainingPage.js"));
const PayrollPage = lazy(() => import("./pages/PayrollPage.js"));
const ClearancePage = lazy(() => import("./pages/ClearancePage.js"));
const ExperienceLettersPage = lazy(() => import("./pages/ExperienceLettersPage.js"));
const ActivityLogPage = lazy(() => import("./pages/ActivityLogPage.js"));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });

function LoadingFallback() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
      <CircularProgress />
    </Box>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/change-password" element={<ChangePasswordPage />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Suspense fallback={<LoadingFallback />}>
                        <Routes>
                          <Route path="/" element={<Navigate to="/dashboard" replace />} />
                          <Route path="/dashboard" element={<DashboardPage />} />
                          <Route path="/org/*"               element={<ProtectedRoute permission="college:create"><OrgPage /></ProtectedRoute>} />
                          <Route path="/employees/*"         element={<ProtectedRoute permission="employee:create"><EmployeesPage /></ProtectedRoute>} />
                          <Route path="/recruitment/*"       element={<ProtectedRoute permission="job_posting:create"><RecruitmentPage /></ProtectedRoute>} />
                          <Route path="/onboarding/*"        element={<ProtectedRoute permission="onboarding:read"><OnboardingPage /></ProtectedRoute>} />
                          <Route path="/timetable/*"         element={<ProtectedRoute permission="schedule:read"><TimetablePage /></ProtectedRoute>} />
                          <Route path="/leave/*"             element={<ProtectedRoute permission="leave:read"><LeavePage /></ProtectedRoute>} />
                          <Route path="/appraisal/*"         element={<ProtectedRoute permission="evaluation:read"><AppraisalPage /></ProtectedRoute>} />
                          <Route path="/training/*"          element={<ProtectedRoute permission="training:read"><TrainingPage /></ProtectedRoute>} />
                          <Route path="/payroll/*"           element={<ProtectedRoute permission="payroll:read"><PayrollPage /></ProtectedRoute>} />
                          <Route path="/clearance/*"         element={<ProtectedRoute permission="clearance:initiate"><ClearancePage /></ProtectedRoute>} />
                          <Route path="/experience-letters/*" element={<ProtectedRoute permission="experience_letter:generate"><ExperienceLettersPage /></ProtectedRoute>} />
                          <Route path="/activity-log/*"      element={<ProtectedRoute permission="activity_log:read"><ActivityLogPage /></ProtectedRoute>} />
                        </Routes>
                      </Suspense>
                    </Layout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
