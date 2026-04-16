import React, { useState } from "react";
import {
  AppBar, Box, CssBaseline, Drawer, IconButton, List, ListItemButton,
  ListItemText, Toolbar, Typography, Divider, Chip,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.js";
import { usePermissions } from "../hooks/usePermissions.js";

const DRAWER_WIDTH = 240;

// permission: null = visible to every authenticated user
// permission: "<code>" = visible only when the user's effective permissions include that code
const NAV_ITEMS = [
  { label: "Dashboard",          path: "/dashboard",          permission: null },
  { label: "Org Hierarchy",      path: "/org",                permission: "college:create" },   // SA + ADMIN only
  { label: "Employees",          path: "/employees",          permission: "employee:create" },  // SA + ADMIN + HR
  { label: "Recruitment",        path: "/recruitment",        permission: "job_posting:create" },
  { label: "Onboarding",         path: "/onboarding",         permission: "onboarding:read" },
  { label: "Timetable",          path: "/timetable",          permission: "schedule:read" },    // all roles
  { label: "Leave",              path: "/leave",              permission: "leave:read" },       // all roles
  { label: "Appraisal",          path: "/appraisal",          permission: "evaluation:read" },  // all roles
  { label: "Training",           path: "/training",           permission: "training:read" },    // all roles
  { label: "Payroll",            path: "/payroll",            permission: "payroll:read" },     // HR_OFFICER only
  { label: "Clearance",          path: "/clearance",          permission: "clearance:initiate" }, // SA + ADMIN + HR
  { label: "Experience Letters", path: "/experience-letters", permission: "experience_letter:generate" }, // HR only
  { label: "Activity Log",       path: "/activity-log",       permission: "activity_log:read" }, // SA only
] as const;

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const permissions = usePermissions();

  // Filter nav items to only those the user has permission to see
  const visibleItems = NAV_ITEMS.filter(
    (item) => item.permission === null || permissions.has(item.permission)
  );

  const isSelected = (path: string) =>
    path === "/dashboard"
      ? location.pathname === "/dashboard" || location.pathname === "/"
      : location.pathname === path || location.pathname.startsWith(path + "/");

  const drawer = (
    <Box>
      <Toolbar>
        <Typography variant="subtitle1" fontWeight="bold">HRMS — BDU</Typography>
      </Toolbar>
      <Divider />
      <List dense>
        {visibleItems.map((item) => (
          <ListItemButton
            key={item.path}
            selected={isSelected(item.path)}
            onClick={() => navigate(item.path)}
          >
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
      <Divider />
      <List dense>
        <ListItemButton onClick={() => logout().then(() => navigate("/login"))}>
          <ListItemText primary="Logout" />
        </ListItemButton>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(!mobileOpen)} sx={{ mr: 2, display: { sm: "none" } }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
            Bahir Dar University HRMS
          </Typography>
          <Typography variant="body2" sx={{ mr: 1 }}>{user?.role?.replace(/_/g, " ")}</Typography>
          {user?.specialPrivilege && (
            <Chip
              label={user.specialPrivilege.replace(/_/g, " ")}
              size="small"
              color="secondary"
              sx={{ ml: 0.5 }}
            />
          )}
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}>
        <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)} ModalProps={{ keepMounted: true }} sx={{ display: { xs: "block", sm: "none" }, "& .MuiDrawer-paper": { width: DRAWER_WIDTH } }}>
          {drawer}
        </Drawer>
        <Drawer variant="permanent" sx={{ display: { xs: "none", sm: "block" }, "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" } }} open>
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` } }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
