-- CreateTable
CREATE TABLE "MenuPhoto" (
    "date" DATE NOT NULL,
    "course" "Course" NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuPhoto_pkey" PRIMARY KEY ("date","course")
);


-- Contraintes : formats d'image sûrs uniquement (jamais de SVG), 1,5 Mo au plus, taille cohérente avec les données
ALTER TABLE "MenuPhoto" ADD CONSTRAINT "MenuPhoto_mime_check" CHECK ("mime" IN ('image/jpeg', 'image/png', 'image/webp'));
ALTER TABLE "MenuPhoto" ADD CONSTRAINT "MenuPhoto_size_check" CHECK ("size" > 0 AND "size" <= 1572864 AND "size" = octet_length("data"));
