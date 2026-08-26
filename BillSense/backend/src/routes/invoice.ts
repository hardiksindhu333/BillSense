import { Router, Response } from "express";
import Invoice from "../models/Invoice"
import { protect, AuthRequest } from "../middleware/auth";
import { upload } from "../config/multer";
import axios from "axios";

import { extractInvoiceData } from "../services/gemini";
import path from "path";

const invoiceRouter = Router();

// POST /api/invoices — Create invoice
// POST /api/invoices — Create invoice manually
invoiceRouter.post("/", protect, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const {
      vendorName, vendorAddress, customerName, customerAddress,
      invoiceNumber, subtotal, taxAmount, taxRate, amountDue,
      currency, invoiceDate, dueDate, items, notes, status,
    } = req.body;

    const invoice = await Invoice.create({
      userId: req.userId,
      vendorName, vendorAddress, customerName, customerAddress,
      invoiceNumber, subtotal, taxAmount, taxRate, amountDue,
      currency, invoiceDate, dueDate, items, notes,
      extractedByAI: false,
      status: status || "pending",
    });

    return res.status(201).json(invoice);
  } catch (error) {
    console.log(error)
    return res.status(500).json({ message: "Server error" });
  }
});


// GET /api/invoices — Get all invoices for logged-in user
invoiceRouter.get("/", protect, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const invoices = await Invoice.find({ userId: req.userId }).sort({ createdAt: -1 });
    return res.status(200).json(invoices);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/invoices/:id — Get single invoice
invoiceRouter.get("/:id", protect, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.userId });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    return res.status(200).json(invoice);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
});



// PUT /api/invoices/:id — Update invoice
invoiceRouter.put("/:id", protect, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true }
    );
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    return res.status(200).json(invoice);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/invoices/:id — Delete invoice  
invoiceRouter.delete("/:id", protect, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const invoice = await Invoice.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    return res.status(200).json({ message: "Invoice deleted" });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
});


// POST /api/invoices/upload — Upload invoice file

invoiceRouter.post("/upload", protect, upload.single("file"), async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const mimeType = req.file.mimetype;
    const filePath = req.file.path;
    const fileUrl = `/uploads/${req.file.filename}`;
  


   
    const extracted = await extractInvoiceData(filePath, mimeType);
   
    const invoice = await Invoice.create({
      userId: req.userId,
      ...extracted,
      originalFilename: req.file.originalname,
      fileUrl,
      extractedByAI: true,
      status: "pending", // always pending after AI extraction — needs human review
    });

    // After invoice is saved to MongoDB, index into RAG service (ChromaDB)
    const RAG_URL = process.env.RAG_SERVICE_URL || "http://localhost:8000";
    const absolutePath = path.resolve(filePath);
    axios.post(`${RAG_URL}/index`, {
      invoice_id: invoice._id.toString(),
      file_path: absolutePath,
      vendor_name: invoice.vendorName || "Unknown",
      amount_due: invoice.amountDue || 0,
      status: invoice.status,
    }).catch((err) => console.error("RAG indexing failed:", err.message));

    return res.status(201).json({data:invoice})
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({ message: "Extraction failed", error: (error as Error).message });
  }
});

// GET /api/invoices/export/json
invoiceRouter.get("/export/json", protect, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const invoices = await Invoice.find({ userId: req.userId });
    const exportData = {
      exportDate: new Date().toISOString(),  // ISO 8601 format 
      totalInvoices: invoices.length,
      invoices,
    };
    res.setHeader("Content-Disposition", "attachment; filename=invoices.json");
    // header -> Content-Disposition means browser ko btana how to show the content 
    // its 3 values -> "inline" (display content in browser if possible)
    //              -> "attachment"  (force the browser to download a file)
                  // -> "attachment:filename" means name of the file 
    res.setHeader("Content-Type", "application/json"); // telling browser about the data , here data i am sending is json
    return res.status(200).json(exportData);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
});


// GET /api/invoices/export/csv
invoiceRouter.get("/export/csv", protect, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const invoices = await Invoice.find({ userId: req.userId });

    const header = "Invoice Number,Vendor Name,Amount Due,Currency,Invoice Date,Due Date,Status,Items Count,Created At\n";
    // header means column names of the csv file 
    // csv file is a row column file 
    const rows = invoices.map((inv) => [
      inv.invoiceNumber,
      inv.vendorName,
      inv.amountDue,
      inv.currency,
      inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().split("T")[0] : "",
      inv.dueDate ? new Date(inv.dueDate).toISOString().split("T")[0] : "",
      inv.status,
      inv.items?.length || 0,
      new Date(inv.createdAt).toISOString().split("T")[0],
    ].join(",")).join("\n");

    res.setHeader("Content-Disposition", "attachment; filename=invoices.csv");
    res.setHeader("Content-Type", "text/csv");
    return res.status(200).send(header + rows);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
});
export default invoiceRouter;