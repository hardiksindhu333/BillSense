from langchain_huggingface import HuggingFaceEmbeddings
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.vectorstores import Chroma
from config import CHROMA_PATH, GEMINI_API_KEY

# Local HuggingFace embeddings — no API key, no rate limits, no deprecation risk
# Model is ~80MB, downloaded once to ~/.cache/huggingface on first run
embeddings = HuggingFaceEmbeddings(
    model_name="all-MiniLM-L6-v2",
    model_kwargs={"device": "cpu"},
    encode_kwargs={"normalize_embeddings": True}
)

llm = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    google_api_key=GEMINI_API_KEY
)

vectorstore = Chroma(
    collection_name="invoices",
    embedding_function=embeddings,
    persist_directory=CHROMA_PATH
)