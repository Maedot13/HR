import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Button, Container, TextField, Typography, Alert, Paper,
  InputAdornment, IconButton,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useAuth } from "../contexts/AuthContext.js";

export default function ChangePasswordPage() {
  const { changePassword, user } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // When on a temp password the backend skips the current-password check,
  // so we don't need to ask for it.
  const isTempLogin = user?.isTempPassword ?? false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      navigate("/");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? "Failed to change password";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xs">
      <Box sx={{ mt: 8, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Paper sx={{ p: 4, width: "100%" }}>
          <Typography variant="h6" gutterBottom>
            {isTempLogin ? "Set Your Password" : "Change Password"}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {isTempLogin
              ? "Your account was created with a temporary password. Please set a permanent one now."
              : "Enter your current password, then choose a new one."}
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box component="form" onSubmit={handleSubmit}>
            {!isTempLogin && (
              <TextField
                label="Current Password"
                type="password"
                fullWidth
                margin="normal"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoFocus
              />
            )}
            <TextField
              label="New Password"
              type={showNew ? "text" : "password"}
              fullWidth
              margin="normal"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoFocus={isTempLogin}
              inputProps={{ minLength: 8 }}
              helperText="At least 8 characters"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowNew(v => !v)} edge="end" size="small">
                      {showNew ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button type="submit" fullWidth variant="contained" sx={{ mt: 2 }} disabled={loading}>
              {loading ? "Saving…" : "Set New Password"}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}
