import os
import asyncio
import psycopg2
import psycopg2.pool
import google.genai as genai
from dotenv import load_dotenv

load_dotenv()
gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
DATABASE_URL = os.getenv("NEON_DATABASE_URL")

class VectorService:
    """
    A service class for interacting with a PostgreSQL vector database (pgvector).
    
    This service handles generating embeddings using Google's Gemini API and
    performing semantic search against documents stored in the database.
    It manages a thread-safe connection pool for efficient database interactions
    within an asyncio application.
    """
    def __init__(self):
        # Connection pool: min 1, max 5 connections — reused across all searches.
        # ThreadedConnectionPool is thread-safe: safe to use with asyncio.to_thread().
        self._pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=5,
            dsn=DATABASE_URL
        )

    def get_embedding(self, text: str) -> list[float]:
        """
        Calls the Gemini API to get the vector embedding for a piece of text.
        """
        result = gemini_client.models.embed_content(
            model="gemini-embedding-2", 
            contents=text,
            config=dict(output_dimensionality=768)
        )
        return result.embeddings[0].values

    def _search_sync(self, query_embedding: list, limit: int) -> list[dict]:
        """
        Synchronous DB search — always called via asyncio.to_thread.
        
        This method executes the actual pgvector SQL query using a borrowed
        connection from the pool. It calculates the cosine similarity between
        the query embedding and document embeddings to find the closest matches.
        
        Args:
            query_embedding (list): The vector representation of the search query.
            limit (int): The maximum number of results to return.
            
        Returns:
            list[dict]: A list of documents with their metadata and similarity scores.
        """
        conn = self._pool.getconn()
        try:
            cur = conn.cursor()
            sql = "SELECT content, document_type, account_id, opportunity_id, 1 - (embedding <=> %s::vector) AS similarity FROM documents ORDER BY embedding <=> %s::vector LIMIT %s"
            cur.execute(sql, (query_embedding, query_embedding, limit))
            rows = cur.fetchall()
            return [
                {
                    "content": row[0],
                    "document_type": row[1],
                    "account_id": row[2],
                    "opportunity_id": row[3],
                    "similarity": row[4]
                }
                for row in rows
            ]
        finally:
            # Always return the connection to the pool, even on error
            cur.close()
            self._pool.putconn(conn)

    async def search_documents(self, query: str, limit: int = 5) -> list[dict]:
        """
        Embeds the user's search query and finds the most semantically similar documents
        in the Neon database using pgvector's cosine distance operator (<=>).
        Runs DB I/O on a thread to avoid blocking the asyncio event loop.
        
        Args:
            query (str): The plain text search query from the user.
            limit (int): Maximum number of results to fetch (default: 5).
            
        Returns:
            list[dict]: A list of semantically similar documents.
        """
        try:
            query_embedding = self.get_embedding(query)
            # Offload the synchronous psycopg2 call to the thread pool
            return await asyncio.to_thread(self._search_sync, query_embedding, limit)
        except Exception as e:
            print(f"Error during search: {e}")
            return []

    def close(self):
        """Closes all connections in the pool. Call on server shutdown."""
        self._pool.closeall()

# Quick test if run directly
if __name__ == "__main__":
    service = VectorService()
    print("Testing search for: 'pricing pushback'")
    results = service.search_documents("pricing pushback")
    for r in results:
        print(f"[{r.get('document_type')}] Score: {r.get('similarity'):.2f} - {r.get('content')[:50]}...")
