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
            print(f"[Classifier] {model_name} failed: {e}")
    raise Exception("All Gemini models failed in classifier")

def classify_query(question: str) -> str:
    prompt = f"""
Classify this invoice question into ONE category:

DETERMINISTIC — totals, counts, top N, averages, pending/overdue, tax, revenue, filtering by status/vendor/currency/date
Examples: "total revenue", "top customers", "pending invoices", "revenue by month",
          "revenue from INR customers", "largest invoice", "how many invoices do I have"

SEMANTIC — searching invoice content by meaning or topic
Examples: "find AWS invoices", "cybersecurity projects", "chatbot services", "office supply purchases"

HYBRID — semantic topic search combined with aggregation/analytics
Examples: "revenue from AI projects", "top customers for cloud services", "total spent on maintenance"

Question: "{question}"

Reply with ONE word only: DETERMINISTIC or SEMANTIC or HYBRID
"""
    result = call_gemini(prompt).upper().strip()

    if "DETERMINISTIC" in result:
        return "DETERMINISTIC"
    elif "SEMANTIC" in result:
        return "SEMANTIC"
    elif "HYBRID" in result:
        return "HYBRID"
    else:
        return "DETERMINISTIC"  # safe default
