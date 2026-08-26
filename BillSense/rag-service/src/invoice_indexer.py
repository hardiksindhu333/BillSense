from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from models import vectorstore

splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)


def index_invoice_pdf(req):
    """Index an invoice from a PDF file on disk."""
    reader = PdfReader(req.file_path)
    text = "".join([page.extract_text() or "" for page in reader.pages])

    if not text.strip():
        return {"message": "No text extracted"}

    chunks = splitter.split_text(text)
    metadatas = [{"invoice_id": req.invoice_id, "vendor": req.vendor_name, "status": req.status} for _ in chunks]
    ids = [f"{req.invoice_id}_chunk_{i}" for i in range(len(chunks))]

    vectorstore.add_texts(texts=chunks, metadatas=metadatas, ids=ids)
    return {"message": f"Indexed {len(chunks)} chunks"}


def build_invoice_text(doc) -> str:
    """
    Build a rich searchable text from a raw invoice document (dict or Pydantic model).
    Works for both MongoDB dicts and InvoiceDocRequest objects.
    """
    def get(key, default=""):
        if isinstance(doc, dict):
            return doc.get(key, default) or default
        return getattr(doc, key, default) or default

    items_raw = get("items", [])
    items_text = ""
    for item in items_raw:
        if isinstance(item, dict):
            desc = item.get("description", "")
            qty = item.get("quantity", 0)
            price = item.get("unitPrice", 0)
            amt = item.get("amount", 0)
        else:
            desc = getattr(item, "description", "")
            qty = getattr(item, "quantity", 0)
            price = getattr(item, "unitPrice", 0)
            amt = getattr(item, "amount", 0)
        items_text += f"  - {desc}: qty={qty}, unit price={price}, amount={amt}\n"

    text = f"""
Invoice Number: {get('invoiceNumber')}
Vendor: {get('vendorName')}
Vendor Address: {get('vendorAddress')}
Customer: {get('customerName')}
Customer Address: {get('customerAddress')}
Invoice Date: {get('invoiceDate')}
Due Date: {get('dueDate')}
Amount Due: {get('amountDue')} {get('currency', 'INR')}
Subtotal: {get('subtotal')}
Tax Amount: {get('taxAmount')}
Tax Rate: {get('taxRate')}%
Status: {get('status')}
Notes: {get('notes')}
Items:
{items_text}
""".strip()

    return text


def index_invoice_doc(doc, user_id: str) -> dict:
    """
    Index a single invoice from raw JSON/dict (no PDF needed).
    Works with MongoDB documents directly.
    """
    invoice_number = doc.get("invoiceNumber") if isinstance(doc, dict) else getattr(doc, "invoiceNumber", "")
    vendor = doc.get("vendorName", "") if isinstance(doc, dict) else getattr(doc, "vendorName", "")
    status = doc.get("status", "pending") if isinstance(doc, dict) else getattr(doc, "status", "pending")

    text = build_invoice_text(doc)

    if not text.strip():
        return {"message": "No content to index"}

    chunks = splitter.split_text(text)
    metadatas = [{
        "invoice_id": invoice_number,
        "user_id": user_id,
        "vendor": vendor,
        "status": status
    } for _ in chunks]
    ids = [f"{user_id}_{invoice_number}_chunk_{i}" for i in range(len(chunks))]

    # Delete existing chunks for this invoice before re-indexing
    try:
        existing_ids = [f"{user_id}_{invoice_number}_chunk_{i}" for i in range(50)]
        vectorstore._collection.delete(ids=existing_ids)
    except Exception:
        pass

    vectorstore.add_texts(texts=chunks, metadatas=metadatas, ids=ids)
    return {"indexed": invoice_number, "chunks": len(chunks)}


def index_all_for_user(user_id: str) -> dict:
    """
    Bulk index ALL invoices for a user directly from MongoDB.
    Call POST /index-all with { "user_id": "..." }
    """
    from db import invoices_col
    from bson import ObjectId

    # MongoDB might store userId as a string or an ObjectId
    query = {"userId": user_id}
    if len(user_id) == 24:
        query = {"$or": [{"userId": user_id}, {"userId": ObjectId(user_id)}]}

    invoices = list(invoices_col.find(query))
    if not invoices:
        return {"message": "No invoices found for this user", "indexed": 0}

    results = []
    errors = []
    for inv in invoices:
        try:
            result = index_invoice_doc(inv, user_id)
            results.append(result)
        except Exception as e:
            errors.append({"invoice": inv.get("invoiceNumber", "?"), "error": str(e)})

    return {
        "message": f"Indexed {len(results)} invoices",
        "indexed": len(results),
        "errors": errors,
        "details": results
    }