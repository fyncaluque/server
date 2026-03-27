-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "authId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "wakeUpTime" TEXT NOT NULL,
    "bedTime" TEXT NOT NULL,
    "sleepHours" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "peakEnergyStart" TEXT NOT NULL DEFAULT '09:00',
    "peakEnergyEnd" TEXT NOT NULL DEFAULT '12:00',
    "lowEnergyStart" TEXT,
    "lowEnergyEnd" TEXT,
    "lifestyle" TEXT NOT NULL DEFAULT 'balanced',
    "workType" TEXT,
    "workStart" TEXT,
    "workEnd" TEXT,
    "workDays" TEXT[],
    "goals" TEXT[],
    "interests" TEXT[],
    "exercisePreference" TEXT,
    "mealTimes" JSONB,
    "fixedCommitments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "blocks" JSONB NOT NULL,
    "suggestions" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_authId_key" ON "profiles"("authId");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");

-- CreateIndex
CREATE INDEX "schedules_profileId_date_idx" ON "schedules"("profileId", "date");

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
