import mongoose, { Schema, Document } from "mongoose";
// where to look and how to look 
// emailAddress
// provider
// oauthToken
// oauthTokenExpiry
// these fields gmail outh actually needs 
export interface IEmailCredential extends Document {
  userId: mongoose.Types.ObjectId;
  emailAddress: string;

  oauthToken?: string; // Encrypted JSON OAuth tokens
  oauthTokenExpiry?: Date;
  // imapServer?: string;
  // imapPort?: number;
  // imapUsername?: string;
  // imapPassword?: string; // Encrypted app password
  // useSSL: boolean;
  pollingEnabled: boolean;
  pollingIntervalMinutes: number;
  lastPollTime?: Date;
  lastPollStatus?: string;
  folderToWatch: string;
  markAsRead: boolean;
  isActive: boolean;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
  //  my application specific fields
  
}

const EmailCredentialSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    emailAddress: { type: String, required: true },
    
    oauthToken: { type: String },
    oauthTokenExpiry: { type: Date },
   
    pollingEnabled: { type: Boolean, default: false },
    pollingIntervalMinutes: { type: Number, default: 5, min: 1, max: 60 },
    lastPollTime: { type: Date },
    lastPollStatus: { type: String },
    folderToWatch: { type: String, default: "INBOX" },
    markAsRead: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    lastError: { type: String }
  },
  { timestamps: true }
);

export default mongoose.model<IEmailCredential>("EmailCredential", EmailCredentialSchema);