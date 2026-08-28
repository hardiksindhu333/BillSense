import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";

const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash-lite",
  "gemini-flash-latest",
  "gemini-1.5-flash",
];

const PROMPT = `You are an invoice data extractor. Extract all data from this invoice and return ONLY a valid JSON object with these exact fields:
{
  "invoiceNumber": "",
  "vendorName": "",
  "vendorAddress": "",
  "customerName": "",
  "customerAddress": "",
  "invoiceDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD",
  "subtotal": 0,
  "taxAmount": 0,
  "taxRate": 0,
  "amountDue": 0,
  "currency": "",
  "notes": "",
  "items": [{ "description": "", "quantity": 1, "unitPrice": 0, "amount": 0 }]
}
Rules:
- currency: detect from invoice symbol (₹ = INR, $ = USD, € = EUR, £ = GBP). Never default to USD.
- taxRate: the tax percentage shown on invoice (e.g. 18 for 18% GST). 0 if not shown.
- dates: always return as YYYY-MM-DD string. Empty string if not found.
- amountDue: the final total the customer must pay.
- subtotal: amount before tax.
- notes: any payment terms, bank details, or remarks on the invoice.
- Return ONLY the JSON. No explanation. No markdown.`;


export const extractInvoiceData = async (filePath: string, mimeType: string) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

  const genAI = new GoogleGenerativeAI(apiKey);
  const fileData = fs.readFileSync(filePath);
  const base64File = fileData.toString("base64");

  let lastError: Error | null = null;

  for (const modelName of MODELS) {
    try {
      console.log(`Trying model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([
        { inlineData: { mimeType, data: base64File } },
        { text: PROMPT },
      ]);
      const text = result.response.text().trim();
      const cleaned = text.replace(/```json|```/g, "").trim();
      console.log(`Success with model: ${modelName}`);
      return JSON.parse(cleaned);
    } catch (err) {
      console.error(`Model ${modelName} failed:`, (err as Error).message);
      lastError = err as Error;
    }
  }

  throw new Error(`All models failed. Last error: ${lastError?.message}`);
};