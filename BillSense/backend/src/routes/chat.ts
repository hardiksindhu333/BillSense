import { Router, Response } from "express";
import { protect, AuthRequest } from "../middleware/auth";
import axios from "axios";

const chatRouter = Router();
const RAG_URL = process.env.RAG_SERVICE_URL || "http://localhost:8000";

// POST /api/chat/query
chatRouter.post("/query", protect, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { question } = req.body;
    const response = await axios.post(`${RAG_URL}/query`, {
      question,
      user_id: req.userId,
    });
    return res.status(200).json(response.data);
  } catch (error) {
    return res.status(500).json({ message: "RAG service error" });
  }
});

// GET /api/chat/status
chatRouter.get("/status", protect, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const response = await axios.get(`${RAG_URL}/status`);
    return res.status(200).json(response.data);
  } catch (error) {
    return res.status(500).json({ message: "RAG service unavailable" });
  }
});

export default chatRouter;