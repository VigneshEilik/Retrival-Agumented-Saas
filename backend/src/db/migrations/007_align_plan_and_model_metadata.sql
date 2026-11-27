-- 007: Align stored metadata with what the application actually enforces/uses.
--  * FREE subscriptions were created with max_monthly_tokens = 1,000,000 while the
--    enforced FREE limit is 100,000 (subscription.types.ts). Correct untouched FREE rows.
--  * knowledge_bases.embedding_model defaulted to 'text-embedding-3-small', a model this
--    platform has never used. Record the local model actually used for indexing.
UPDATE subscriptions SET max_monthly_tokens = 100000
 WHERE plan_tier = 'FREE' AND max_monthly_tokens = 1000000;

ALTER TABLE knowledge_bases ALTER COLUMN embedding_model SET DEFAULT 'Xenova/all-MiniLM-L6-v2';
UPDATE knowledge_bases SET embedding_model = 'Xenova/all-MiniLM-L6-v2'
 WHERE embedding_model = 'text-embedding-3-small';
