
import { Router, Request, Response } from "express";
import User from "../models/User"
import { generateToken } from "../utils/jwt";

const Authrouter = Router();

// POST /api/auth/oauth/callback
Authrouter.post("/oauth/callback", async (req: Request, res: Response): Promise<any> => {
  // the async fn return a promise and when the promise resolve , the value can be of any type 
  try {
    console.log("entered")
    const { email, name, image } = req.body;
        let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({ email, name, image });
    }

    const token = generateToken(user._id.toString());

    return res.status(200).json({ token, user });

  } catch (error) {
    console.log(error)
    return res.status(500).json({ message: "Server error" });
  }
});
import { protect, AuthRequest } from "../middleware/auth";

// GET /api/auth/me
Authrouter.get("/me", protect, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const user = await User.findById(req.userId).select("-__v");  // .select("- ") means exclude this field 
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
});

export default Authrouter;