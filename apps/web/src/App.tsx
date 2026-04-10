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
                          <Route path="/" element={<Navigate to="/employees" replace />} />
                          <Route path="/org/*" element={<OrgPage />} />
                          <Route path="/employees/*" element={<EmployeesPage />} />
                          <Route path="/recruitment/*" element={<RecruitmentPage />} />
                          <Route path="/onboarding/*" element={<OnboardingPage />} />
                          <Route path="/timetable/*" element={<TimetablePage />} />
                          <Route path="/leave/*" element={<LeavePage />} />
                          <Route path="/appraisal/*" element={<AppraisalPage />} />
                          <Route path="/training/*" element={<TrainingPage />} />
                          <Route path="/payroll/*" element={<PayrollPage />} />
                          <Route path="/clearance/*" element={<ClearancePage />} />
                          <Route path="/experience-letters/*" element={<ExperienceLettersPage />} />
                          <Route path="/activity-log/*" element={<ActivityLogPage />} />
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
