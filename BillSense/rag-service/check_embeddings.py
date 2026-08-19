"""
Quick diagnostic - run from C:\INVOX\rag-service with:
  venv\Scripts\python.exe check_embeddings.py
"""
import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from dotenv import load_dotenv

load_dotenv("src/.env")
load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
if not API_KEY:
    print("No GEMINI_API_KEY / GOOGLE_API_KEY found in .env")
    exit(1)

print(f"[OK] API key found: {API_KEY[:8]}...")

# 1. List available embedding models
try:
    import google.generativeai as genai
    genai.configure(api_key=API_KEY)
    print("\n[INFO] Available embedding models:")
    for m in genai.list_models():
        if "embed" in m.name.lower() or "embed" in str(m.supported_generation_methods).lower():
            print(f"   {m.name}  -->  {m.supported_generation_methods}")
except Exception as e:
    print(f"   (list_models failed: {e})")

# 2. Test old SDK  (google-generativeai)
print("\n[TEST 1] google-generativeai - models/text-embedding-004")
try:
    import google.generativeai as genai
    genai.configure(api_key=API_KEY)
    result = genai.embed_content(
        model="models/text-embedding-004",
        content="hello world",
        task_type="retrieval_document"
    )
    print(f"   [PASS] vector length {len(result['embedding'])}")
except Exception as e:
    print(f"   [FAIL] {e}")

# 3. Test new SDK (google-genai)
print("\n[TEST 2] google-genai (new SDK) - text-embedding-004")
try:
    from google import genai as new_genai
    client = new_genai.Client(api_key=API_KEY)
    result = client.models.embed_content(model="text-embedding-004", contents="hello world")
    print(f"   [PASS] vector length {len(result.embeddings[0].values)}")
except Exception as e:
    print(f"   [FAIL] {e}")

# 4. Test langchain wrapper - with prefix
print("\n[TEST 3] langchain GoogleGenerativeAIEmbeddings - models/text-embedding-004")
try:
    from langchain_google_genai import GoogleGenerativeAIEmbeddings
    emb = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004", google_api_key=API_KEY)
    v = emb.embed_query("hello world")
    print(f"   [PASS] vector length {len(v)}")
except Exception as e:
    print(f"   [FAIL] {e}")

# 5. Test langchain wrapper - without prefix
print("\n[TEST 4] langchain GoogleGenerativeAIEmbeddings - text-embedding-004")
try:
    from langchain_google_genai import GoogleGenerativeAIEmbeddings
    emb = GoogleGenerativeAIEmbeddings(model="text-embedding-004", google_api_key=API_KEY)
    v = emb.embed_query("hello world")
    print(f"   [PASS] vector length {len(v)}")
except Exception as e:
    print(f"   [FAIL] {e}")

# 6. Test fallback - embedding-001
print("\n[TEST 5] langchain GoogleGenerativeAIEmbeddings - models/embedding-001")
try:
    from langchain_google_genai import GoogleGenerativeAIEmbeddings
    emb = GoogleGenerativeAIEmbeddings(model="models/embedding-001", google_api_key=API_KEY)
    v = emb.embed_query("hello world")
    print(f"   [PASS] vector length {len(v)}")
except Exception as e:
    print(f"   [FAIL] {e}")

print("\nDone.")
