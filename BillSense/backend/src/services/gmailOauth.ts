import { google } from "googleapis";
import { IEmailCredential } from "../models/EmailCredential";
import { encrypt, decrypt } from "../utils/encryption";

export class GmailOAuthService {
  private credential: IEmailCredential; // user details 
  public oauth2Client: any; // actual messenger that talks to google 
  private gmail: any; //

  // Gmail API scopes
  private static SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]; // permissions


  constructor(credential: IEmailCredential) {  //Creates a Google OAuth client.
    this.credential = credential;
    this.oauth2Client = new google.auth.OAuth2( //"Hey Google, I want to use your OAuth system."
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI || "http://localhost:3000/auth/gmail/callback"
    ); // this is an empty wallet object that knows my client id , secret and redirect url
  }

  /**
   * Generate Gmail OAuth authorization URL
   */
  public static getAuthorizationUrl(state: string): string { 
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI || "http://localhost:3000/auth/gmail/callback"
    );

    return oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: this.SCOPES,
      prompt: "consent", // Force consent screen to retrieve refresh token
      state: state,
    }); // this fn is basically returning a url , when user click this url , google ui opens up and user grants us permisiion

  }

  public static async exchangeCodeForTokens(code: string): Promise<any> { 
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI || "http://localhost:3000/auth/gmail/callback"
    );

    const { tokens } = await oauth2Client.getToken(code);
    return tokens; // this fn makes an empty wallet again with client details and ask google that , (u gave this code to this client)
    // now give me the tokens for this client -> access and refresh
  }


  public async connect(): Promise<boolean> {
    try {
      if (!this.credential.oauthToken) {
        console.error("❌ No OAuth token found for", this.credential.emailAddress);
        return false;
      }

      
      const tokenDecrypted = decrypt(this.credential.oauthToken);
      const tokens = JSON.parse(tokenDecrypted);
    
      this.oauth2Client.setCredentials(tokens); // the wallet is no longer empty here man 

      // Listen for token refresh events to update the DB automatically
      this.oauth2Client.on("tokens", async (newTokens: any) => { // this is a listener that catches an event emitted by google -> tokens
        console.log("🔄 Gmail OAuth: Received refreshed credentials");
        const mergedTokens = { ...tokens, ...newTokens };
        this.credential.oauthToken = encrypt(JSON.stringify(mergedTokens));
        if (mergedTokens.expiry_date) {
          this.credential.oauthTokenExpiry = new Date(mergedTokens.expiry_date);
        }
        await this.credential.save();
        console.log("✅ Refreshed Gmail OAuth token saved in DB");
      });

      this.gmail = google.gmail({ version: "v1", auth: this.oauth2Client }); // gmail api object created 

      // Test API call to verify connection
      await this.gmail.users.getProfile({ userId: "me" });
      return true;
    } catch (error) {
      console.error("❌ Gmail API connection failed:", (error as Error).message);
      this.credential.lastError = (error as Error).message;
      this.credential.lastPollStatus = "error";
      await this.credential.save();
      return false;
    }
  }

  
  public async getUnreadMessages(maxResults = 5): Promise<any[]> {
    if (!this.gmail) {
      throw new Error("Not connected to Gmail API. Call connect() first.");
    }

    try {
      const response = await this.gmail.users.messages.list({
        userId: "me",
        q: "is:unread",
        maxResults: maxResults,
      });

      const messages = response.data.messages || [];
      const fullMessages: any[] = [];

      for (const msg of messages) {
        const msgDetails = await this.gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "full",
        });
        fullMessages.push(msgDetails.data);
      }

      return fullMessages;
    } catch (error) {
      console.error("❌ Error fetching Gmail messages:", (error as Error).message);
      return [];
    }
  }

  /**
   * Get attachments for a Gmail message
   */
  public async getMessageAttachments(
    messageId: string
  ): Promise<Array<{ filename: string; data: Buffer }>> {
    if (!this.gmail) {
      throw new Error("Not connected to Gmail API. Call connect() first.");
    }

    try {
      const message = await this.gmail.users.messages.get({ 
        userId: "me", // me means connected users gmail id 
        id: messageId,
        format: "full",
      });

      const attachments: Array<{ filename: string; data: Buffer }> = [];
      const parts = message.data.payload?.parts || [];// array of ids 

      // Recursive parts search in case of nested multi-parts
      const findAttachments = async (payloadParts: any[]) => {
        for (const part of payloadParts) {
          if (part.filename && part.body?.attachmentId) {
            const filename = part.filename;
            const attachmentId = part.body.attachmentId;

            const attResponse = await this.gmail.users.messages.attachments.get({
              userId: "me",
              messageId: messageId,
              id: attachmentId,
            });

            const base64Data = attResponse.data.data;
            if (base64Data) {
              const buffer = Buffer.from(base64Data, "base64");
              attachments.push({ filename, data: buffer });
            }
          } else if (part.parts) {
            await findAttachments(part.parts);
          }
        }
      };

      await findAttachments(parts);
      return attachments;
    } catch (error) {
      console.error(
        `❌ Error fetching attachments for Gmail message ${messageId}:`,
        (error as Error).message
      );
      return [];
    }
  }

  /**
   * Mark message as read by removing the UNREAD label
   */
  public async markAsRead(messageId: string): Promise<boolean> {
    if (!this.gmail) {
      throw new Error("Not connected to Gmail API. Call connect() first.");
    }

    try {
      await this.gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: {
          removeLabelIds: ["UNREAD"],
        },
      });
      return true;
    } catch (error) {
      console.error(`❌ Error marking message ${messageId} as read:`, (error as Error).message);
      return false;
    }
  }

  /**
   * Extract header details from message response data
   */
  public getMessageDetails(messageData: any): {
    id: string;
    subject: string;
    from: string;
    date: string;
    messageId: string;
  } {
    const headers = messageData.payload?.headers || [];

    const getHeader = (name: string): string => {
      const header = headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase());
      return header ? header.value || "" : "";
    };

    return {
      id: messageData.id,
      subject: getHeader("subject") || "No Subject",
      from: getHeader("from") || "Unknown",
      date: getHeader("date") || new Date().toISOString(),
      messageId: getHeader("message-id") || messageData.id,
    };
  }
}