from query.hybrid_engine import run_hybrid_engine

def query_invoice(question: str, user_id: str):
    return run_hybrid_engine(question, user_id)