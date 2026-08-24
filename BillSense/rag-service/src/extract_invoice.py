import os
import base64
import json
from pypdf import PdfReader
from google import genai
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY)

MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash-exp"]

SCHEMA = """{
  "invoiceNumber": "",
  "vendorName": "",
  "vendorAddress": "",
  "customerName": "",
  "customerAddress": "",
  "invoiceDate": "",
  "dueDate": "",
  "subtotal": 0,
  "taxAmount": 0,
  "amountDue": 0,
  "currency": "USD",
  "items": [{ "description": "", "quantity": 1, "unitPrice": 0, "amount": 0 }]
}"""


def call_gemini(prompt: str, image_data: str = None, mime_type: str = None) -> str:
    for model_name in MODELS:
        try:
            if image_data:
                from google.genai import types
                response = client.models.generate_content(
                    model=model_name,
                    contents=[
                        types.Part.from_bytes(data=base64.b64decode(image_data), mime_type=mime_type),
                        prompt
                    ]
                )
            else:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt
                )
            return response.text.strip()
        except Exception as e:
            print(f"[Extract] {model_name} failed: {e}")
    raise Exception("All Gemini models failed in extract_invoice")


def extract_invoice(file_path: str, mime_type: str):
    prompt = f"Extract invoice data and return ONLY valid JSON matching this schema:\n{SCHEMA}\n\nReturn ONLY JSON. No explanation, no markdown."

    if mime_type == "application/pdf":
        reader = PdfReader(file_path)
        text = "".join([page.extract_text() or "" for page in reader.pages])
        raw = call_gemini(f"{prompt}\n\nInvoice text:\n{text}")
    else:
        with open(file_path, "rb") as f:
            image_data = base64.b64encode(f.read()).decode("utf-8")
        raw = call_gemini(prompt, image_data=image_data, mime_type=mime_type)

    cleaned = raw.replace("```json", "").replace("```", "").strip()
    return json.loads(cleaned)
