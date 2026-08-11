-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'manager', 'supervisor', 'user');

-- CreateEnum
CREATE TYPE "PurchaseLocation" AS ENUM ('Tehran', 'Urmia');

-- CreateTable
CREATE TABLE "departments" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL,
    "password" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "department_id" INTEGER,
    "work_type" TEXT DEFAULT 'normal',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "username" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "last_login" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signatures" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "image_data" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digital_signatures" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "signature_data" TEXT NOT NULL,
    "signature_type" TEXT NOT NULL DEFAULT 'drawn',
    "scanned_signature" TEXT,
    "employee_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "digital_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signature_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "signature_id" INTEGER,
    "module_name" TEXT,
    "record_id" INTEGER,
    "action" TEXT NOT NULL,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signature_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "leave_type" TEXT NOT NULL,
    "start_date" TEXT NOT NULL,
    "end_date" TEXT NOT NULL,
    "start_hour" TEXT,
    "end_hour" TEXT,
    "hours_count" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_supervisor',
    "supervisor_id" INTEGER,
    "supervisor_comment" TEXT,
    "supervisor_date" TEXT,
    "admin_id" INTEGER,
    "admin_comment" TEXT,
    "admin_date" TEXT,
    "manager_id" INTEGER,
    "manager_comment" TEXT,
    "manager_date" TEXT,
    "security_id" INTEGER,
    "security_date" TEXT,
    "edited_by" INTEGER,
    "edited_at" TEXT,
    "edit_reason" TEXT,
    "remaining_leave_days" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balance" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "total_days" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "used_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "leave_balance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_change_logs" (
    "id" SERIAL NOT NULL,
    "action_by" INTEGER NOT NULL,
    "action_type" TEXT NOT NULL,
    "target_id" INTEGER NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "official_holidays" (
    "id" SERIAL NOT NULL,
    "holiday_date" TEXT NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "official_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overtime_requests" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "start_date" TEXT NOT NULL,
    "end_date" TEXT NOT NULL,
    "start_hour" TEXT,
    "end_hour" TEXT,
    "hours_count" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_supervisor',
    "supervisor_id" INTEGER,
    "supervisor_comment" TEXT,
    "supervisor_date" TEXT,
    "manager_id" INTEGER,
    "manager_comment" TEXT,
    "manager_date" TEXT,
    "security_id" INTEGER,
    "security_date" TEXT,
    "edited_by" INTEGER,
    "edited_at" TEXT,
    "edit_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overtime_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "letters" (
    "id" SERIAL NOT NULL,
    "letter_number" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "sender_id" INTEGER NOT NULL,
    "sender_unit_id" INTEGER NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'pending_central',
    "selected_manager_id" INTEGER,
    "central_id" INTEGER,
    "central_date" TEXT,
    "central_comment" TEXT,
    "manager_id" INTEGER,
    "manager_comment" TEXT,
    "manager_date" TEXT,
    "signature_data" TEXT,
    "attachment_name" TEXT,
    "attachment_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "letters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "letter_units" (
    "id" SERIAL NOT NULL,
    "letter_id" INTEGER NOT NULL,
    "unit_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "seen_date" TEXT,

    CONSTRAINT "letter_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "letter_attachments" (
    "id" SERIAL NOT NULL,
    "letter_id" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "letter_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "letter_counter" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "letter_counter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "letter_history" (
    "id" SERIAL NOT NULL,
    "letter_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "user_name" TEXT,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "letter_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requests" (
    "id" SERIAL NOT NULL,
    "request_number" TEXT,
    "user_id" INTEGER NOT NULL,
    "department" TEXT,
    "description" TEXT,
    "reason" TEXT,
    "urgency" TEXT NOT NULL DEFAULT 'normal',
    "department_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending_supervisor',
    "supervisor_id" INTEGER,
    "supervisor_comment" TEXT,
    "supervisor_date" TEXT,
    "manager_id" INTEGER,
    "manager_comment" TEXT,
    "manager_date" TEXT,
    "warehouse_id" INTEGER,
    "warehouse_comment" TEXT,
    "warehouse_date" TEXT,
    "factory_manager_id" INTEGER,
    "factory_manager_comment" TEXT,
    "factory_manager_date" TEXT,
    "budget_id" INTEGER,
    "budget_comment" TEXT,
    "budget_date" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_items" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "row_index" INTEGER NOT NULL DEFAULT 0,
    "item_code" TEXT,
    "description" TEXT,
    "purchase_location" TEXT,
    "technical_specs" TEXT,
    "requested_quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "approved_quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usage_location" TEXT,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT,

    CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_counter" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_counter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_history" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "user_name" TEXT,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mission_requests" (
    "id" SERIAL NOT NULL,
    "request_number" TEXT,
    "user_id" INTEGER NOT NULL,
    "mission_date" TEXT NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "destination" TEXT,
    "mission_type" TEXT,
    "description" TEXT,
    "reason" TEXT,
    "department_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending_supervisor',
    "supervisor_id" INTEGER,
    "supervisor_comment" TEXT,
    "supervisor_date" TEXT,
    "manager_id" INTEGER,
    "manager_comment" TEXT,
    "manager_date" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mission_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mission_counter" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "mission_counter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mission_history" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "user_name" TEXT,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mission_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_requests" (
    "id" SERIAL NOT NULL,
    "request_number" TEXT,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "equipment_name" TEXT,
    "location" TEXT,
    "urgency" TEXT NOT NULL DEFAULT 'normal',
    "estimated_cost" TEXT,
    "desired_date" TEXT,
    "department_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending_supervisor',
    "images" TEXT,
    "supervisor_id" INTEGER,
    "supervisor_comment" TEXT,
    "supervisor_date" TEXT,
    "manager_id" INTEGER,
    "manager_comment" TEXT,
    "manager_date" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repair_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_counter" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "repair_counter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_history" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "user_name" TEXT,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_external_requests" (
    "id" SERIAL NOT NULL,
    "request_number" TEXT,
    "user_id" INTEGER NOT NULL,
    "department_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "doc_code" TEXT DEFAULT 'PM_01',
    "edit_date" TEXT,
    "revision_number" TEXT,
    "form_date" TEXT,
    "from_unit" TEXT,
    "to_unit" TEXT,
    "manager_name" TEXT,
    "request_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "urgency" TEXT NOT NULL DEFAULT 'normal',
    "repair_speed" TEXT NOT NULL DEFAULT 'urgent',
    "deadline" TEXT,
    "work_type" TEXT,
    "tech_description" TEXT,
    "estimated_cost" TEXT,
    "fault_description" TEXT,
    "fault_reason" TEXT,
    "warehouse_stock" INTEGER DEFAULT 0,
    "warehouse_stock_status" TEXT,
    "equipment_name" TEXT,
    "sketch_file" TEXT,
    "photo_file" TEXT,
    "delivery_date" TEXT,
    "send_date" TEXT,
    "send_serial" TEXT,
    "destination" TEXT,
    "contractor_name" TEXT,
    "contractor_address" TEXT,
    "repair_description" TEXT,
    "repair_cost" TEXT,
    "supporter_name" TEXT,
    "return_date" TEXT,
    "return_serial" TEXT,
    "quality_status" TEXT,
    "quality_notes" TEXT,
    "images" TEXT,
    "pm_approved" BOOLEAN NOT NULL DEFAULT false,
    "pm_approved_at" TEXT,
    "pm_id" INTEGER,
    "dept_manager_approved" BOOLEAN NOT NULL DEFAULT false,
    "dept_manager_approved_at" TEXT,
    "dept_manager_id" INTEGER,
    "tech_manager_approved" BOOLEAN NOT NULL DEFAULT false,
    "tech_manager_approved_at" TEXT,
    "tech_manager_id" INTEGER,
    "warehouse_approved" BOOLEAN NOT NULL DEFAULT false,
    "warehouse_approved_at" TEXT,
    "warehouse_id" INTEGER,
    "factory_manager_approved" BOOLEAN NOT NULL DEFAULT false,
    "factory_manager_approved_at" TEXT,
    "factory_manager_id" INTEGER,
    "support_completed" BOOLEAN NOT NULL DEFAULT false,
    "support_completed_at" TEXT,
    "quality_approved" BOOLEAN NOT NULL DEFAULT false,
    "quality_approved_at" TEXT,
    "final_warehouse_approved" BOOLEAN NOT NULL DEFAULT false,
    "final_warehouse_approved_at" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repair_external_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_external_items" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "item_name" TEXT,
    "tech_specs" TEXT,
    "serial_number" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "attachments_desc" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repair_external_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_external_history" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "user_name" TEXT,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "old_status" TEXT,
    "new_status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_external_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_requests" (
    "id" SERIAL NOT NULL,
    "request_number" TEXT,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "equipment_name" TEXT,
    "location" TEXT,
    "inspection_type" TEXT,
    "urgency" TEXT NOT NULL DEFAULT 'normal',
    "deadline" TEXT,
    "department_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending_supervisor',
    "supervisor_id" INTEGER,
    "supervisor_comment" TEXT,
    "supervisor_date" TEXT,
    "manager_id" INTEGER,
    "manager_comment" TEXT,
    "manager_date" TEXT,
    "inspection_result" TEXT,
    "assigned_to" INTEGER,
    "inspection_description" TEXT,
    "inspect_date" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspection_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_counter" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "inspection_counter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_history" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "user_name" TEXT,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_output" (
    "id" SERIAL NOT NULL,
    "report_number" TEXT,
    "user_id" INTEGER NOT NULL,
    "report_date" TEXT NOT NULL,
    "product_name" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT DEFAULT 'عدد',
    "quality_score" DOUBLE PRECISION,
    "description" TEXT,
    "machine_number" TEXT,
    "product_type" TEXT,
    "department_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "supervisor_id" INTEGER,
    "supervisor_comment" TEXT,
    "supervisor_date" TEXT,
    "manager_id" INTEGER,
    "manager_comment" TEXT,
    "manager_date" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_output_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_output_history" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "user_name" TEXT,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_output_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_work_reports" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "report_date" TEXT NOT NULL,
    "work_description" TEXT NOT NULL,
    "work_duration" TEXT,
    "department_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending_central',
    "central_comment" TEXT,
    "central_by" INTEGER,
    "central_at" TEXT,
    "manager_comment" TEXT,
    "manager_by" INTEGER,
    "manager_at" TEXT,
    "project_control_comment" TEXT,
    "project_control_by" INTEGER,
    "project_control_at" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_work_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_work_report_history" (
    "id" SERIAL NOT NULL,
    "report_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "user_name" TEXT,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_work_report_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "it_requests" (
    "id" SERIAL NOT NULL,
    "request_number" TEXT,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "request_type" TEXT,
    "urgency" TEXT NOT NULL DEFAULT 'normal',
    "device_info" TEXT,
    "assigned_to" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completion_comment" TEXT,
    "reject_comment" TEXT,
    "completed_at" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "it_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "it_request_counter" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "it_request_counter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "it_request_history" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "user_name" TEXT,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "it_request_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_templates" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "module_name" TEXT NOT NULL,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_instances" (
    "id" SERIAL NOT NULL,
    "template_id" INTEGER NOT NULL,
    "record_id" INTEGER NOT NULL,
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "started_by" INTEGER,
    "completed_at" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_steps_log" (
    "id" SERIAL NOT NULL,
    "instance_id" INTEGER NOT NULL,
    "step_index" INTEGER NOT NULL,
    "actor_id" INTEGER,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_steps_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" SERIAL NOT NULL,
    "request_number" TEXT,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "work_type" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "estimated_cost" TEXT,
    "deadline" TEXT,
    "department_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending_supervisor',
    "supervisor_id" INTEGER,
    "supervisor_comment" TEXT,
    "supervisor_date" TEXT,
    "manager_id" INTEGER,
    "manager_comment" TEXT,
    "manager_date" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_counter" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "work_order_counter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_history" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "user_name" TEXT,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_requests" (
    "id" SERIAL NOT NULL,
    "request_number" TEXT,
    "user_id" INTEGER NOT NULL,
    "amount" TEXT NOT NULL,
    "payment_type" TEXT NOT NULL,
    "description" TEXT,
    "reason" TEXT,
    "recipient_name" TEXT,
    "bank_name" TEXT,
    "card_number" TEXT,
    "payment_date" TEXT,
    "department_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending_supervisor',
    "supervisor_id" INTEGER,
    "supervisor_comment" TEXT,
    "supervisor_date" TEXT,
    "manager_id" INTEGER,
    "manager_comment" TEXT,
    "manager_date" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_counter" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "payment_counter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_history" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "user_name" TEXT,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT DEFAULT 'عدد',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cardex" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "delivery_date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_user',
    "warehouse_user_id" INTEGER NOT NULL,
    "notes" TEXT,
    "user_confirm_date" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cardex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_menu" (
    "id" SERIAL NOT NULL,
    "food_date" TEXT NOT NULL,
    "option_number" INTEGER NOT NULL DEFAULT 1,
    "food_name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_reservations" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "food_id" INTEGER NOT NULL,
    "food_date" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_shifts" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "start_time" TEXT NOT NULL DEFAULT '',
    "end_time" TEXT NOT NULL DEFAULT '',
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_shift_assignments" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "shift_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_change_requests" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "current_shift_id" INTEGER,
    "requested_shift_id" INTEGER NOT NULL,
    "requested_date" TEXT,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewed_by" INTEGER,
    "reviewed_at" TEXT,
    "review_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "image_path" TEXT,
    "target_audience" TEXT NOT NULL DEFAULT 'all',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" SERIAL NOT NULL,
    "module_key" TEXT NOT NULL,
    "department_id" INTEGER,
    "user_id" INTEGER,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_rooms" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "type" TEXT NOT NULL DEFAULT 'direct',
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_members" (
    "id" SERIAL NOT NULL,
    "room_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "last_read_at" TEXT,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" SERIAL NOT NULL,
    "room_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "message_type" TEXT NOT NULL DEFAULT 'text',
    "attachment_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conference_bookings" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "booking_date" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "attendees_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "manager_id" INTEGER,
    "manager_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conference_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conference_counter" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "conference_counter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conference_history" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "user_name" TEXT,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conference_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_reports" (
    "id" SERIAL NOT NULL,
    "report_number" TEXT,
    "user_id" INTEGER NOT NULL,
    "report_date" TEXT NOT NULL,
    "shift_type" TEXT,
    "incidents" TEXT,
    "visitors" TEXT,
    "vehicles" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "supervisor_id" INTEGER,
    "supervisor_comment" TEXT,
    "supervisor_date" TEXT,
    "manager_id" INTEGER,
    "manager_comment" TEXT,
    "manager_date" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_history" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "user_name" TEXT,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_supply_requests" (
    "id" SERIAL NOT NULL,
    "request_number" TEXT,
    "user_id" INTEGER NOT NULL,
    "project_name" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "description" TEXT,
    "urgency" TEXT NOT NULL DEFAULT 'normal',
    "estimated_cost" TEXT,
    "deadline" TEXT,
    "department_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending_supervisor',
    "supervisor_id" INTEGER,
    "supervisor_comment" TEXT,
    "supervisor_date" TEXT,
    "manager_id" INTEGER,
    "manager_comment" TEXT,
    "manager_date" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_supply_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_supply_counter" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "project_supply_counter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_supply_history" (
    "id" SERIAL NOT NULL,
    "supply_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "user_name" TEXT,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_supply_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_applications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "application_number" TEXT,
    "full_name" TEXT NOT NULL,
    "father_name" TEXT,
    "national_id" TEXT,
    "national_id_issued_from" TEXT,
    "birth_date" TEXT,
    "birth_place" TEXT,
    "residence_duration" TEXT,
    "nationality" TEXT DEFAULT 'ایرانی',
    "religion" TEXT,
    "language" TEXT,
    "education_level" TEXT,
    "education_place" TEXT,
    "military_status" TEXT,
    "military_done" TEXT DEFAULT 'خیر',
    "military_service_type" TEXT,
    "military_exempt_non_medical" TEXT,
    "military_exempt_medical" TEXT,
    "military_exempt_reason" TEXT,
    "marital_status" TEXT,
    "children_count" INTEGER NOT NULL DEFAULT 0,
    "spouse_job" TEXT,
    "requested_salary" TEXT DEFAULT '0',
    "housing_status" TEXT,
    "housing_rent_amount" TEXT DEFAULT '0',
    "residential_address" TEXT,
    "phone_number" TEXT,
    "moral_traits" TEXT,
    "relatives_in_company" TEXT DEFAULT 'خیر',
    "relatives_details" TEXT,
    "criminal_record" TEXT DEFAULT 'خیر',
    "kave_factories" TEXT,
    "smoking" TEXT DEFAULT 'خیر',
    "smoking_duration" TEXT,
    "foreign_languages" TEXT,
    "turkish_known" TEXT DEFAULT 'خیر',
    "computer_skills" TEXT,
    "training_courses" TEXT,
    "references_info" TEXT,
    "photo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "reviewed_by" INTEGER,
    "reviewed_at" TEXT,
    "review_comment" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_application_work_history" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "org_name" TEXT,
    "position" TEXT,
    "duration" TEXT,
    "last_salary" TEXT,
    "leave_reason" TEXT,
    "contact_info" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "job_application_work_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_application_attachments" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_application_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_application_counter" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "job_application_counter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "educational_materials" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'pdf',
    "file_url" TEXT NOT NULL,
    "file_type" TEXT,
    "file_size" INTEGER NOT NULL DEFAULT 0,
    "thumbnail_url" TEXT,
    "target_audience" TEXT NOT NULL DEFAULT 'all',
    "tags" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "uploaded_by" INTEGER NOT NULL,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "educational_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "module_name" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "filename" TEXT NOT NULL,
    "original_name" TEXT,
    "mimetype" TEXT,
    "size" INTEGER,
    "url" TEXT NOT NULL,
    "module_name" TEXT,
    "record_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_codes" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expires_at" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" INTEGER,

    CONSTRAINT "sms_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_settings" (
    "id" SERIAL NOT NULL,
    "daily_path" TEXT,
    "weekly_path" TEXT,
    "daily_hour" INTEGER NOT NULL DEFAULT 23,
    "daily_minute" INTEGER NOT NULL DEFAULT 0,
    "weekly_day" INTEGER NOT NULL DEFAULT 5,
    "weekly_hour" INTEGER NOT NULL DEFAULT 14,
    "weekly_minute" INTEGER NOT NULL DEFAULT 0,
    "daily_retention_days" INTEGER NOT NULL DEFAULT 30,
    "weekly_retention_weeks" INTEGER NOT NULL DEFAULT 12,
    "daily_enabled" BOOLEAN NOT NULL DEFAULT true,
    "weekly_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "backup_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_logs" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "db_file" TEXT,
    "db_size" INTEGER,
    "uploads_file" TEXT,
    "uploads_size" INTEGER,
    "uploads_files" INTEGER,
    "backup_dir" TEXT,
    "status" TEXT NOT NULL DEFAULT 'success',
    "error" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "backup_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csv_imports_log" (
    "id" SERIAL NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "imported_by" INTEGER NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "row_count" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csv_imports_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "signatures_user_id_key" ON "signatures"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "digital_signatures_user_id_key" ON "digital_signatures"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balance_user_id_key" ON "leave_balance"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "official_holidays_holiday_date_key" ON "official_holidays"("holiday_date");

-- CreateIndex
CREATE UNIQUE INDEX "letter_counter_year_key" ON "letter_counter"("year");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_counter_year_key" ON "purchase_counter"("year");

-- CreateIndex
CREATE UNIQUE INDEX "mission_counter_year_key" ON "mission_counter"("year");

-- CreateIndex
CREATE UNIQUE INDEX "repair_counter_year_key" ON "repair_counter"("year");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_counter_year_key" ON "inspection_counter"("year");

-- CreateIndex
CREATE UNIQUE INDEX "it_request_counter_year_key" ON "it_request_counter"("year");

-- CreateIndex
CREATE UNIQUE INDEX "work_order_counter_year_key" ON "work_order_counter"("year");

-- CreateIndex
CREATE UNIQUE INDEX "payment_counter_year_key" ON "payment_counter"("year");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_menu_food_date_option_number_key" ON "restaurant_menu"("food_date", "option_number");

-- CreateIndex
CREATE UNIQUE INDEX "chat_members_room_id_user_id_key" ON "chat_members"("room_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "conference_counter_year_key" ON "conference_counter"("year");

-- CreateIndex
CREATE UNIQUE INDEX "project_supply_counter_year_key" ON "project_supply_counter"("year");

-- CreateIndex
CREATE UNIQUE INDEX "job_application_counter_year_key" ON "job_application_counter"("year");

-- CreateIndex
CREATE INDEX "sms_codes_phone_idx" ON "sms_codes"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_signatures" ADD CONSTRAINT "digital_signatures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_logs" ADD CONSTRAINT "signature_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_logs" ADD CONSTRAINT "signature_logs_signature_id_fkey" FOREIGN KEY ("signature_id") REFERENCES "digital_signatures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balance" ADD CONSTRAINT "leave_balance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_change_logs" ADD CONSTRAINT "leave_change_logs_action_by_fkey" FOREIGN KEY ("action_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letters" ADD CONSTRAINT "letters_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letters" ADD CONSTRAINT "letters_sender_unit_id_fkey" FOREIGN KEY ("sender_unit_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letters" ADD CONSTRAINT "letters_selected_manager_id_fkey" FOREIGN KEY ("selected_manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letters" ADD CONSTRAINT "letters_central_id_fkey" FOREIGN KEY ("central_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letters" ADD CONSTRAINT "letters_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letter_units" ADD CONSTRAINT "letter_units_letter_id_fkey" FOREIGN KEY ("letter_id") REFERENCES "letters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letter_units" ADD CONSTRAINT "letter_units_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letter_attachments" ADD CONSTRAINT "letter_attachments_letter_id_fkey" FOREIGN KEY ("letter_id") REFERENCES "letters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letter_history" ADD CONSTRAINT "letter_history_letter_id_fkey" FOREIGN KEY ("letter_id") REFERENCES "letters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letter_history" ADD CONSTRAINT "letter_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_requests" ADD CONSTRAINT "mission_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_requests" ADD CONSTRAINT "mission_requests_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_history" ADD CONSTRAINT "mission_history_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "mission_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_requests" ADD CONSTRAINT "repair_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_requests" ADD CONSTRAINT "repair_requests_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_history" ADD CONSTRAINT "repair_history_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "repair_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_external_requests" ADD CONSTRAINT "repair_external_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_external_requests" ADD CONSTRAINT "repair_external_requests_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_external_items" ADD CONSTRAINT "repair_external_items_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "repair_external_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_external_history" ADD CONSTRAINT "repair_external_history_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "repair_external_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_requests" ADD CONSTRAINT "inspection_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_requests" ADD CONSTRAINT "inspection_requests_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_history" ADD CONSTRAINT "inspection_history_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "inspection_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_output" ADD CONSTRAINT "daily_output_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_output" ADD CONSTRAINT "daily_output_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_output_history" ADD CONSTRAINT "daily_output_history_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "daily_output"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_work_reports" ADD CONSTRAINT "daily_work_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_work_reports" ADD CONSTRAINT "daily_work_reports_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_work_report_history" ADD CONSTRAINT "daily_work_report_history_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "daily_work_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_requests" ADD CONSTRAINT "it_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_requests" ADD CONSTRAINT "it_requests_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_request_history" ADD CONSTRAINT "it_request_history_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "it_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_templates" ADD CONSTRAINT "workflow_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "workflow_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_started_by_fkey" FOREIGN KEY ("started_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_steps_log" ADD CONSTRAINT "workflow_steps_log_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "workflow_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_steps_log" ADD CONSTRAINT "workflow_steps_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_history" ADD CONSTRAINT "work_order_history_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_history" ADD CONSTRAINT "payment_history_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "payment_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cardex" ADD CONSTRAINT "cardex_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cardex" ADD CONSTRAINT "cardex_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cardex" ADD CONSTRAINT "cardex_warehouse_user_id_fkey" FOREIGN KEY ("warehouse_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_reservations" ADD CONSTRAINT "restaurant_reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_reservations" ADD CONSTRAINT "restaurant_reservations_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "restaurant_menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_shift_assignments" ADD CONSTRAINT "user_shift_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_shift_assignments" ADD CONSTRAINT "user_shift_assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "work_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_change_requests" ADD CONSTRAINT "shift_change_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_change_requests" ADD CONSTRAINT "shift_change_requests_current_shift_id_fkey" FOREIGN KEY ("current_shift_id") REFERENCES "work_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_change_requests" ADD CONSTRAINT "shift_change_requests_requested_shift_id_fkey" FOREIGN KEY ("requested_shift_id") REFERENCES "work_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_change_requests" ADD CONSTRAINT "shift_change_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_members" ADD CONSTRAINT "chat_members_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_members" ADD CONSTRAINT "chat_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_bookings" ADD CONSTRAINT "conference_bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_history" ADD CONSTRAINT "conference_history_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "conference_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_reports" ADD CONSTRAINT "security_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_history" ADD CONSTRAINT "security_history_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "security_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_supply_requests" ADD CONSTRAINT "project_supply_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_supply_requests" ADD CONSTRAINT "project_supply_requests_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_supply_history" ADD CONSTRAINT "project_supply_history_supply_id_fkey" FOREIGN KEY ("supply_id") REFERENCES "project_supply_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_application_work_history" ADD CONSTRAINT "job_application_work_history_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_application_attachments" ADD CONSTRAINT "job_application_attachments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "educational_materials" ADD CONSTRAINT "educational_materials_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_codes" ADD CONSTRAINT "sms_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_logs" ADD CONSTRAINT "backup_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csv_imports_log" ADD CONSTRAINT "csv_imports_log_imported_by_fkey" FOREIGN KEY ("imported_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
