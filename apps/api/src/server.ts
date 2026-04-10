import "./env.js";
import app from "./app.js";

const PORT = Number(process.env.PORT ?? 3001);

const server = app.listen(PORT, () => {
  console.log(`HRMS API listening on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received — shutting down gracefully");
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});

export default server;
