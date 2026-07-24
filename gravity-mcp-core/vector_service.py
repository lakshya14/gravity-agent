import os
import psycopg2
import google.genai as genai
from dotenv import load_dotenv

load_dotenv()
gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
DATABASE_URL = os.getenv("NEON_DATABASE_URL")

class VectorService:
    def __init__(self):
        # We initialize the connection pool or basic connection here
        pass

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

    def search_documents(self, query: str, limit: int = 5) -> list[dict]:
        """
        Embeds the user's search query and finds the most semantically similar documents
        in the Neon database using pgvector's cosine distance operator (<=>).
        """
        conn = None
        try:
            query_embedding = self.get_embedding(query)

            # 2. Connect to Database & search
            conn = psycopg2.connect(DATABASE_URL)
            cur = conn.cursor()
            
            sql = "SELECT content, document_type, account_id, opportunity_id, 1 - (embedding <=> %s::vector) AS similarity FROM documents ORDER BY embedding <=> %s::vector LIMIT %s"
            cur.execute(sql, (query_embedding, query_embedding, limit))
            
            
            rows = cur.fetchall()
            results = []
            for row in rows:
                results.append({
                    "content": row[0],
                    "document_type": row[1],
                    "account_id": row[2],
                    "opportunity_id": row[3],
                    "similarity": row[4]
                })
            
            return results

        except Exception as e:
            print(f"Error during search: {e}")
            return []
        finally:
            if conn:
                cur.close()
                conn.close()

# Quick test if run directly
if __name__ == "__main__":
    service = VectorService()
    print("Testing search for: 'pricing pushback'")
    results = service.search_documents("pricing pushback")
    for r in results:
        print(f"[{r.get('document_type')}] Score: {r.get('similarity'):.2f} - {r.get('content')[:50]}...")
