-- CreateTable
CREATE TABLE "ImportToken" (
    "id" TEXT NOT NULL,
    "hashedToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImportToken_hashedToken_key" ON "ImportToken"("hashedToken");

-- CreateIndex
CREATE INDEX "ImportToken_userId_idx" ON "ImportToken"("userId");

-- AddForeignKey
ALTER TABLE "ImportToken" ADD CONSTRAINT "ImportToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

