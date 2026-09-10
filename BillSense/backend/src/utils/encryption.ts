import crypto from "crypto";

// Derive a stable 32-byte key from ENCRYPTION_KEY or JWT_SECRET
const getEncryptionKey = (): Buffer => {
  const keySecret =
    process.env.ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    "default_development_encryption_key_secret";
  return crypto.createHash("sha256").update(keySecret).digest();
};

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

export const encrypt = (text: string): string => {
  if (!text) return "";
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  return `${iv.toString("hex")}:${encrypted}`;
};

export const decrypt = (encryptedText: string): string => {
  if (!encryptedText) return "";
  try {
    const parts = encryptedText.split(":");
    if (parts.length !== 2) {
      throw new Error("Invalid encrypted format");
    }
    const iv = Buffer.from(parts[0], "hex");
    const encrypted = parts[1];
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("❌ Decryption failed:", (error as Error).message);
    throw new Error("Failed to decrypt data. Key may be incorrect.");
  }
};

export const encryptJson = (data: Record<string, any>): string => {
  return encrypt(JSON.stringify(data));
};

export const decryptJson = (encryptedText: string): Record<string, any> => {
  const decrypted = decrypt(encryptedText);
  return JSON.parse(decrypted);
};