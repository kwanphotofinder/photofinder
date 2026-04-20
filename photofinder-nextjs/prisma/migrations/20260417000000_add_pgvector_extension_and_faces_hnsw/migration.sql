CREATE EXTENSION IF NOT EXISTS vector;

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
		  AND table_name = 'faces'
		  AND column_name = 'embedding'
	) THEN
		CREATE INDEX IF NOT EXISTS faces_embedding_idx ON faces USING hnsw (embedding vector_cosine_ops);
	END IF;
END $$;