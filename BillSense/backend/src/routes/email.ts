import { Router, Response } from "express";
import crypto from "crypto";
import { google } from "googleapis";
import { protect, AuthRequest } from "../middleware/auth";
import EmailCredential from "../models/EmailCredential";
import EmailProcessingLog from "../models/EmailProcessingLog";
import { encrypt } from "../utils/encryption";
import { GmailOAuthService } from "../services/gmailOauth";
import { EmailPollingService } from "../services/emailPolling";

const emailConfigRouter = Router();

// GET /api/email-config/status — Get current email polling status
emailConfigRouter.get("/status", protect, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const cred = await EmailCredential.findOne({ userId: req.userId });
    if (!cred) {
      return res.status(200).json({
        configured: false,
        polling_enabled: false,
        message: "Email not configured",
      });
    }

    return res.status(200).json({
      configured: true,
      polling_enabled: cred.pollingEnabled,
      email_address: cred.emailAddress,

     
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: (error as Error).message });
  }
});

// GET /api/email-config — Get email configuration
emailConfigRouter.get("/", protect, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const cred = await EmailCredential.findOne({ userId: req.userId });
    if (!cred) {
      return res.status(404).json({ message: "Email configuration not found" });
    }
    return res.status(200).json({
      id: cred._id,
      userId: cred.userId,
      email_address: cred.emailAddress,
  
   
      polling_enabled: cred.pollingEnabled,
      polling_interval_minutes: cred.pollingIntervalMinutes,
      folder_to_watch: cred.folderToWatch,
      mark_as_read: cred.markAsRead,
      isActive: cred.isActive,
      last_poll_time: cred.lastPollTime,
      last_poll_status: cred.lastPollStatus,
      lastError: cred.lastError,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/email-config — Create email configuration
emailConfigRouter.post("/", protect, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const existing = await EmailCredential.findOne({ userId: req.userId });
    if (existing) {
      return res
        .status(400)
        .json({ message: "Email configuration already exists. Use PUT to update." });
    }

    const {
      email_address,
      
      
      polling_enabled,
      polling_interval_minutes,
      folder_to_watch,
      mark_as_read,
    } = req.body;

    const cred = await EmailCredential.create({
      userId: req.userId,
      emailAddress: email_address,
    
      pollingEnabled: polling_enabled ?? false,
      pollingIntervalMinutes: polling_interval_minutes || 5,
      folderToWatch: folder_to_watch || "INBOX",
      markAsRead: mark_as_read ?? true,
      isActive: true,
    });

    return res.status(201).json(cred);
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: (error as Error).message });
  }
});

// PUT /api/email-config — Update email configuration
emailConfigRouter.put("/", protect, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
   

    const {
      email_address,
   
      polling_enabled,
      polling_interval_minutes,
      folder_to_watch,
      mark_as_read,
      is_active,
    } = req.body;
    const updateData: any = {};

if (email_address !== undefined)
  updateData.emailAddress = email_address;

if (polling_enabled !== undefined)
  updateData.pollingEnabled = polling_enabled;

if (polling_interval_minutes !== undefined)
  updateData.pollingIntervalMinutes = polling_interval_minutes;

if (folder_to_watch !== undefined)
  updateData.folderToWatch = folder_to_watch;

if (mark_as_read !== undefined)
  updateData.markAsRead = mark_as_read;

if (is_active !== undefined)
  updateData.isActive = is_active;

const updated = await EmailCredential.findOneAndUpdate(
  { userId: req.userId },
  updateData,
  { new: true }
);

    if (!updated) {
      return res.status(404).json({ message: "Email configuration not found" });
    }

  
    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: (error as Error).message });
  }
});

// DELETE /api/email-config — Delete email configuration
emailConfigRouter.delete("/", protect, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const result = await EmailCredential.findOneAndDelete({ userId: req.userId });
    if (!result) {
      return res.status(404).json({ message: "Email configuration not found" });
    }
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/email-config/test — Test email connection
emailConfigRouter.post("/test", protect, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const cred = await EmailCredential.findOne({ userId: req.userId });
    if (!cred) {
      return res.status(404).json({ message: "Email configuration not found" });
    }

    if ( cred.oauthToken) {
      const oauthService = new GmailOAuthService(cred);
      const connected = await oauthService.connect();
      if (connected) {
        return res.status(200).json({
          success: true,
          message: "Successfully connected to Gmail via OAuth! ✓",
        });
      } else {
        return res.status(400).json({
          success: false,
          detail: "OAuth connection failed. Please re-authenticate.",
        });
      }
    }}
  catch(error){
       return res.status(500).json({ message: "Server error" });
  }
})


// POST /api/email-config/poll-now — Manually trigger email polling
emailConfigRouter.post(
  "/poll-now",
  protect,
  async (req: AuthRequest, res: Response): Promise<any> => {
    try {
      const cred = await EmailCredential.findOne({ userId: req.userId });
      if (!cred) {
        return res.status(404).json({ message: "Email configuration not found" });
      }

      if (!cred.isActive) {
        return res.status(400).json({ message: "Email configuration is inactive" });
      }

      const pollingService = new EmailPollingService(String(req.userId));
      const initialized = await pollingService.init();
      if (!initialized) {
        return res.status(400).json({ message: "Failed to initialize polling service" });
      }

      const stats = await pollingService.pollEmails();
      return res.status(200).json(stats);
    } catch (error) {
      return res.status(500).json({ message: "Polling failed", error: (error as Error).message });
    }
  }
);

