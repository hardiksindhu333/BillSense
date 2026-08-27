from fastapi import APIRouter
from pydantic import BaseModel
from extract_invoice import extract_invoice
from invoice_indexer import index_invoice_pdf, index_invoice_doc, index_all_for_user
from query_service import query_invoice
from schema import ExtractRequest, IndexRequest, ChatQuery, InvoiceDocRequest

router = APIRouter()


@router.get("/status")
def status():
    return {"status": "ok"}


@router.post("/extract")
def extract(req: ExtractRequest):
    return extract_invoice(req.file_path, req.mime_type)


@router.post("/index")
def index(req: IndexRequest):
    """Index an invoice from a PDF file on disk."""
    return index_invoice_pdf(req)


@router.post("/index-doc")
def index_doc(req: InvoiceDocRequest):
    """
    Index a single invoice from raw JSON (no PDF needed).
    Pass any invoice document directly from MongoDB.
    """
    return index_invoice_doc(req, req.userId)


class IndexAllRequest(BaseModel):
    user_id: str


@router.post("/index-all")
def index_all(req: IndexAllRequest):
    """
    Bulk index ALL invoices for a user straight from MongoDB.
    Call this once to populate ChromaDB — then /query semantic search works.
    """
    return index_all_for_user(req.user_id)


@router.post("/query")
def query(req: ChatQuery):
    return query_invoice(req.question, req.user_id)