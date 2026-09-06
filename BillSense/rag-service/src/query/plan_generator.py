import json
from google import genai
from config import GEMINI_API_KEY

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
            print(f"[PlanGenerator] {model_name} failed: {e}")
    raise Exception("All Gemini models failed in plan generator")


def generate_query_plan(question: str) -> dict:
    prompt = f"""
You are an invoice analytics query planner.
Generate a structured QueryPlan JSON to answer this question.

Allowed values:
- metric: amountDue | taxAmount | subtotal
- aggregation: sum | avg | count | min | max
- groupBy: customerName | vendorName | currency | status | invoiceDate | dueDate | null
- filters.status: pending | approved | paid | null
- filters.currency: any string or null
- filters.vendorName: any string or null
- filters.customerName: any string or null
- sortBy: result | count
- sortOrder: asc | desc
- limit: number (max 100)

Question: "{question}"

Return ONLY valid JSON. No explanation. No markdown.

Example:
{{
  "metric": "amountDue",
  "aggregation": "sum",
  "groupBy": "customerName",
  "filters": {{
    "status": null,
    "currency": "INR",
    "vendorName": null,
    "customerName": null
  }},
  "limit": 10,
  "sortBy": "result",
  "sortOrder": "desc"
}}
"""
    raw = call_gemini(prompt)
    cleaned = raw.replace("```json", "").replace("```", "").strip() # string of python
    return json.loads(cleaned)   # actual python dict 
