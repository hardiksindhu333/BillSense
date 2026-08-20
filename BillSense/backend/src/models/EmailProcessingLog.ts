import mongoose, { Schema, Document } from "mongoose";
// what it found and what we did 
export interface IEmailProcessingLog extends Document {
  userId: mongoose.Types.ObjectId;
  emailCredentialId: mongoose.Types.ObjectId;
  emailMessageId?: string;
  emailSubject?: string;
  emailFrom?: string;
  emailDate?: Date;
  attachmentsFound: number;
  attachmentsProcessed: number;
  invoicesCreated: number;
  status: "success" | "partial" | "failed" | "skipped";
  errorMessage?: string;
  processedAt: Date;
}

const EmailProcessingLogSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    emailCredentialId: { type: Schema.Types.ObjectId, ref: "EmailCredential", required: true, index: true },
    emailMessageId: { type: String },
    emailSubject: { type: String },
    emailFrom: { type: String },
    emailDate: { type: Date },
    attachmentsFound: { type: Number, default: 0 },
    attachmentsProcessed: { type: Number, default: 0 },
    invoicesCreated: { type: Number, default: 0 },
    status: { type: String, required: true },
    errorMessage: { type: String },
    processedAt: { type: Date, default: Date.now }
  }
);

export default mongoose.model<IEmailProcessingLog>("EmailProcessingLog", EmailProcessingLogSchema);