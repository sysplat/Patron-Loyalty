-- DropForeignKey
ALTER TABLE "desks" DROP CONSTRAINT "desks_assigned_user_id_fkey";

-- DropIndex
DROP INDEX "branch_flow_steps_queue_id_idx";

-- DropIndex
DROP INDEX "branch_flow_steps_template_id_idx";

-- DropIndex
DROP INDEX "branch_flow_steps_template_id_queue_id_key";

-- DropIndex
DROP INDEX "branch_flow_templates_branch_id_is_active_idx";

-- DropIndex
DROP INDEX "branch_flow_templates_branch_id_name_key";

-- DropIndex
DROP INDEX "branch_flow_templates_org_id_idx";

-- DropIndex
DROP INDEX "customers_org_id_marketing_sms_opt_in_idx";

-- DropIndex
DROP INDEX "tickets_org_id_legal_hold_status_booked_at_idx";

-- AlterTable
ALTER TABLE "announcements" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "branch_date_overrides" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "branch_flow_steps" DROP COLUMN "created_at",
DROP COLUMN "updated_at",
ALTER COLUMN "queue_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "branch_flow_templates" ADD COLUMN     "description" VARCHAR(255),
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "marketing_sms_opt_in",
DROP COLUMN "marketing_sms_opt_in_at";

-- AlterTable
ALTER TABLE "desks" DROP COLUMN "assigned_user_id",
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "services" ALTER COLUMN "duration_minutes" SET NOT NULL;

-- AlterTable
ALTER TABLE "support_requests" ADD COLUMN     "has_unread_platform_reply" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "has_unread_tenant_reply" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
CREATE SEQUENCE tickets_ticket_number_seq;
ALTER TABLE "tickets" DROP COLUMN "marketing_sms_opt_in",
DROP COLUMN "marketing_sms_opt_in_at",
ADD COLUMN     "customer_id" UUID,
ADD COLUMN     "estimated_remaining_mins" INTEGER,
ADD COLUMN     "is_exceptional" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "language" VARCHAR(10),
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "note" VARCHAR(500),
ADD COLUMN     "service_minutes" INTEGER,
ADD COLUMN     "wait_minutes" INTEGER,
ALTER COLUMN "ticket_number" SET DEFAULT nextval('tickets_ticket_number_seq');
ALTER SEQUENCE tickets_ticket_number_seq OWNED BY "tickets"."ticket_number";

-- AlterTable
ALTER TABLE "visits" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "_AssignedUser" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_AssignedUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_AssignedUser_B_index" ON "_AssignedUser"("B");

-- CreateIndex
CREATE INDEX "announcements_branch_id_display_on_screen_idx" ON "announcements"("branch_id", "display_on_screen");

-- CreateIndex
CREATE INDEX "appointments_org_id_customer_phone_idx" ON "appointments"("org_id", "customer_phone");

-- CreateIndex
CREATE INDEX "desks_branch_id_idx" ON "desks"("branch_id");

-- CreateIndex
CREATE INDEX "platform_announcements_is_active_created_at_idx" ON "platform_announcements"("is_active", "created_at" DESC);

-- CreateIndex
CREATE INDEX "tickets_org_id_created_at_idx" ON "tickets"("org_id", "created_at");

-- CreateIndex
CREATE INDEX "tickets_org_id_booked_at_idx" ON "tickets"("org_id", "booked_at");

-- CreateIndex
CREATE INDEX "tickets_org_id_completed_at_idx" ON "tickets"("org_id", "completed_at");

-- CreateIndex
CREATE INDEX "tickets_org_id_customer_phone_idx" ON "tickets"("org_id", "customer_phone");

-- CreateIndex
CREATE INDEX "visits_org_id_customer_phone_idx" ON "visits"("org_id", "customer_phone");

-- AddForeignKey
ALTER TABLE "_AssignedUser" ADD CONSTRAINT "_AssignedUser_A_fkey" FOREIGN KEY ("A") REFERENCES "desks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AssignedUser" ADD CONSTRAINT "_AssignedUser_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "announcement_user_states_source_type_announcement_id_announceme" RENAME TO "announcement_user_states_source_type_announcement_id_announ_idx";

-- RenameIndex
ALTER INDEX "announcement_user_states_user_id_source_type_announcement_id_an" RENAME TO "announcement_user_states_user_id_source_type_announcement_i_key";

