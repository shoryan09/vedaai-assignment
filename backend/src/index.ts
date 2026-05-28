import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import { connectDB } from "./config/db";
import { redisConnection } from "./config/redis";

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  socket.on("subscribe", (jobId: string) => {
    socket.join(`job:${jobId}`);
    console.log(`Socket ${socket.id} subscribed to job:${jobId}`);
  });

  socket.on("subscribePdf", (jobId: string) => {
    socket.join(`pdf:${jobId}`);
    console.log(`Socket ${socket.id} subscribed to pdf:${jobId}`);
  });

  socket.on("disconnect", () => {
    console.log("🔌 Client disconnected:", socket.id);
  });
});

export { io };

const PORT = process.env.PORT || 4000;

const start = async () => {
  await connectDB();
  redisConnection.ping().then(() => console.log("✅ Redis ping OK"));

  const assignmentsRouter = (await import("./routes/assignments")).default;
  const uploadRouter = (await import("./routes/upload")).default;
  app.use("/api/assignments", assignmentsRouter);
  app.use("/api/upload", uploadRouter);

  await import("./workers/generationWorker");
  const { startPdfWorker } = await import("./workers/pdfWorker");
  startPdfWorker();

  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
};

start();