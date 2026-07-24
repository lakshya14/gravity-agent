import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get the connection string
DATABASE_URL = os.getenv("NEON_DATABASE_URL")

def setup_database():
    print("Connecting to Neon Database...")
    conn = None
    try:
        # 1. Establish the connection using psycopg2
        conn = psycopg2.connect(DATABASE_URL) 
        
        # 2. Create a cursor to execute SQL commands
        cur = conn.cursor()
        
        print("Enabling pgvector extension and creating tables...")
        
        # 3. Execute the SQL commands
        cur.execute("""
        CREATE EXTENSION IF NOT EXISTS vector;

        CREATE TABLE IF NOT EXISTS documents (
            id SERIAL PRIMARY KEY,
            content TEXT NOT NULL,
            document_type VARCHAR(50) NOT NULL, -- 'TRANSCRIPT' or 'MEETING_NOTE'
            account_id VARCHAR(50),
            opportunity_id VARCHAR(50),
            embedding vector(768)
        );
        """)
        
        # 4. Commit the transaction
        conn.commit() 
        print("Database setup complete!")

    except Exception as e:
        print(f"An error occurred: {e}")
        if conn:
            # Rollback the transaction if it failed
            conn.rollback() 
    finally:
        # This block runs no matter what happens above (success or error)
        # Ensuring we never leak database connections
        if conn:
            cur.close() 
            conn.close()
            print("Database connection cleanly closed.")

if __name__ == "__main__":
    setup_database()
