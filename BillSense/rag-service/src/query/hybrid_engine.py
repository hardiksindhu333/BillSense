import json
import sys
import os

# Add parent src to path
# it is something related to import from src , lets handle this thing at last 
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from google import genai
from bson import ObjectId
from db import invoices_col
from models import vectorstore
from config import GEMINI_API_KEY
from query.classifier import classify_query
from query.registry import match_registry
from query.plan_generator import generate_query_plan
from query.plan_validator import validate_plan
from query.pipeline_builder import plan_to_pipeline
from query.pipeline_validator import validate_pipeline

client = genai.Client(api_key=GEMINI_API_KEY)

MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash-exp"]


def call_gemini(prompt: str) -> str:
    for model_name in MODELS:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt
            )
            return response.text.strip()
        except Exception as e:
            print(f"[Synthesizer] {model_name} failed: {e}")
    raise Exception("All Gemini models failed in synthesizer")


def synthesize(question: str, data: dict, query_type: str) -> str:
    prompt = f"""
You are a helpful invoice assistant. Answer the user's question directly and concisely.

Question: "{question}"
Query type: {query_type}
Data:
{json.dumps(data, default=str, indent=2)}

Rules:
- Give a SHORT, direct answer
- Include key numbers and facts
- Format currency values nicely (e.g. ₹1,23,456 or $1,234)
- If no results, say "No invoices found matching your query"
- Do NOT repeat the raw data dump

Answer:"""
    return call_gemini(prompt)


def run_mongo_pipeline(pipeline: list) -> dict:
    try:
        results = list(invoices_col.aggregate(pipeline))
        for r in results:
            for k, v in r.items():
                if isinstance(v, ObjectId):
                    r[k] = str(v)
        return {"success": True, "results": results, "count": len(results)}
    except Exception as e:
        return {"success": False, "error": str(e), "results": []}


# ─── DETERMINISTIC PATH ───────────────────────────────────────────────────────

def handle_deterministic(question: str, user_id: str) -> dict:
    # Step 1: Try registry
    pipeline = match_registry(question, user_id)

    if pipeline:
        print("[Engine] Registry match found")
        # Still validate before executing
        valid, msg = validate_pipeline(pipeline, user_id)
        if not valid:
            return {"answer": f"Query blocked: {msg}", "type": "deterministic"}
        data = run_mongo_pipeline(pipeline)
        answer = synthesize(question, data, "deterministic")
        return {"answer": answer, "type": "deterministic"}

    # Step 2: Fallback to QueryPlan
    print("[Engine] No registry match — generating QueryPlan")
    try:
        plan = generate_query_plan(question)
        print(f"[Engine] QueryPlan: {json.dumps(plan)}")

        # Layer 1 — validate plan
        valid, msg = validate_plan(plan)
        if not valid:
            return {"answer": f"Query not permitted: {msg}", "type": "deterministic"}

        # Build pipeline
        pipeline = plan_to_pipeline(plan, user_id)

        # Layer 2 — validate pipeline
        valid, msg = validate_pipeline(pipeline, user_id)
        if not valid:
            return {"answer": f"Unsafe query blocked: {msg}", "type": "deterministic"}

        data = run_mongo_pipeline(pipeline)
        answer = synthesize(question, data, "deterministic")
        return {"answer": answer, "type": "deterministic"}

    except Exception as e:
        return {"answer": f"Could not process query: {str(e)}", "type": "deterministic"}


# ─── SEMANTIC PATH ────────────────────────────────────────────────────────────

def handle_semantic(question: str, user_id: str) -> dict:
    try:
        # Filter by user_id so users only see their own invoices
        docs = vectorstore.similarity_search(
            question,
            k=10,
            filter={"user_id": user_id}
        )

        if not docs:
            return {
                "answer": "No matching invoices found. Make sure your invoices are indexed by calling POST /index-all first.",
                "type": "semantic"
            }

        context = [
            {"content": d.page_content[:400], "metadata": d.metadata}
            for d in docs
        ]
        answer = synthesize(question, {"documents": context}, "semantic")
        return {"answer": answer, "type": "semantic"}
    except Exception as e:
        err = str(e)
        # ChromaDB throws when collection is empty
        if "no documents" in err.lower() or "empty" in err.lower() or "0 elements" in err.lower():
            return {
                "answer": "No invoices indexed yet. Call POST /index-all with your user_id first.",
                "type": "semantic"
            }
        return {"answer": f"Semantic search failed: {err}", "type": "semantic"}


# ─── HYBRID PATH ──────────────────────────────────────────────────────────────

def handle_hybrid(question: str, user_id: str) -> dict:
    try:
        # Step 1: Semantic search filtered by user_id
        docs = vectorstore.similarity_search(
            question,
            k=10,
            filter={"user_id": user_id}
        )
        invoice_ids = list({d.metadata.get("invoice_id") for d in docs if d.metadata.get("invoice_id")})
        print(f"[Engine] Hybrid — found {len(invoice_ids)} invoice IDs from ChromaDB")

        if not invoice_ids:
            return {"answer": "No matching invoices found for your query.", "type": "hybrid"}

        # Step 2: MongoDB aggregation on those specific invoices
        pipeline = [
            {"$match": {"userId": user_id, "invoiceNumber": {"$in": invoice_ids}}},
            {"$group": {
                "_id": "$vendorName",
                "total": {"$sum": "$amountDue"},
                "count": {"$sum": 1}
            }},
            {"$sort": {"total": -1}},
            {"$limit": 10}
        ]

        valid, msg = validate_pipeline(pipeline, user_id)
        if not valid:
            return {"answer": f"Query blocked: {msg}", "type": "hybrid"}

        data = run_mongo_pipeline(pipeline)

        # Also include the semantic context
        semantic_snippets = [d.page_content[:300] for d in docs[:5]]
        combined = {"aggregated_data": data, "semantic_snippets": semantic_snippets}

        answer = synthesize(question, combined, "hybrid")
        return {"answer": answer, "type": "hybrid"}

    except Exception as e:
        return {"answer": f"Hybrid query failed: {str(e)}", "type": "hybrid"}


# ─── MAIN ORCHESTRATOR ────────────────────────────────────────────────────────

def run_hybrid_engine(question: str, user_id: str) -> dict:
    query_type = classify_query(question)
    print(f"[Engine] Classified as: {query_type}")

    if query_type == "DETERMINISTIC":
        return handle_deterministic(question, user_id)
    elif query_type == "SEMANTIC":
        return handle_semantic(question, user_id)
    elif query_type == "HYBRID":
        return handle_hybrid(question, user_id)
    else:
        return handle_deterministic(question, user_id)
