import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Box, Typography, Button } from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import { useAuth } from "../contexts/AuthContext.js";
import { usePermissions } from "../hooks/usePermissions.js";

function AccessDenied() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 2 }}>
      <LockIcon sx={{ fontSize: 64, color: "text.disabled" }} />
      <Typography variant="h5" fontWeight={700}>Access Denied</Typography>
      <Typography variant="body1" color="text.secondary">
        You do not have permission to view this page.
      </Typography>
      <Button variant="outlined" onClick={() => window.history.back()}>Go Back</Button>
    </Box>
  );
}

interface Props {
  children: React.ReactNode;
  /** If supplied, renders AccessDenied when the user lacks this permission code */
  permission?: string;
}

export default function ProtectedRoute({ children, permission }: Props) {
  const { user } = useAuth();
  const permissions = usePermissions();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // First-login enforcement: redirect to change-password
  if (user.isTempPassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  // Route-level permission check — renders 403 view, no redirect
  if (permission && !permissions.has(permission)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}
