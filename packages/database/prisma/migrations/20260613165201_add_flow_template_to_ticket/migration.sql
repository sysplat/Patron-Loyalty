-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "flow_template_id" UUID;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_flow_template_id_fkey" FOREIGN KEY ("flow_template_id") REFERENCES "branch_flow_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
