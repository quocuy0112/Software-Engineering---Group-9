CREATE INDEX "user_name_trgm_idx" ON "user" USING GIN ("name" gin_trgm_ops);
