CREATE EXTENSION IF NOT EXISTS vector;

CREATE INDEX IF NOT EXISTS faces_embedding_idx ON faces USING hnsw (embedding vector_cosine_ops);