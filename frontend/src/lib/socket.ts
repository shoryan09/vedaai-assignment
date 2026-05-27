import { io, Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(API_URL, {
      transports: ["websocket"],
      autoConnect: true,
    });
  }
  return socket;
};

export const subscribeToJob = (jobId: string) => {
  const s = getSocket();
  s.emit("subscribe", jobId);
};

export const subscribeToPdfJob = (pdfJobId: string) => {
  const s = getSocket();
  s.emit("subscribePdf", pdfJobId);
};