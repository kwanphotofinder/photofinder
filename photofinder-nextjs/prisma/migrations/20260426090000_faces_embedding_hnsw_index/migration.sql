-- Ensure pgvector is available before creating vector indexes
CREATE EXTENSION IF NOT EXISTS vector;

-- HNSW cosine index for face embedding nearest-neighbor search
CREATE INDEX IF NOT EXISTS faces_embedding_idx ON faces USING hnsw (embedding vector_cosine_ops);
