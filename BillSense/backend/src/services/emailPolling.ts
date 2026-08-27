import fs from "fs";
import path from "path";
import axios from "axios";
import mongoose from "mongoose";

import { simpleParser } from "mailparser";


import EmailCredential, { IEmailCredential } from "../models/EmailCredential";
import EmailProcessingLog from "../models/EmailProcessingLog";
import Invoice from "../models/Invoice";
import { decrypt } from "../utils/encryption";
import { extractInvoiceData } from "./gemini";
import { GmailOAuthService } from "./gmailOauth";

export class EmailPollingService {
  private userId: mongoose.Types.ObjectId; // id of user
  private credential!: IEmailCredential; // credential of user

  private gmailOAuthService?: GmailOAuthService; // helper service that can talk to the gmail

  private static SUPPORTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".txt"];

  constructor(userId: string | mongoose.Types.ObjectId) {
    this.userId = typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;
  }

  /**
   * Load credential from DB
   */
  public async init(): Promise<boolean> {
    const cred = await EmailCredential.findOne({ userId: this.userId });
    if (!cred) {
      console.error(`❌ No email credentials found for user ${this.userId}`);
      return false;
    }
    this.credential = cred;
    this.gmailOAuthService = new GmailOAuthService(this.credential);

 

    return true;
  }

  /**
   * Run polling cycle
   */
  public async pollEmails(): Promise<any> {
    const stats = {
      emails_checked: 0,
      invoices_created: 0,
      errors: 0,
      status: "unknown",
    };

    if (!this.credential) {
      const initialized = await this.init();
      if (!initialized) {
        stats.status = "no_credential";
        return stats;
      }
    }

    try {
      
        return await this.pollGmailOAuth(stats);
      
    } catch (error) {
      console.error(`❌ Polling error for user ${this.userId}:`, (error as Error).message);
      stats.status = "error";
      this.credential.lastPollStatus = "error";
      this.credential.lastError = (error as Error).message;
      await this.credential.save();
      return stats;
    }
  }

  /**
   * Gmail OAuth polling
   */
  private async pollGmailOAuth(stats: any): Promise<any> {
    const connected = await this.gmailOAuthService!.connect();
    if (!connected) {
      stats.status = "connection_failed";
      return stats;
    }

    // Get last 5 unread messages
    const messages = await this.gmailOAuthService!.getUnreadMessages(5);
    stats.emails_checked = messages.length;

    if (messages.length === 0) {
      console.log(`📭 No new emails found for Gmail account ${this.credential.emailAddress}`);
      stats.status = "no_emails";
      this.credential.lastPollStatus = "success";
      this.credential.lastPollTime = new Date();
      this.credential.lastError = undefined;
      await this.credential.save();
      return stats;
    }

    console.log(
      `📧 Found ${messages.length} unread email(s) for Gmail account ${this.credential.emailAddress}`
    );

    for (const msgData of messages) {
      const details = this.gmailOAuthService!.getMessageDetails(msgData);

      // Check for duplicate processing
      const duplicate = await EmailProcessingLog.findOne({
        userId: this.userId,
        emailMessageId: details.messageId,
        status: "success",
      });

      if (duplicate) {
        console.log(`⏭️ Skipping already processed email: ${details.messageId}`);
        continue;
      }

      const log = new EmailProcessingLog({
        userId: this.userId,
        emailCredentialId: this.credential._id,
        emailMessageId: details.messageId,
        emailSubject: details.subject,
        emailFrom: details.from,
        emailDate: new Date(details.date),
        status: "processing",
      });

      try {
        console.log(`📨 Processing Gmail Email: ${details.subject}`);
        const attachments = await this.gmailOAuthService!.getMessageAttachments(details.id);
        log.attachmentsFound = attachments.length;

        // Filter supported attachments
        const supported = attachments.filter((att) => {
          const ext = path.extname(att.filename).toLowerCase();
          return EmailPollingService.SUPPORTED_EXTENSIONS.includes(ext);
        });

        log.attachmentsFound = supported.length;

        if (supported.length === 0) {
          console.log("  ℹ️ No supported invoice attachments found");
          log.status = "success";
          log.errorMessage = "No attachments";
          await log.save();

          if (this.credential.markAsRead) {
            await this.gmailOAuthService!.markAsRead(details.id);
          }
          continue;
        }

        let invoicesCreated = 0;
        for (const att of supported) {
          const success = await this.processAttachment(att.filename, att.data);
          if (success) {
            invoicesCreated++;
            log.attachmentsProcessed++;
          }
        }

        log.invoicesCreated = invoicesCreated;
        stats.invoices_created += invoicesCreated;

        if (log.attachmentsProcessed === log.attachmentsFound) {
          log.status = "success";
        } else if (log.attachmentsProcessed > 0) {
          log.status = "partial";
          log.errorMessage = `Processed ${log.attachmentsProcessed}/${log.attachmentsFound} attachments`;
        } else {
          log.status = "failed";
          log.errorMessage = "No attachments could be processed";
          stats.errors++;
        }

        await log.save();

        if (
          this.credential.markAsRead &&
          (log.status === "success" || log.status === "partial")
        ) {
          await this.gmailOAuthService!.markAsRead(details.id);
          console.log("  ✓ Marked Gmail message as read");
        }
      } catch (error) {
        console.error(
          `❌ Error processing Gmail message ${details.id}:`,
          (error as Error).message
        );
        log.status = "failed";
        log.errorMessage = (error as Error).message;
        await log.save();
        stats.errors++;
      }
    }

    this.credential.lastPollTime = new Date();
    this.credential.lastPollStatus = "success";
    this.credential.lastError = undefined;
    await this.credential.save();

    stats.status = "success";
    return stats;
  }

  


  private async processAttachment(filename: string, fileBytes: Buffer): Promise<boolean> {
    try {
      console.log(`  🤖 Processing attachment "${filename}" with Gemini AI...`);

      // Determine mime-type
      const ext = path.extname(filename).toLowerCase();
      let mimeType = "application/octet-stream";
      if (ext === ".pdf") mimeType = "application/pdf";
      else if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
      else if (ext === ".png") mimeType = "image/png";
      else if (ext === ".txt") mimeType = "text/plain";

      // Ensure uploads directory exists
      const uploadsDir = path.join(__dirname, "../../uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Generate a unique file name
      const uniqueFilename = `${Date.now()}-${filename}`;
    
      const filePath = path.join(uploadsDir, uniqueFilename);

      // Write attachment to uploads folder on disk
      fs.writeFileSync(filePath, fileBytes);
      const fileUrl = `/uploads/${uniqueFilename}`;

      // Call Gemini extraction service
      const extracted = await extractInvoiceData(filePath, mimeType);

      // Save invoice to MongoDB
      const invoice = await Invoice.create({
        userId: this.userId,
        ...extracted,
        originalFilename: filename,
        fileUrl,
        extractedByAI: true,
        status: "pending", // Always pending, requires human approval
      });

      console.log(
        `  ✅ Invoice created in MongoDB: ${invoice._id} - ${invoice.vendorName}`
      );

      // Index into ChromaDB (RAG Service)
      const RAG_URL = process.env.RAG_SERVICE_URL || "http://localhost:8000";
      const absolutePath = path.resolve(filePath);

      axios
        .post(`${RAG_URL}/index`, {
          invoice_id: invoice._id.toString(),
          file_path: absolutePath,
          vendor_name: invoice.vendorName || "Unknown",
          amount_due: invoice.amountDue || 0,
          status: invoice.status,
        })
        .then(() => console.log(`  📊 RAG Indexing successful for invoice ${invoice._id}`))
        .catch((err) => console.error("  ❌ RAG Indexing failed:", err.message));

      return true;
    } catch (err) {
      console.error(`  ❌ Failed to process attachment "${filename}":`, (err as Error).message);
      return false;
    }
  }
}