// POST /api/email-config/pause — Pause automatic email polling
emailConfigRouter.post("/pause", protect, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const cred = await EmailCredential.findOne({ userId: req.userId });
    if (!cred) {
      return res.status(404).json({ message: "Email configuration not found" });
    }
    cred.pollingEnabled = false;
    await cred.save();
    return res.status(200).json(cred);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/email-config/resume — Resume automatic email polling
emailConfigRouter.post(
  "/resume",
  protect,
  async (req: AuthRequest, res: Response): Promise<any> => {
    try {
      const cred = await EmailCredential.findOne({ userId: req.userId });
      if (!cred) {
        return res.status(404).json({ message: "Email configuration not found" });
      }
      cred.pollingEnabled = true;
      await cred.save();
      return res.status(200).json(cred);
    } catch (error) {
      return res.status(500).json({ message: "Server error" });
    }
  }
);

// GET /api/email-config/logs — Get email processing logs
emailConfigRouter.get("/logs", protect, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await EmailProcessingLog.find({ userId: req.userId })
      .sort({ processedAt: -1 })
      .limit(limit);
    return res.status(200).json(logs);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/email-config/gmail/auth-url — Generate Gmail OAuth URL
emailConfigRouter.get(
  "/gmail/auth-url",
  protect,
  async (req: AuthRequest, res: Response): Promise<any> => {
    try {
      const state = crypto.randomBytes(32).toString("hex");
      const authUrl = GmailOAuthService.getAuthorizationUrl(state);
      return res.status(200).json({
        auth_url: authUrl,
        state: state,
      });
    } catch (error) {
      return res.status(500).json({ message: "Server error", error: (error as Error).message });
    }
  }
);

// POST /api/email-config/gmail/callback — Receive OAuth callback
emailConfigRouter.post(
  "/gmail/callback",
  protect,
  async (req: AuthRequest, res: Response): Promise<any> => {
    try {
      const { code, state } = req.body;
      if (!code || !state) {
        return res.status(400).json({ message: "Missing code or state" });
      }

      console.log(`🔔 Gmail OAuth callback received in backend for user ${req.userId}`);

      // Exchange code for tokens
      const tokens = await GmailOAuthService.exchangeCodeForTokens(code);

      // Build temporary client to get the user's email address
      const oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        process.env.GMAIL_REDIRECT_URI || "http://localhost:3000/auth/gmail/callback"
      );
      oauth2Client.setCredentials(tokens);

      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      const profile = await gmail.users.getProfile({ userId: "me" });
      const emailAddress = profile.data.emailAddress;

      if (!emailAddress) {
        throw new Error("Could not retrieve email address from Gmail API profile");
      }

      console.log(`✅ Retrieved Gmail address: ${emailAddress}`);

      // Encrypt token payload
      const encryptedTokens = encrypt(JSON.stringify(tokens));

      // Upsert email configuration
      let cred = await EmailCredential.findOne({ userId: req.userId });
      if (cred) {
        cred.emailAddress = emailAddress;
      
        cred.oauthToken = encryptedTokens;
        if (tokens.expiry_date) {
          cred.oauthTokenExpiry = new Date(tokens.expiry_date);
        }
        // Clear legacy IMAP properties
         
        await cred.save();
        console.log(`📝 Updated existing config with Gmail OAuth for ${emailAddress}`);
      } else {
        cred = await EmailCredential.create({
          userId: req.userId,
          emailAddress: emailAddress,
         
          oauthToken: encryptedTokens,
          oauthTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
          pollingEnabled: true,
          pollingIntervalMinutes: 5,
          folderToWatch: "INBOX",
          markAsRead: true,
          isActive: true,
        });
        console.log(`📝 Created new config with Gmail OAuth for ${emailAddress}`);
      }

      return res.status(200).json({
        success: true,
        message: "Gmail account connected successfully!",
        email_address: emailAddress,
      });
    } catch (error) {
      console.error("❌ Gmail OAuth Callback handling failed:", (error as Error).message);
      return res
        .status(400)
        .json({ detail: `OAuth callback failed: ${(error as Error).message}` });
    }
  }
);

// POST /api/email-config/gmail/disconnect — Disconnect Gmail OAuth account
emailConfigRouter.post(
  "/gmail/disconnect",
  protect,
  async (req: AuthRequest, res: Response): Promise<any> => {
    try {
      const cred = await EmailCredential.findOne({ userId: req.userId });
      if (!cred) {
        return res.status(404).json({ message: "Email configuration not found" });
      }


      cred.oauthToken = undefined;
      cred.oauthTokenExpiry = undefined;
      cred.pollingEnabled = false;
      cred.isActive = false;
      await cred.save();

      return res.status(200).json({
        success: true,
        message: "Gmail account disconnected successfully",
      });
    } catch (error) {
      return res.status(500).json({ message: "Server error" });
    }
  }
);

export default emailConfigRouter;