-- CreateTable
CREATE TABLE "FavoriteDish" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteDish_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FavoriteDish_key_idx" ON "FavoriteDish"("key");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteDish_userId_key_key" ON "FavoriteDish"("userId", "key");

-- AddForeignKey
ALTER TABLE "FavoriteDish" ADD CONSTRAINT "FavoriteDish_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Contraintes : nom lisible (2 à 120 caractères), clé de comparaison non vide
ALTER TABLE "FavoriteDish" ADD CONSTRAINT "FavoriteDish_name_check" CHECK (char_length("name") BETWEEN 2 AND 120);
ALTER TABLE "FavoriteDish" ADD CONSTRAINT "FavoriteDish_key_check" CHECK (char_length("key") BETWEEN 1 AND 120);
