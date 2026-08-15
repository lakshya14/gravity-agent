import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("NEON_DATABASE_URL")

def run_migration():
    if not DATABASE_URL:
        print("NEON_DATABASE_URL not set in .env")
        return
        
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        with open("db_migrations/01_chat_history.sql", "r") as f:
            sql = f.read()
            
        cur.execute(sql)
        conn.commit()
        cur.close()
        conn.close()
        print("Migration executed successfully.")
    except Exception as e:
        print(f"Error executing migration: {e}")

if __name__ == "__main__":
    run_migration()
