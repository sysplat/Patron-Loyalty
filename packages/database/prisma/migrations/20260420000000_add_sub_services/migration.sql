-- CreateTable: sub_services
CREATE TABLE "sub_services" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "service_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "duration_minutes" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sub_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sub_services_service_id_idx" ON "sub_services"("service_id");

-- AddForeignKey
ALTER TABLE "sub_services" ADD CONSTRAINT "sub_services_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: add sub_service_id to appointments
ALTER TABLE "appointments" ADD COLUMN "sub_service_id" UUID;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_sub_service_id_fkey"
    FOREIGN KEY ("sub_service_id") REFERENCES "sub_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
