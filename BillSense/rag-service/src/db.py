from pymongo import MongoClient
from config import MONGO_URI

client = MongoClient(MONGO_URI)

db = client["invox"]  
invoices_col = db["invoices"] # documents 