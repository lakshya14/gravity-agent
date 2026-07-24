import os
import psycopg2
import google.genai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup Gemini Client (Requires GEMINI_API_KEY in .env)
gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Setup Database connection
DATABASE_URL = os.getenv("NEON_DATABASE_URL")

# --- MOCK DATA ---
# For simplicity, we are combining transcripts and meeting notes into one list.
MOCK_DOCUMENTS = [
    {
        "type": "TRANSCRIPT",
        "account_id": "ACC-TEST",
        "opportunity_id": "OPP-TEST-MCP",
        "content": "Client: So we are just starting to qualify this MCP tool... Rep: Absolutely, we can start with a pilot for $100."
    },
    {
        "type": "MEETING_NOTE",
        "account_id": "ACC-EDGE",
        "opportunity_id": "OPP-EDGE-35K",
        "content": "Meeting with Edge Communications regarding the Emergency Generator. They are currently identifying decision makers. Pushed them on timeline but they are waiting on the CFO's return."
    },
    {
        "type": "TRANSCRIPT",
        "account_id": "ACC-EDGE",
        "opportunity_id": "OPP-EDGE-75K",
        "content": "Rep: I'm thrilled we could get this signed today! Client: Us too, the 75k was approved this morning. We need the emergency generators deployed by next month."
    },
    {
        "type": "MEETING_NOTE",
        "account_id": "ACC-GRAND",
        "opportunity_id": "OPP-GRAND-250K",
        "content": "Pitched the value proposition for the portable generators to Grand Hotels. They run 5 properties and need backup power for guest safety. They agreed the $250k investment is worth the risk mitigation."
    },
    {
        "type": "TRANSCRIPT",
        "account_id": "ACC-GENE",
        "opportunity_id": "OPP-GENE-30K",
        "content": "Client: The SLA terms look good. We will proceed with the $30,000 tier. Rep: Excellent, I'll send the contract over via DocuSign."
    },
    {
        "type": "MEETING_NOTE",
        "account_id": "ACC-GENE",
        "opportunity_id": "OPP-GENE-60K",
        "content": "Discussed Lab Generators with GenePoint. The lab manager is on board, but we still need to identify the final economic buyer who can sign off on the $60k PO."
    },
    {
        "type": "TRANSCRIPT",
        "account_id": "ACC-UNITED",
        "opportunity_id": "OPP-UNITED-120K-1",
        "content": "Client: We are ready to move forward with the Standby Generators for United Oil. Rep: Fantastic, that closes out the $120k deal."
    },
    {
        "type": "TRANSCRIPT",
        "account_id": "ACC-UNITED",
        "opportunity_id": "OPP-UNITED-120K-2",
        "content": "Rep: Just confirming receipt of the signed SLA agreement for United Oil. Client: Confirmed. We expect 24/7 uptime."
    },
    {
        "type": "MEETING_NOTE",
        "account_id": "ACC-UNITED",
        "opportunity_id": "OPP-UNITED-11M",
        "content": "Massive proposal out to United Oil for Refinery Generators ($11.27M). They are reviewing the price quote. Procurement is pushing back on the installation fees. Need to loop in VP of Sales."
    },
    {
        "type": "MEETING_NOTE",
        "account_id": "ACC-GRAND",
        "opportunity_id": "OPP-GRAND-350K",
        "content": "Deal Closed Won! Grand Hotels signed the $350k contract for Generator Installations. Implementation team is kicking off next Tuesday."
    }
]

def get_embedding(text: str) -> list[float]:
    """
    Calls the Gemini API to get the vector embedding for a piece of text.
    """
    result = gemini_client.models.embed_content(
        model="gemini-embedding-2", 
        contents=text,
        config=dict(output_dimensionality=768)
    )
    return result.embeddings[0].values
    


def ingest_documents():
    """
    Embeds each mock document and inserts it into the Neon database.
    """
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        for doc in MOCK_DOCUMENTS:
            print(f"Embedding document for Account {doc['account_id']}...")
            
            embedding = get_embedding(doc['content'])

            cur.execute("INSERT INTO documents (document_type, account_id, opportunity_id, content, embedding) VALUES (%s, %s, %s, %s, %s)", (doc['type'], doc['account_id'], doc['opportunity_id'], doc['content'], embedding))
        
        conn.commit()
        
        print("Ingestion complete!")

    except Exception as e:
        print(f"Error during ingestion: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            cur.close()
            conn.close()

if __name__ == "__main__":
    if not os.getenv("GEMINI_API_KEY"):
        print("ERROR: GEMINI_API_KEY is missing from .env!")
    else:
        ingest_documents()
