-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phoneNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "document" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phoneNumber" TEXT NOT NULL,
    "saleNumber" INTEGER NOT NULL,
    "product" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "pricePerUnit" REAL NOT NULL,
    "totalPrice" REAL NOT NULL,
    "saleDate" DATETIME NOT NULL,
    "salesperson" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConversationState" (
    "phoneNumber" TEXT NOT NULL PRIMARY KEY,
    "userName" TEXT,
    "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pendingAction" TEXT,
    "pendingConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "pendingExpiresAt" DATETIME,
    "lastSaleNumber" INTEGER,
    "lastCustomerName" TEXT
);

-- CreateIndex
CREATE INDEX "Customer_phoneNumber_idx" ON "Customer"("phoneNumber");

-- CreateIndex
CREATE INDEX "Customer_nameNormalized_idx" ON "Customer"("nameNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phoneNumber_nameNormalized_key" ON "Customer"("phoneNumber", "nameNormalized");

-- CreateIndex
CREATE INDEX "Sale_phoneNumber_saleDate_idx" ON "Sale"("phoneNumber", "saleDate");

-- CreateIndex
CREATE INDEX "Sale_customerId_idx" ON "Sale"("customerId");

-- CreateIndex
CREATE INDEX "Sale_salesperson_idx" ON "Sale"("salesperson");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_phoneNumber_saleNumber_key" ON "Sale"("phoneNumber", "saleNumber");

-- CreateIndex
CREATE INDEX "ConversationState_lastMessageAt_idx" ON "ConversationState"("lastMessageAt");

-- CreateIndex
CREATE INDEX "ConversationState_pendingExpiresAt_idx" ON "ConversationState"("pendingExpiresAt");
