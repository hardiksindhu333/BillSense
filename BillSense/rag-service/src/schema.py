from pydantic import BaseModel
from typing import Literal, List, Optional

class QueryClassification(BaseModel):
    query_type: Literal["semantic", "analytical"]

class IndexRequest(BaseModel):
    invoice_id: str
    file_path: str
    vendor_name: str
    amount_due: float
    status: str

class ChatQuery(BaseModel):
    question: str
    user_id: str

class ExtractRequest(BaseModel):
    file_path: str
    mime_type: str

# ── New: index raw invoice JSON directly (no PDF needed) ──────────────────────
class InvoiceItem(BaseModel):
    description: Optional[str] = ""
    quantity: Optional[float] = 0
    unitPrice: Optional[float] = 0
    amount: Optional[float] = 0

class InvoiceDocRequest(BaseModel):
    """Mirrors the MongoDB invoice document shape."""
    _id: Optional[str] = None
    invoiceNumber: str
    vendorName: Optional[str] = ""
    vendorAddress: Optional[str] = ""
    customerName: Optional[str] = ""
    customerAddress: Optional[str] = ""
    amountDue: Optional[float] = None
    subtotal: Optional[float] = None
    taxAmount: Optional[float] = None
    taxRate: Optional[float] = 0
    currency: Optional[str] = "INR"
    invoiceDate: Optional[str] = None
    dueDate: Optional[str] = None
    status: Optional[str] = "pending"
    notes: Optional[str] = ""
    items: Optional[List[InvoiceItem]] = []
    userId: str