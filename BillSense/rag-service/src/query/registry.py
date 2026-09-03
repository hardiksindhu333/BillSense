from google import genai
from config import GEMINI_API_KEY
from bson import ObjectId

def to_object_id(user_id: str):
    try:
        return ObjectId(user_id)
    except Exception:
        return user_id

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
            print(f"[Registry] {model_name} failed: {e}")
    raise Exception("All Gemini models failed in registry matcher")


def get_registry(user_id: str) -> dict:
    uid = to_object_id(user_id)  # userid ka object bna lia 
    return {
        "total_revenue": [
            {"$match": {"userId": uid}},
            {"$group": {"_id": None, "total": {"$sum": "$amountDue"}, "count": {"$sum": 1}}}
        ],
        "revenue_by_month": [
            {"$match": {"userId": uid}},
            {"$group": {"_id": "$invoiceDate", "revenue": {"$sum": "$amountDue"}, "count": {"$sum": 1}}},
            {"$sort": {"_id": -1}}
        ],
        "top_customers": [
            {"$match": {"userId": uid}},
            {"$group": {"_id": "$customerName", "total": {"$sum": "$amountDue"}, "count": {"$sum": 1}}},
            {"$sort": {"total": -1}},
            {"$limit": 10}
        ],
        "top_vendors": [
            {"$match": {"userId": uid}},
            {"$group": {"_id": "$vendorName", "total": {"$sum": "$amountDue"}, "count": {"$sum": 1}}},
            {"$sort": {"total": -1}},
            {"$limit": 10}
        ],
        "pending_invoices": [
            {"$match": {"userId": uid, "status": "pending"}},
            {"$project": {"invoiceNumber": 1, "vendorName": 1, "amountDue": 1, "dueDate": 1, "currency": 1}}
        ],
        "overdue_invoices": [
            {"$match": {"userId": uid, "status": {"$in": ["pending", "overdue"]}}},
            {"$sort": {"dueDate": 1}},
            {"$project": {"invoiceNumber": 1, "vendorName": 1, "amountDue": 1, "dueDate": 1, "status": 1}}
        ],
        "average_invoice_value": [
            {"$match": {"userId": uid}},
            {"$group": {"_id": None, "average": {"$avg": "$amountDue"}, "count": {"$sum": 1}}}
        ],
        "tax_collected": [
            {"$match": {"userId": uid}},
            {"$group": {"_id": None, "total_tax": {"$sum": "$taxAmount"}}}
        ],
        "largest_invoice": [
            {"$match": {"userId": uid}},
            {"$sort": {"amountDue": -1}},
            {"$limit": 1},
            {"$project": {"invoiceNumber": 1, "vendorName": 1, "amountDue": 1, "currency": 1}}
        ],
        "invoice_count": [
            {"$match": {"userId": uid}},
            {"$count": "total"}
        ],
        "paid_invoices": [
            {"$match": {"userId": uid, "status": "paid"}},
            {"$group": {"_id": None, "total_paid": {"$sum": "$amountDue"}, "count": {"$sum": 1}}}
        ],
        "approved_invoices": [
            {"$match": {"userId": uid, "status": "approved"}},
            {"$project": {"invoiceNumber": 1, "vendorName": 1, "amountDue": 1, "currency": 1}}
        ],
        "cancelled_invoices": [
            {"$match": {"userId": uid, "status": "cancelled"}},
            {"$project": {"invoiceNumber": 1, "vendorName": 1, "amountDue": 1, "currency": 1}}
        ],
        "draft_invoices": [
            {"$match": {"userId": uid, "status": "draft"}},
            {"$project": {"invoiceNumber": 1, "vendorName": 1, "amountDue": 1, "currency": 1}}
        ]
    }


def match_registry(question: str, user_id: str):
    registry = get_registry(user_id) 
    keys = list(registry.keys()) # keys of all queries in registry 
    registry_keys = ""

    for k in keys:

        registry_keys += "- " + k + "\n"

    prompt = f"""
Match this invoice question to the closest registry key.

Registry keys:
{registry_keys}


Question: "{question}"

Reply with the registry key ONLY (e.g. total_revenue), or NO_MATCH if none fits well.
"""
    result = call_gemini(prompt).strip().lower().replace("-", "_")

    if result in registry:
        return registry[result]
    return None
