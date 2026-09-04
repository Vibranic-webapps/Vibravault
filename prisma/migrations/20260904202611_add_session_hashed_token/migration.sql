-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "hashedToken" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Session_hashedToken_key" ON "Session"("hashedToken");

