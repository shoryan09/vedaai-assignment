import axios from "axios";
import type { Assignment, CreateAssignmentInput } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { "Content-Type": "application/json" },
});

export const createAssignment = async (
  data: CreateAssignmentInput
): Promise<{ assignmentId: string; jobId: string; status: string }> => {
  const res = await api.post("/assignments", data);
  return res.data;
};

export const getAssignments = async (): Promise<Assignment[]> => {
  const res = await api.get("/assignments");
  return res.data;
};

export const getAssignment = async (id: string): Promise<Assignment> => {
  const res = await api.get(`/assignments/${id}`);
  return res.data;
};

export const deleteAssignment = async (id: string): Promise<void> => {
  await api.delete(`/assignments/${id}`);
};

export const uploadFile = async (file: File): Promise<{ text: string; filename: string }> => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await api.post("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const requestPdf = async (
  assignmentId: string
): Promise<{ status: string; pdfJobId?: string; downloadUrl?: string; cached?: boolean }> => {
  const res = await api.post(`/assignments/${assignmentId}/pdf`);
  return res.data;
};

export const getPdfDownloadUrl = (assignmentId: string): string => {
  return `${API_BASE}/api/assignments/${assignmentId}/pdf`;
};

export const regenerateAssignment = async (
  assignmentId: string
): Promise<{ assignmentId: string; jobId: string; status: string }> => {
  const res = await api.post(`/assignments/${assignmentId}/regenerate`);
  return res.data;
};