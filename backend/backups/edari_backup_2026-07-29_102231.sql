--
-- PostgreSQL database dump
--

\restrict ZRFrycgq4Vto7ni7NPP1yshfBdMtZ0MfIR5mTo1Hzev0eOM4fczxGDLSUCP844m

-- Dumped from database version 17.10
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: datetime(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.datetime(dummy text DEFAULT 'now'::text) RETURNS text
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RETURN to_char(now(), 'YYYY-MM-DD HH24:MI:SS');
    END;
    $$;


--
-- Name: last_insert_rowid(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.last_insert_rowid() RETURNS integer
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RETURN lastval();
    END;
    $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_log (
    id integer NOT NULL,
    user_id integer,
    action text NOT NULL,
    details text,
    ip_address text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
    module_name text
);


--
-- Name: activity_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.activity_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: activity_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.activity_log_id_seq OWNED BY public.activity_log.id;


--
-- Name: announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcements (
    id integer NOT NULL,
    title text NOT NULL,
    body text,
    image_path text,
    target_audience text DEFAULT 'all'::text NOT NULL,
    priority text DEFAULT 'normal'::text,
    is_active integer DEFAULT 1,
    created_by integer,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: announcements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.announcements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: announcements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.announcements_id_seq OWNED BY public.announcements.id;


--
-- Name: attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attachments (
    id integer NOT NULL,
    user_id integer,
    filename text NOT NULL,
    original_name text,
    mimetype text,
    size integer,
    url text NOT NULL,
    module_name text,
    record_id integer,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.attachments_id_seq OWNED BY public.attachments.id;


--
-- Name: backup_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_logs (
    id integer NOT NULL,
    type text NOT NULL,
    date text NOT NULL,
    db_file text,
    db_size integer,
    uploads_file text,
    uploads_size integer,
    uploads_files integer,
    backup_dir text,
    status text DEFAULT 'success'::text,
    error text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: backup_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.backup_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: backup_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.backup_logs_id_seq OWNED BY public.backup_logs.id;


--
-- Name: backup_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_settings (
    id integer DEFAULT 1 NOT NULL,
    daily_path text,
    weekly_path text,
    daily_hour integer DEFAULT 23,
    daily_minute integer DEFAULT 0,
    weekly_day integer DEFAULT 5,
    weekly_hour integer DEFAULT 14,
    weekly_minute integer DEFAULT 0,
    daily_retention_days integer DEFAULT 30,
    weekly_retention_weeks integer DEFAULT 12,
    daily_enabled integer DEFAULT 1,
    weekly_enabled integer DEFAULT 1,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
    updated_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: cardex; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cardex (
    id integer NOT NULL,
    user_id integer NOT NULL,
    item_id integer NOT NULL,
    quantity real NOT NULL,
    delivery_date text NOT NULL,
    status text DEFAULT 'pending_user'::text,
    warehouse_user_id integer NOT NULL,
    notes text,
    user_confirm_date text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: cardex_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cardex_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cardex_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cardex_id_seq OWNED BY public.cardex.id;


--
-- Name: chat_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_members (
    id integer NOT NULL,
    room_id integer NOT NULL,
    user_id integer NOT NULL,
    last_read_at text,
    joined_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: chat_members_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_members_id_seq OWNED BY public.chat_members.id;


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id integer NOT NULL,
    room_id integer NOT NULL,
    user_id integer NOT NULL,
    message text NOT NULL,
    message_type text DEFAULT 'text'::text,
    attachment_url text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_messages_id_seq OWNED BY public.chat_messages.id;


--
-- Name: chat_rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_rooms (
    id integer NOT NULL,
    name text,
    type text DEFAULT 'direct'::text,
    created_by integer,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: chat_rooms_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_rooms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_rooms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_rooms_id_seq OWNED BY public.chat_rooms.id;


--
-- Name: conference_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conference_bookings (
    id integer NOT NULL,
    user_id integer NOT NULL,
    request_number text,
    meeting_date text NOT NULL,
    start_time text NOT NULL,
    end_time text NOT NULL,
    title text NOT NULL,
    description text,
    attendees_count integer DEFAULT 0,
    status text DEFAULT 'pending_manager'::text,
    manager_id integer,
    manager_comment text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: conference_bookings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.conference_bookings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: conference_bookings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.conference_bookings_id_seq OWNED BY public.conference_bookings.id;


--
-- Name: conference_counter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conference_counter (
    id integer NOT NULL,
    year integer NOT NULL,
    last_number integer DEFAULT 0
);


--
-- Name: conference_counter_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.conference_counter_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: conference_counter_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.conference_counter_id_seq OWNED BY public.conference_counter.id;


--
-- Name: conference_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conference_history (
    id integer NOT NULL,
    booking_id integer NOT NULL,
    user_id integer NOT NULL,
    user_name text,
    action text NOT NULL,
    comment text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: conference_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.conference_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: conference_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.conference_history_id_seq OWNED BY public.conference_history.id;


--
-- Name: csv_imports_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.csv_imports_log (
    id integer NOT NULL,
    file_name text NOT NULL,
    file_path text NOT NULL,
    imported_by integer NOT NULL,
    imported_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
    row_count integer NOT NULL
);


--
-- Name: csv_imports_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.csv_imports_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: csv_imports_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.csv_imports_log_id_seq OWNED BY public.csv_imports_log.id;


--
-- Name: daily_output; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_output (
    id integer NOT NULL,
    user_id integer NOT NULL,
    report_date text NOT NULL,
    product_name text NOT NULL,
    quantity real DEFAULT 0,
    unit text DEFAULT ''::text,
    quality_score real DEFAULT 0,
    machine_number text,
    description text,
    status text DEFAULT 'pending'::text,
    supervisor_id integer,
    supervisor_comment text,
    supervisor_date text,
    manager_id integer,
    manager_comment text,
    manager_date text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
    department_id integer,
    product_type text
);


--
-- Name: daily_output_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_output_history (
    id integer NOT NULL,
    output_id integer NOT NULL,
    user_id integer NOT NULL,
    user_name text,
    action text NOT NULL,
    comment text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: daily_output_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_output_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: daily_output_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_output_history_id_seq OWNED BY public.daily_output_history.id;


--
-- Name: daily_output_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_output_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: daily_output_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_output_id_seq OWNED BY public.daily_output.id;


--
-- Name: daily_work_report_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_work_report_history (
    id integer NOT NULL,
    report_id integer NOT NULL,
    user_id integer,
    user_name text,
    action text NOT NULL,
    comment text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: daily_work_report_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_work_report_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: daily_work_report_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_work_report_history_id_seq OWNED BY public.daily_work_report_history.id;


--
-- Name: daily_work_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_work_reports (
    id integer NOT NULL,
    user_id integer NOT NULL,
    report_date text NOT NULL,
    work_description text NOT NULL,
    work_duration text,
    department_id integer,
    status text DEFAULT 'pending_central'::text,
    central_comment text,
    central_by integer,
    central_at text,
    manager_comment text,
    manager_by integer,
    manager_at text,
    project_control_comment text,
    project_control_by integer,
    project_control_at text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
    updated_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: daily_work_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_work_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: daily_work_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_work_reports_id_seq OWNED BY public.daily_work_reports.id;


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id integer NOT NULL,
    name text NOT NULL,
    parent_id integer,
    is_active integer DEFAULT 1,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: departments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;


--
-- Name: digital_signatures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.digital_signatures (
    id integer NOT NULL,
    user_id integer NOT NULL,
    signature_data text NOT NULL,
    signature_type text DEFAULT 'drawn'::text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
    scanned_signature text,
    employee_code text
);


--
-- Name: digital_signatures_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.digital_signatures_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: digital_signatures_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.digital_signatures_id_seq OWNED BY public.digital_signatures.id;


--
-- Name: inspection_counter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inspection_counter (
    id integer NOT NULL,
    year integer NOT NULL,
    last_number integer DEFAULT 0
);


--
-- Name: inspection_counter_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inspection_counter_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inspection_counter_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inspection_counter_id_seq OWNED BY public.inspection_counter.id;


--
-- Name: inspection_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inspection_history (
    id integer NOT NULL,
    inspection_id integer NOT NULL,
    user_id integer NOT NULL,
    user_name text,
    action text NOT NULL,
    comment text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: inspection_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inspection_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inspection_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inspection_history_id_seq OWNED BY public.inspection_history.id;


--
-- Name: inspection_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inspection_requests (
    id integer NOT NULL,
    user_id integer NOT NULL,
    request_number text,
    title text NOT NULL,
    description text,
    equipment_name text,
    location text,
    inspection_type text NOT NULL,
    urgency text DEFAULT 'normal'::text,
    deadline text,
    department_id integer,
    assigned_to integer,
    inspection_result text,
    inspection_description text,
    inspect_date text,
    status text DEFAULT 'pending_supervisor'::text,
    supervisor_id integer,
    supervisor_comment text,
    supervisor_date text,
    manager_id integer,
    manager_comment text,
    manager_date text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: inspection_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inspection_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inspection_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inspection_requests_id_seq OWNED BY public.inspection_requests.id;


--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_items (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    unit text DEFAULT 'عدد'::text,
    is_active integer DEFAULT 1,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: inventory_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_items_id_seq OWNED BY public.inventory_items.id;


--
-- Name: it_request_counter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.it_request_counter (
    id integer NOT NULL,
    year integer NOT NULL,
    last_number integer DEFAULT 0
);


--
-- Name: it_request_counter_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.it_request_counter_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: it_request_counter_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.it_request_counter_id_seq OWNED BY public.it_request_counter.id;


--
-- Name: it_request_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.it_request_history (
    id integer NOT NULL,
    it_request_id integer NOT NULL,
    user_id integer NOT NULL,
    user_name text,
    action text NOT NULL,
    comment text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: it_request_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.it_request_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: it_request_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.it_request_history_id_seq OWNED BY public.it_request_history.id;


--
-- Name: it_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.it_requests (
    id integer NOT NULL,
    user_id integer NOT NULL,
    request_number text,
    title text NOT NULL,
    description text,
    request_type text NOT NULL,
    urgency text DEFAULT 'normal'::text,
    device_info text,
    assigned_to integer,
    accept_date text,
    complete_date text,
    complete_comment text,
    status text DEFAULT 'pending'::text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
    department_id integer
);


--
-- Name: it_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.it_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: it_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.it_requests_id_seq OWNED BY public.it_requests.id;


--
-- Name: job_application_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_application_attachments (
    id integer NOT NULL,
    application_id integer NOT NULL,
    file_name text NOT NULL,
    file_path text NOT NULL,
    file_type text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: job_application_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.job_application_attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: job_application_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.job_application_attachments_id_seq OWNED BY public.job_application_attachments.id;


--
-- Name: job_application_counter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_application_counter (
    id integer NOT NULL,
    year integer NOT NULL,
    last_number integer DEFAULT 0
);


--
-- Name: job_application_counter_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.job_application_counter_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: job_application_counter_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.job_application_counter_id_seq OWNED BY public.job_application_counter.id;


--
-- Name: job_application_work_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_application_work_history (
    id integer NOT NULL,
    application_id integer NOT NULL,
    org_name text,
    "position" text,
    duration text,
    last_salary text,
    leave_reason text,
    contact_info text,
    sort_order integer DEFAULT 0
);


--
-- Name: job_application_work_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.job_application_work_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: job_application_work_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.job_application_work_history_id_seq OWNED BY public.job_application_work_history.id;


--
-- Name: job_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_applications (
    id integer NOT NULL,
    user_id integer,
    application_number text,
    full_name text NOT NULL,
    father_name text,
    national_id text,
    national_id_issued_from text,
    birth_date text,
    birth_place text,
    residence_duration text,
    nationality text DEFAULT 'ایرانی'::text,
    religion text,
    language text,
    education_level text,
    education_place text,
    military_status text,
    military_done text DEFAULT 'خیر'::text,
    military_service_type text,
    military_exempt_non_medical text,
    military_exempt_medical text,
    military_exempt_reason text,
    marital_status text,
    children_count integer DEFAULT 0,
    spouse_job text,
    requested_salary text DEFAULT '0'::text,
    housing_status text,
    housing_rent_amount text DEFAULT '0'::text,
    residential_address text,
    phone_number text,
    moral_traits text,
    relatives_in_company text DEFAULT 'خیر'::text,
    relatives_details text,
    criminal_record text DEFAULT 'خیر'::text,
    kave_factories text,
    smoking text DEFAULT 'خیر'::text,
    smoking_duration text,
    foreign_languages text,
    turkish_known text DEFAULT 'خیر'::text,
    computer_skills text,
    training_courses text,
    references_info text,
    photo text,
    status text DEFAULT 'new'::text,
    reviewed_by integer,
    reviewed_at text,
    review_comment text,
    is_active integer DEFAULT 1,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: job_applications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.job_applications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: job_applications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.job_applications_id_seq OWNED BY public.job_applications.id;


--
-- Name: leave_balance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_balance (
    id integer NOT NULL,
    user_id integer NOT NULL,
    total_days double precision DEFAULT 0,
    used_hours real DEFAULT 0
);


--
-- Name: leave_balance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leave_balance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leave_balance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leave_balance_id_seq OWNED BY public.leave_balance.id;


--
-- Name: leave_change_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_change_logs (
    id integer NOT NULL,
    action_by integer NOT NULL,
    action_type text NOT NULL,
    target_id integer NOT NULL,
    old_value text,
    new_value text,
    details text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: leave_change_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leave_change_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leave_change_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leave_change_logs_id_seq OWNED BY public.leave_change_logs.id;


--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_requests (
    id integer NOT NULL,
    user_id integer NOT NULL,
    leave_type text NOT NULL,
    start_date text NOT NULL,
    end_date text NOT NULL,
    hours_count real NOT NULL,
    reason text,
    status text DEFAULT 'pending_supervisor'::text,
    supervisor_id integer,
    supervisor_comment text,
    supervisor_date text,
    manager_id integer,
    manager_comment text,
    manager_date text,
    security_id integer,
    security_date text,
    edited_by integer,
    edited_at text,
    edit_reason text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
    start_hour text,
    end_hour text,
    admin_id integer,
    admin_comment text,
    admin_date text,
    remaining_leave_days real
);


--
-- Name: leave_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leave_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leave_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leave_requests_id_seq OWNED BY public.leave_requests.id;


--
-- Name: letter_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.letter_attachments (
    id integer NOT NULL,
    letter_id integer NOT NULL,
    file_name text NOT NULL,
    file_path text NOT NULL,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: letter_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.letter_attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: letter_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.letter_attachments_id_seq OWNED BY public.letter_attachments.id;


--
-- Name: letter_counter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.letter_counter (
    id integer NOT NULL,
    year integer NOT NULL,
    last_number integer DEFAULT 0
);


--
-- Name: letter_counter_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.letter_counter_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: letter_counter_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.letter_counter_id_seq OWNED BY public.letter_counter.id;


--
-- Name: letter_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.letter_history (
    id integer NOT NULL,
    letter_id integer NOT NULL,
    user_id integer NOT NULL,
    user_name text,
    action text NOT NULL,
    comment text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: letter_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.letter_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: letter_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.letter_history_id_seq OWNED BY public.letter_history.id;


--
-- Name: letter_units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.letter_units (
    id integer NOT NULL,
    letter_id integer NOT NULL,
    unit_id integer NOT NULL,
    status text DEFAULT 'pending'::text,
    seen_date text
);


--
-- Name: letter_units_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.letter_units_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: letter_units_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.letter_units_id_seq OWNED BY public.letter_units.id;


--
-- Name: letters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.letters (
    id integer NOT NULL,
    letter_number text,
    subject text NOT NULL,
    body text,
    sender_id integer NOT NULL,
    sender_unit_id integer NOT NULL,
    priority text DEFAULT 'normal'::text,
    status text DEFAULT 'pending_central'::text,
    manager_id integer,
    manager_comment text,
    manager_date text,
    signature_data text,
    attachment_name text,
    attachment_path text,
    central_comment text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
    central_id integer,
    central_date text,
    selected_manager_id integer
);


--
-- Name: letters_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.letters_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: letters_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.letters_id_seq OWNED BY public.letters.id;


--
-- Name: mission_counter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_counter (
    id integer NOT NULL,
    year integer NOT NULL,
    last_number integer DEFAULT 0
);


--
-- Name: mission_counter_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mission_counter_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mission_counter_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mission_counter_id_seq OWNED BY public.mission_counter.id;


--
-- Name: mission_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_history (
    id integer NOT NULL,
    mission_id integer NOT NULL,
    user_id integer NOT NULL,
    user_name text,
    action text NOT NULL,
    comment text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: mission_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mission_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mission_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mission_history_id_seq OWNED BY public.mission_history.id;


--
-- Name: mission_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_requests (
    id integer NOT NULL,
    user_id integer NOT NULL,
    request_number text,
    mission_date text NOT NULL,
    start_time text,
    end_time text,
    destination text NOT NULL,
    mission_type text DEFAULT 'internal'::text,
    description text,
    reason text,
    department_id integer,
    status text DEFAULT 'pending_supervisor'::text,
    supervisor_id integer,
    supervisor_comment text,
    supervisor_date text,
    manager_id integer,
    manager_comment text,
    manager_date text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: mission_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mission_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mission_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mission_requests_id_seq OWNED BY public.mission_requests.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    title text NOT NULL,
    body text,
    link text,
    is_read integer DEFAULT 0,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: official_holidays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.official_holidays (
    id integer NOT NULL,
    holiday_date text NOT NULL,
    title text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: official_holidays_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.official_holidays_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: official_holidays_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.official_holidays_id_seq OWNED BY public.official_holidays.id;


--
-- Name: overtime_counter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.overtime_counter (
    id integer NOT NULL,
    year integer NOT NULL,
    last_number integer DEFAULT 0
);


--
-- Name: overtime_counter_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.overtime_counter_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: overtime_counter_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.overtime_counter_id_seq OWNED BY public.overtime_counter.id;


--
-- Name: overtime_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.overtime_history (
    id integer NOT NULL,
    request_id integer NOT NULL,
    user_id integer,
    user_name text,
    action text NOT NULL,
    comment text,
    old_status text,
    new_status text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: overtime_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.overtime_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: overtime_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.overtime_history_id_seq OWNED BY public.overtime_history.id;


--
-- Name: overtime_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.overtime_requests (
    id integer NOT NULL,
    user_id integer NOT NULL,
    start_date text NOT NULL,
    end_date text NOT NULL,
    start_hour text,
    end_hour text,
    hours_count real NOT NULL,
    reason text,
    status text DEFAULT 'pending_supervisor'::text,
    supervisor_id integer,
    supervisor_comment text,
    supervisor_date text,
    manager_id integer,
    manager_comment text,
    manager_date text,
    security_id integer,
    security_date text,
    edited_by integer,
    edited_at text,
    edit_reason text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: overtime_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.overtime_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: overtime_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.overtime_requests_id_seq OWNED BY public.overtime_requests.id;


--
-- Name: payment_counter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_counter (
    id integer NOT NULL,
    year integer NOT NULL,
    last_number integer DEFAULT 0
);


--
-- Name: payment_counter_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_counter_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_counter_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_counter_id_seq OWNED BY public.payment_counter.id;


--
-- Name: payment_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_history (
    id integer NOT NULL,
    payment_id integer NOT NULL,
    user_id integer NOT NULL,
    user_name text,
    action text NOT NULL,
    comment text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: payment_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_history_id_seq OWNED BY public.payment_history.id;


--
-- Name: payment_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_requests (
    id integer NOT NULL,
    user_id integer NOT NULL,
    request_number text,
    amount real NOT NULL,
    payment_type text NOT NULL,
    description text,
    reason text,
    recipient_name text,
    bank_name text,
    card_number text,
    department_id integer,
    status text DEFAULT 'pending_supervisor'::text,
    supervisor_id integer,
    supervisor_comment text,
    supervisor_date text,
    manager_id integer,
    manager_comment text,
    manager_date text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: payment_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_requests_id_seq OWNED BY public.payment_requests.id;


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id integer NOT NULL,
    module_key text NOT NULL,
    department_id integer,
    user_id integer,
    is_enabled integer DEFAULT 1,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: permissions_migrated; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions_migrated (
    id integer NOT NULL
);


--
-- Name: permissions_migrated_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permissions_migrated_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permissions_migrated_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permissions_migrated_id_seq OWNED BY public.permissions_migrated.id;


--
-- Name: permissions_new_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permissions_new_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permissions_new_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permissions_new_id_seq OWNED BY public.permissions.id;


--
-- Name: project_supply; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_supply (
    id integer NOT NULL,
    user_id integer NOT NULL,
    request_number text,
    project_name text NOT NULL,
    items text NOT NULL,
    description text,
    urgency text DEFAULT 'normal'::text,
    estimated_cost real,
    deadline text,
    department_id integer,
    status text DEFAULT 'pending_supervisor'::text,
    supervisor_id integer,
    supervisor_comment text,
    supervisor_date text,
    manager_id integer,
    manager_comment text,
    manager_date text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: project_supply_counter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_supply_counter (
    id integer NOT NULL,
    year integer NOT NULL,
    last_number integer DEFAULT 0
);


--
-- Name: project_supply_counter_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_supply_counter_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_supply_counter_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_supply_counter_id_seq OWNED BY public.project_supply_counter.id;


--
-- Name: project_supply_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_supply_history (
    id integer NOT NULL,
    supply_id integer NOT NULL,
    user_id integer NOT NULL,
    user_name text,
    action text NOT NULL,
    comment text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: project_supply_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_supply_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_supply_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_supply_history_id_seq OWNED BY public.project_supply_history.id;


--
-- Name: project_supply_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_supply_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_supply_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_supply_id_seq OWNED BY public.project_supply.id;


--
-- Name: project_supply_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_supply_requests (
    id integer NOT NULL,
    request_number text,
    user_id integer NOT NULL,
    project_name text NOT NULL,
    items text NOT NULL,
    description text,
    estimated_cost text,
    urgency text DEFAULT 'normal'::text,
    deadline text,
    status text DEFAULT 'pending_supervisor'::text,
    supervisor_id integer,
    supervisor_comment text,
    supervisor_date text,
    manager_id integer,
    manager_comment text,
    manager_date text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
    department_id integer
);


--
-- Name: project_supply_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_supply_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_supply_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_supply_requests_id_seq OWNED BY public.project_supply_requests.id;


--
-- Name: purchase_counter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_counter (
    id integer NOT NULL,
    year integer NOT NULL,
    last_number integer DEFAULT 0
);


--
-- Name: purchase_counter_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_counter_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_counter_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_counter_id_seq OWNED BY public.purchase_counter.id;


--
-- Name: purchase_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_history (
    id integer NOT NULL,
    purchase_id integer NOT NULL,
    user_id integer NOT NULL,
    user_name text,
    action text NOT NULL,
    comment text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: purchase_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_history_id_seq OWNED BY public.purchase_history.id;


--
-- Name: purchase_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_requests (
    id integer NOT NULL,
    user_id integer NOT NULL,
    request_number text,
    items text NOT NULL,
    urgency text DEFAULT 'normal'::text,
    reason text,
    department_id integer,
    status text DEFAULT 'pending_supervisor'::text,
    supervisor_id integer,
    supervisor_comment text,
    supervisor_date text,
    manager_id integer,
    manager_comment text,
    manager_date text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: purchase_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_requests_id_seq OWNED BY public.purchase_requests.id;


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth_key text NOT NULL,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: push_subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.push_subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: push_subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.push_subscriptions_id_seq OWNED BY public.push_subscriptions.id;


--
-- Name: repair_counter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repair_counter (
    id integer NOT NULL,
    year integer NOT NULL,
    last_number integer DEFAULT 0
);


--
-- Name: repair_counter_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.repair_counter_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: repair_counter_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.repair_counter_id_seq OWNED BY public.repair_counter.id;


--
-- Name: repair_external_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repair_external_history (
    id integer NOT NULL,
    request_id integer NOT NULL,
    user_id integer,
    user_name text,
    action text NOT NULL,
    comment text,
    old_status text,
    new_status text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: repair_external_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.repair_external_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: repair_external_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.repair_external_history_id_seq OWNED BY public.repair_external_history.id;


--
-- Name: repair_external_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repair_external_items (
    id integer NOT NULL,
    request_id integer NOT NULL,
    item_name text,
    tech_specs text,
    serial_number text,
    quantity integer DEFAULT 1,
    attachments_desc text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: repair_external_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.repair_external_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: repair_external_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.repair_external_items_id_seq OWNED BY public.repair_external_items.id;


--
-- Name: repair_external_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repair_external_requests (
    id integer NOT NULL,
    request_number text,
    user_id integer NOT NULL,
    department_id integer,
    status text DEFAULT 'draft'::text,
    from_unit text,
    to_unit text DEFAULT 'واحد PM'::text,
    manager_name text,
    request_date text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
    urgency text DEFAULT 'normal'::text,
    deadline text,
    work_type text,
    tech_description text,
    estimated_cost text,
    fault_description text,
    fault_reason text,
    warehouse_stock integer,
    warehouse_stock_status text,
    delivery_date text,
    send_date text,
    send_serial text,
    destination text,
    contractor_name text,
    contractor_address text,
    repair_description text,
    repair_cost text,
    supporter_name text,
    return_date text,
    return_serial text,
    quality_status text,
    quality_notes text,
    images text,
    pm_approved integer DEFAULT 0,
    pm_approved_at text,
    dept_manager_approved integer DEFAULT 0,
    dept_manager_approved_at text,
    tech_manager_approved integer DEFAULT 0,
    tech_manager_approved_at text,
    warehouse_approved integer DEFAULT 0,
    warehouse_approved_at text,
    factory_manager_approved integer DEFAULT 0,
    factory_manager_approved_at text,
    support_completed integer DEFAULT 0,
    support_completed_at text,
    quality_approved integer DEFAULT 0,
    quality_approved_at text,
    final_warehouse_approved integer DEFAULT 0,
    final_warehouse_approved_at text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
    updated_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
    doc_code text DEFAULT 'PM_01'::text,
    edit_date text DEFAULT '۱۴۰۴/۰۹/۲۶'::text,
    revision_number text,
    form_date text DEFAULT '۱۴۰۵/۰۵/۰۴'::text,
    repair_speed text DEFAULT 'urgent'::text,
    sketch_file text,
    photo_file text,
    equipment_name text,
    pm_electrical_approved integer DEFAULT 0,
    pm_electrical_approved_at text,
    dept_manager_signature_approved integer DEFAULT 0,
    dept_manager_signature_approved_at text,
    manager_approved integer DEFAULT 0,
    manager_approved_at text,
    pm_id integer,
    dept_manager_id integer,
    tech_manager_id integer,
    warehouse_id integer,
    factory_manager_id integer
);


--
-- Name: repair_external_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.repair_external_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: repair_external_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.repair_external_requests_id_seq OWNED BY public.repair_external_requests.id;


--
-- Name: repair_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repair_history (
    id integer NOT NULL,
    repair_id integer NOT NULL,
    user_id integer NOT NULL,
    user_name text,
    action text NOT NULL,
    comment text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: repair_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.repair_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: repair_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.repair_history_id_seq OWNED BY public.repair_history.id;


--
-- Name: repair_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repair_requests (
    id integer NOT NULL,
    user_id integer NOT NULL,
    request_number text,
    title text NOT NULL,
    description text,
    equipment_name text,
    location text,
    urgency text DEFAULT 'normal'::text,
    estimated_cost real,
    department_id integer,
    status text DEFAULT 'pending_supervisor'::text,
    supervisor_id integer,
    supervisor_comment text,
    supervisor_date text,
    manager_id integer,
    manager_comment text,
    manager_date text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
    images text
);


--
-- Name: repair_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.repair_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: repair_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.repair_requests_id_seq OWNED BY public.repair_requests.id;


--
-- Name: restaurant_menu; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_menu (
    id integer NOT NULL,
    food_date text NOT NULL,
    option_number integer DEFAULT 1 NOT NULL,
    food_name text NOT NULL,
    description text,
    price real DEFAULT 0,
    is_active integer DEFAULT 1,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: restaurant_menu_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.restaurant_menu_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: restaurant_menu_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.restaurant_menu_id_seq OWNED BY public.restaurant_menu.id;


--
-- Name: restaurant_reservations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_reservations (
    id integer NOT NULL,
    user_id integer NOT NULL,
    food_id integer NOT NULL,
    food_date text NOT NULL,
    quantity integer DEFAULT 1,
    status text DEFAULT 'active'::text,
    notes text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: restaurant_reservations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.restaurant_reservations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: restaurant_reservations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.restaurant_reservations_id_seq OWNED BY public.restaurant_reservations.id;


--
-- Name: security_counter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_counter (
    id integer NOT NULL,
    year integer NOT NULL,
    last_number integer DEFAULT 0
);


--
-- Name: security_counter_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.security_counter_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: security_counter_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.security_counter_id_seq OWNED BY public.security_counter.id;


--
-- Name: security_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_history (
    id integer NOT NULL,
    security_report_id integer NOT NULL,
    user_id integer NOT NULL,
    user_name text,
    action text NOT NULL,
    comment text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: security_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.security_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: security_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.security_history_id_seq OWNED BY public.security_history.id;


--
-- Name: security_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_reports (
    id integer NOT NULL,
    user_id integer NOT NULL,
    report_date text NOT NULL,
    shift_type text NOT NULL,
    incidents text,
    visitors text,
    vehicles text,
    notes text,
    status text DEFAULT 'pending'::text,
    supervisor_id integer,
    supervisor_comment text,
    supervisor_date text,
    manager_id integer,
    manager_comment text,
    manager_date text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
    report_number text,
    department_id integer
);


--
-- Name: security_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.security_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: security_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.security_reports_id_seq OWNED BY public.security_reports.id;


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    id integer NOT NULL,
    key text NOT NULL,
    value text,
    updated_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.settings_id_seq OWNED BY public.settings.id;


--
-- Name: shift_change_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_change_requests (
    id integer NOT NULL,
    user_id integer NOT NULL,
    current_shift_id integer,
    requested_shift_id integer NOT NULL,
    requested_date text,
    reason text,
    status text DEFAULT 'pending'::text,
    reviewed_by integer,
    reviewed_at text,
    review_comment text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: shift_change_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shift_change_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shift_change_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shift_change_requests_id_seq OWNED BY public.shift_change_requests.id;


--
-- Name: signature_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.signature_logs (
    id integer NOT NULL,
    user_id integer NOT NULL,
    signature_id integer,
    module_name text,
    record_id integer,
    action text NOT NULL,
    ip_address text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: signature_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.signature_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: signature_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.signature_logs_id_seq OWNED BY public.signature_logs.id;


--
-- Name: signatures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.signatures (
    id integer NOT NULL,
    user_id integer NOT NULL,
    image_data text NOT NULL,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: signatures_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.signatures_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: signatures_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.signatures_id_seq OWNED BY public.signatures.id;


--
-- Name: sms_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_codes (
    id integer NOT NULL,
    phone text NOT NULL,
    code text NOT NULL,
    expires_at text NOT NULL,
    used integer DEFAULT 0,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: sms_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sms_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sms_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sms_codes_id_seq OWNED BY public.sms_codes.id;


--
-- Name: sqlite_master; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.sqlite_master AS
 SELECT 'table'::text AS type,
    (table_name)::text AS name
   FROM information_schema.tables
  WHERE ((table_schema)::name = 'public'::name);


--
-- Name: ticket_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_responses (
    id integer NOT NULL,
    ticket_id integer NOT NULL,
    user_id integer NOT NULL,
    message text NOT NULL,
    is_internal integer DEFAULT 0,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: ticket_responses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_responses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_responses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_responses_id_seq OWNED BY public.ticket_responses.id;


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tickets (
    id integer NOT NULL,
    user_id integer NOT NULL,
    title text NOT NULL,
    description text,
    category text DEFAULT 'general'::text,
    priority text DEFAULT 'normal'::text,
    status text DEFAULT 'open'::text,
    assigned_to integer,
    department_id integer,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
    updated_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
    closed_at text
);


--
-- Name: tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tickets_id_seq OWNED BY public.tickets.id;


--
-- Name: user_shift_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_shift_assignments (
    id integer NOT NULL,
    user_id integer NOT NULL,
    shift_id integer NOT NULL,
    is_active integer DEFAULT 1,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: user_shift_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_shift_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_shift_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_shift_assignments_id_seq OWNED BY public.user_shift_assignments.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    password text NOT NULL,
    full_name text NOT NULL,
    role text DEFAULT 'user'::text NOT NULL,
    department_id integer,
    work_type text DEFAULT 'normal'::text,
    is_active integer DEFAULT 1,
    must_change_password integer DEFAULT 0,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
    username text,
    phone text,
    email text,
    last_login text
);


--
-- Name: work_order_counter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_order_counter (
    id integer NOT NULL,
    year integer NOT NULL,
    last_number integer DEFAULT 0
);


--
-- Name: work_order_counter_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.work_order_counter_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: work_order_counter_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.work_order_counter_id_seq OWNED BY public.work_order_counter.id;


--
-- Name: work_order_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_order_history (
    id integer NOT NULL,
    work_order_id integer NOT NULL,
    user_id integer NOT NULL,
    user_name text,
    action text NOT NULL,
    comment text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: work_order_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.work_order_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: work_order_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.work_order_history_id_seq OWNED BY public.work_order_history.id;


--
-- Name: work_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_orders (
    id integer NOT NULL,
    user_id integer NOT NULL,
    request_number text,
    title text NOT NULL,
    description text,
    work_type text,
    priority text DEFAULT 'normal'::text,
    estimated_cost real,
    deadline text,
    department_id integer,
    status text DEFAULT 'pending_supervisor'::text,
    supervisor_id integer,
    supervisor_comment text,
    supervisor_date text,
    manager_id integer,
    manager_comment text,
    manager_date text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: work_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.work_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: work_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.work_orders_id_seq OWNED BY public.work_orders.id;


--
-- Name: work_shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_shifts (
    id integer NOT NULL,
    name text NOT NULL,
    start_time text DEFAULT ''::text,
    end_time text DEFAULT ''::text,
    description text,
    color text DEFAULT '#3b82f6'::text,
    is_active integer DEFAULT 1,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: work_shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.work_shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: work_shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.work_shifts_id_seq OWNED BY public.work_shifts.id;


--
-- Name: workflow_instances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_instances (
    id integer NOT NULL,
    template_id integer NOT NULL,
    record_id integer NOT NULL,
    current_step integer DEFAULT 0,
    status text DEFAULT 'active'::text,
    started_by integer,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
    completed_at text
);


--
-- Name: workflow_instances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.workflow_instances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: workflow_instances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.workflow_instances_id_seq OWNED BY public.workflow_instances.id;


--
-- Name: workflow_steps_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_steps_log (
    id integer NOT NULL,
    instance_id integer NOT NULL,
    step_index integer NOT NULL,
    actor_id integer,
    action text NOT NULL,
    comment text,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: workflow_steps_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.workflow_steps_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: workflow_steps_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.workflow_steps_log_id_seq OWNED BY public.workflow_steps_log.id;


--
-- Name: workflow_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_templates (
    id integer NOT NULL,
    name text NOT NULL,
    module_name text NOT NULL,
    steps jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active integer DEFAULT 1,
    created_by integer,
    created_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
    updated_at text DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
);


--
-- Name: workflow_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.workflow_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: workflow_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.workflow_templates_id_seq OWNED BY public.workflow_templates.id;


--
-- Name: activity_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log ALTER COLUMN id SET DEFAULT nextval('public.activity_log_id_seq'::regclass);


--
-- Name: announcements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements ALTER COLUMN id SET DEFAULT nextval('public.announcements_id_seq'::regclass);


--
-- Name: attachments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments ALTER COLUMN id SET DEFAULT nextval('public.attachments_id_seq'::regclass);


--
-- Name: backup_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_logs ALTER COLUMN id SET DEFAULT nextval('public.backup_logs_id_seq'::regclass);


--
-- Name: cardex id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cardex ALTER COLUMN id SET DEFAULT nextval('public.cardex_id_seq'::regclass);


--
-- Name: chat_members id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_members ALTER COLUMN id SET DEFAULT nextval('public.chat_members_id_seq'::regclass);


--
-- Name: chat_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages ALTER COLUMN id SET DEFAULT nextval('public.chat_messages_id_seq'::regclass);


--
-- Name: chat_rooms id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_rooms ALTER COLUMN id SET DEFAULT nextval('public.chat_rooms_id_seq'::regclass);


--
-- Name: conference_bookings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conference_bookings ALTER COLUMN id SET DEFAULT nextval('public.conference_bookings_id_seq'::regclass);


--
-- Name: conference_counter id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conference_counter ALTER COLUMN id SET DEFAULT nextval('public.conference_counter_id_seq'::regclass);


--
-- Name: conference_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conference_history ALTER COLUMN id SET DEFAULT nextval('public.conference_history_id_seq'::regclass);


--
-- Name: csv_imports_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.csv_imports_log ALTER COLUMN id SET DEFAULT nextval('public.csv_imports_log_id_seq'::regclass);


--
-- Name: daily_output id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_output ALTER COLUMN id SET DEFAULT nextval('public.daily_output_id_seq'::regclass);


--
-- Name: daily_output_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_output_history ALTER COLUMN id SET DEFAULT nextval('public.daily_output_history_id_seq'::regclass);


--
-- Name: daily_work_report_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_work_report_history ALTER COLUMN id SET DEFAULT nextval('public.daily_work_report_history_id_seq'::regclass);


--
-- Name: daily_work_reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_work_reports ALTER COLUMN id SET DEFAULT nextval('public.daily_work_reports_id_seq'::regclass);


--
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);


--
-- Name: digital_signatures id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.digital_signatures ALTER COLUMN id SET DEFAULT nextval('public.digital_signatures_id_seq'::regclass);


--
-- Name: inspection_counter id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_counter ALTER COLUMN id SET DEFAULT nextval('public.inspection_counter_id_seq'::regclass);


--
-- Name: inspection_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_history ALTER COLUMN id SET DEFAULT nextval('public.inspection_history_id_seq'::regclass);


--
-- Name: inspection_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_requests ALTER COLUMN id SET DEFAULT nextval('public.inspection_requests_id_seq'::regclass);


--
-- Name: inventory_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items ALTER COLUMN id SET DEFAULT nextval('public.inventory_items_id_seq'::regclass);


--
-- Name: it_request_counter id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.it_request_counter ALTER COLUMN id SET DEFAULT nextval('public.it_request_counter_id_seq'::regclass);


--
-- Name: it_request_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.it_request_history ALTER COLUMN id SET DEFAULT nextval('public.it_request_history_id_seq'::regclass);


--
-- Name: it_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.it_requests ALTER COLUMN id SET DEFAULT nextval('public.it_requests_id_seq'::regclass);


--
-- Name: job_application_attachments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_application_attachments ALTER COLUMN id SET DEFAULT nextval('public.job_application_attachments_id_seq'::regclass);


--
-- Name: job_application_counter id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_application_counter ALTER COLUMN id SET DEFAULT nextval('public.job_application_counter_id_seq'::regclass);


--
-- Name: job_application_work_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_application_work_history ALTER COLUMN id SET DEFAULT nextval('public.job_application_work_history_id_seq'::regclass);


--
-- Name: job_applications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_applications ALTER COLUMN id SET DEFAULT nextval('public.job_applications_id_seq'::regclass);


--
-- Name: leave_balance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_balance ALTER COLUMN id SET DEFAULT nextval('public.leave_balance_id_seq'::regclass);


--
-- Name: leave_change_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_change_logs ALTER COLUMN id SET DEFAULT nextval('public.leave_change_logs_id_seq'::regclass);


--
-- Name: leave_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests ALTER COLUMN id SET DEFAULT nextval('public.leave_requests_id_seq'::regclass);


--
-- Name: letter_attachments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letter_attachments ALTER COLUMN id SET DEFAULT nextval('public.letter_attachments_id_seq'::regclass);


--
-- Name: letter_counter id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letter_counter ALTER COLUMN id SET DEFAULT nextval('public.letter_counter_id_seq'::regclass);


--
-- Name: letter_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letter_history ALTER COLUMN id SET DEFAULT nextval('public.letter_history_id_seq'::regclass);


--
-- Name: letter_units id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letter_units ALTER COLUMN id SET DEFAULT nextval('public.letter_units_id_seq'::regclass);


--
-- Name: letters id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letters ALTER COLUMN id SET DEFAULT nextval('public.letters_id_seq'::regclass);


--
-- Name: mission_counter id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_counter ALTER COLUMN id SET DEFAULT nextval('public.mission_counter_id_seq'::regclass);


--
-- Name: mission_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_history ALTER COLUMN id SET DEFAULT nextval('public.mission_history_id_seq'::regclass);


--
-- Name: mission_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_requests ALTER COLUMN id SET DEFAULT nextval('public.mission_requests_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: official_holidays id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.official_holidays ALTER COLUMN id SET DEFAULT nextval('public.official_holidays_id_seq'::regclass);


--
-- Name: overtime_counter id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_counter ALTER COLUMN id SET DEFAULT nextval('public.overtime_counter_id_seq'::regclass);


--
-- Name: overtime_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_history ALTER COLUMN id SET DEFAULT nextval('public.overtime_history_id_seq'::regclass);


--
-- Name: overtime_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_requests ALTER COLUMN id SET DEFAULT nextval('public.overtime_requests_id_seq'::regclass);


--
-- Name: payment_counter id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_counter ALTER COLUMN id SET DEFAULT nextval('public.payment_counter_id_seq'::regclass);


--
-- Name: payment_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_history ALTER COLUMN id SET DEFAULT nextval('public.payment_history_id_seq'::regclass);


--
-- Name: payment_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_requests ALTER COLUMN id SET DEFAULT nextval('public.payment_requests_id_seq'::regclass);


--
-- Name: permissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_new_id_seq'::regclass);


--
-- Name: permissions_migrated id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions_migrated ALTER COLUMN id SET DEFAULT nextval('public.permissions_migrated_id_seq'::regclass);


--
-- Name: project_supply id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_supply ALTER COLUMN id SET DEFAULT nextval('public.project_supply_id_seq'::regclass);


--
-- Name: project_supply_counter id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_supply_counter ALTER COLUMN id SET DEFAULT nextval('public.project_supply_counter_id_seq'::regclass);


--
-- Name: project_supply_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_supply_history ALTER COLUMN id SET DEFAULT nextval('public.project_supply_history_id_seq'::regclass);


--
-- Name: project_supply_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_supply_requests ALTER COLUMN id SET DEFAULT nextval('public.project_supply_requests_id_seq'::regclass);


--
-- Name: purchase_counter id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_counter ALTER COLUMN id SET DEFAULT nextval('public.purchase_counter_id_seq'::regclass);


--
-- Name: purchase_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_history ALTER COLUMN id SET DEFAULT nextval('public.purchase_history_id_seq'::regclass);


--
-- Name: purchase_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_requests ALTER COLUMN id SET DEFAULT nextval('public.purchase_requests_id_seq'::regclass);


--
-- Name: push_subscriptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions ALTER COLUMN id SET DEFAULT nextval('public.push_subscriptions_id_seq'::regclass);


--
-- Name: repair_counter id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_counter ALTER COLUMN id SET DEFAULT nextval('public.repair_counter_id_seq'::regclass);


--
-- Name: repair_external_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_external_history ALTER COLUMN id SET DEFAULT nextval('public.repair_external_history_id_seq'::regclass);


--
-- Name: repair_external_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_external_items ALTER COLUMN id SET DEFAULT nextval('public.repair_external_items_id_seq'::regclass);


--
-- Name: repair_external_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_external_requests ALTER COLUMN id SET DEFAULT nextval('public.repair_external_requests_id_seq'::regclass);


--
-- Name: repair_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_history ALTER COLUMN id SET DEFAULT nextval('public.repair_history_id_seq'::regclass);


--
-- Name: repair_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_requests ALTER COLUMN id SET DEFAULT nextval('public.repair_requests_id_seq'::regclass);


--
-- Name: restaurant_menu id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_menu ALTER COLUMN id SET DEFAULT nextval('public.restaurant_menu_id_seq'::regclass);


--
-- Name: restaurant_reservations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_reservations ALTER COLUMN id SET DEFAULT nextval('public.restaurant_reservations_id_seq'::regclass);


--
-- Name: security_counter id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_counter ALTER COLUMN id SET DEFAULT nextval('public.security_counter_id_seq'::regclass);


--
-- Name: security_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_history ALTER COLUMN id SET DEFAULT nextval('public.security_history_id_seq'::regclass);


--
-- Name: security_reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_reports ALTER COLUMN id SET DEFAULT nextval('public.security_reports_id_seq'::regclass);


--
-- Name: settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings ALTER COLUMN id SET DEFAULT nextval('public.settings_id_seq'::regclass);


--
-- Name: shift_change_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_change_requests ALTER COLUMN id SET DEFAULT nextval('public.shift_change_requests_id_seq'::regclass);


--
-- Name: signature_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_logs ALTER COLUMN id SET DEFAULT nextval('public.signature_logs_id_seq'::regclass);


--
-- Name: signatures id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signatures ALTER COLUMN id SET DEFAULT nextval('public.signatures_id_seq'::regclass);


--
-- Name: sms_codes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_codes ALTER COLUMN id SET DEFAULT nextval('public.sms_codes_id_seq'::regclass);


--
-- Name: ticket_responses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_responses ALTER COLUMN id SET DEFAULT nextval('public.ticket_responses_id_seq'::regclass);


--
-- Name: tickets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets ALTER COLUMN id SET DEFAULT nextval('public.tickets_id_seq'::regclass);


--
-- Name: user_shift_assignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_shift_assignments ALTER COLUMN id SET DEFAULT nextval('public.user_shift_assignments_id_seq'::regclass);


--
-- Name: work_order_counter id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_counter ALTER COLUMN id SET DEFAULT nextval('public.work_order_counter_id_seq'::regclass);


--
-- Name: work_order_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_history ALTER COLUMN id SET DEFAULT nextval('public.work_order_history_id_seq'::regclass);


--
-- Name: work_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders ALTER COLUMN id SET DEFAULT nextval('public.work_orders_id_seq'::regclass);


--
-- Name: work_shifts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_shifts ALTER COLUMN id SET DEFAULT nextval('public.work_shifts_id_seq'::regclass);


--
-- Name: workflow_instances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_instances ALTER COLUMN id SET DEFAULT nextval('public.workflow_instances_id_seq'::regclass);


--
-- Name: workflow_steps_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_steps_log ALTER COLUMN id SET DEFAULT nextval('public.workflow_steps_log_id_seq'::regclass);


--
-- Name: workflow_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_templates ALTER COLUMN id SET DEFAULT nextval('public.workflow_templates_id_seq'::regclass);


--
-- Data for Name: activity_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.activity_log (id, user_id, action, details, ip_address, created_at, module_name) FROM stdin;
1	1000	POST /single	{"url":"/uploads/attachments/1784957596514-253301.txt","filename":"1784957596514-253301.txt","originalName":"test-upload.txt","size":33}	127.0.0.1	2026-07-25 09:03:16	
2	\N	POST /send-code	{"success":true,"message":"کد تأیید ارسال شد","_dev_code":"882334"}	127.0.0.1	2026-07-25 09:05:25	
3	\N	POST /verify-code	{"error":"PostgreSQL Error: column \\"employee_id\\" does not exist\\nQuery: SELECT MAX(CAST(employee_id AS INTEGER)) as m FROM users"}	127.0.0.1	2026-07-25 09:05:33	
4	\N	POST /send-code	{"success":true,"message":"کد تأیید ارسال شد","_dev_code":"426671"}	127.0.0.1	2026-07-25 09:07:10	
5	\N	POST /verify-code	{"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NjA0NzAwMiwidXNlcm5hbWUiOiI2MDQ3MDAyIiwicm9sZSI6InVzZXIiLCJpYXQiOjE3ODQ5NTc4MzAsImV4cCI6MTc4NTA0NDIzMH0.2gF0r-BihOzPfj563g-pk280D4FnKRDcwacBlfaVoOg","user":{"id":6047002,"employee_id":6047002,"username":"6047002","full_name":"کاربر جدید","role":"user","department_id":1}}	127.0.0.1	2026-07-25 09:07:10	
6	1000	POST /1/accept	{"error":"PostgreSQL Error: column \\"request_id\\" of relation \\"it_request_history\\" does not exist\\nQuery: INSERT INTO it_request_history (request_id, user_id, user_name, action, comment) VALUES ($1, $2, $3, $4, $5) RETURNING *"}	127.0.0.1	2026-07-25 10:44:24	
7	1000	POST /1/accept	{"error":"PostgreSQL Error: column \\"request_id\\" of relation \\"it_request_history\\" does not exist\\nQuery: INSERT INTO it_request_history (request_id, user_id, user_name, action, comment) VALUES ($1, $2, $3, $4, $5) RETURNING *"}	127.0.0.1	2026-07-25 10:44:26	
8	1000	DELETE /1	{"error":"امکان حذف تیکت در این مرحله وجود ندارد"}	127.0.0.1	2026-07-25 10:44:29	
9	1000	POST /1/accept	{"error":"PostgreSQL Error: column \\"request_id\\" of relation \\"it_request_history\\" does not exist\\nQuery: INSERT INTO it_request_history (request_id, user_id, user_name, action, comment) VALUES ($1, $2, $3, $4, $5) RETURNING *"}	127.0.0.1	2026-07-25 10:44:37	
10	1000	PUT /users/6040062	{"message":"کاربر با موفقیت ویرایش شد"}	172.30.39.128	2026-07-25 12:29:32	
11	1000	POST /	{"id":3,"message":"درخواست مرخصی ثبت شد"}	172.30.39.128	2026-07-25 12:36:10	
12	1000	POST /	{"id":4,"message":"درخواست مرخصی ثبت شد"}	127.0.0.1	2026-07-26 09:51:10	
13	1000	POST /	{"id":5,"message":"درخواست مرخصی ثبت شد"}	127.0.0.1	2026-07-26 09:53:00	
14	1000	PUT /5/seen-security	{"message":"مرخصی رویت شد"}	127.0.0.1	2026-07-26 09:53:13	
15	1000	PUT /4/seen-security	{"message":"مرخصی رویت شد"}	127.0.0.1	2026-07-26 09:53:14	
16	1000	PUT /3/seen-security	{"message":"مرخصی رویت شد"}	127.0.0.1	2026-07-26 09:53:15	
17	1000	PUT /users/6038141	{"message":"کاربر با موفقیت ویرایش شد"}	127.0.0.1	2026-07-26 09:55:38	
18	1000	PUT /	{"message":"دسترسی‌ها ذخیره شد"}	127.0.0.1	2026-07-26 09:57:22	
19	1000	PUT /	{"message":"دسترسی‌ها ذخیره شد"}	127.0.0.1	2026-07-26 09:57:57	
20	1000	PUT /	{"message":"دسترسی‌ها ذخیره شد"}	127.0.0.1	2026-07-26 09:59:30	
21	1000	PUT /users/6040062	{"message":"کاربر با موفقیت ویرایش شد"}	127.0.0.1	2026-07-26 10:00:30	
22	6040062	PUT /read-all	{"message":"همه خوانده شد"}	127.0.0.1	2026-07-26 10:00:50	
23	6034789	POST /	{"id":6,"message":"درخواست مرخصی ثبت شد"}	172.20.2.200	2026-07-26 10:00:55	
24	6040062	PUT /6/approve-supervisor	{"message":"درخواست توسط سرپرست تایید شد"}	127.0.0.1	2026-07-26 10:00:59	
25	6034789	POST /	{"id":7,"message":"درخواست مرخصی ثبت شد"}	172.20.2.200	2026-07-26 10:01:18	
26	6040062	PUT /7/approve-supervisor	{"message":"درخواست توسط سرپرست تایید شد"}	127.0.0.1	2026-07-26 10:01:21	
27	1000	PUT /	{"message":"دسترسی‌ها ذخیره شد"}	127.0.0.1	2026-07-26 10:04:08	
28	1000	PUT /	{"message":"دسترسی‌ها ذخیره شد"}	127.0.0.1	2026-07-26 10:05:25	
29	1000	POST /users	{"id":6002734,"message":"کاربر با موفقیت ایجاد شد"}	127.0.0.1	2026-07-26 10:06:00	
30	6002734	POST /change-password	{"message":"رمز عبور با موفقیت تغییر کرد"}	127.0.0.1	2026-07-26 10:08:17	
31	1000	PUT /user-permissions	{"message":"دسترسی‌های کاربر ذخیره شد"}	127.0.0.1	2026-07-26 10:10:42	
32	1000	PUT /user-permissions	{"message":"دسترسی‌های کاربر ذخیره شد"}	127.0.0.1	2026-07-26 10:10:44	
33	6002734	PUT /6/approve-manager	{"message":"مرخصی توسط مدیر تایید شد"}	127.0.0.1	2026-07-26 10:11:38	
34	6034682	PUT /7/approve-admin	{"message":"مرخصی توسط اداری تایید شد"}	172.20.2.200	2026-07-26 10:14:10	
35	6002734	PUT /7/approve-manager	{"message":"مرخصی توسط مدیر تایید شد"}	127.0.0.1	2026-07-26 10:14:33	
36	1000	POST /	{"id":8,"message":"درخواست مرخصی ثبت شد"}	127.0.0.1	2026-07-26 12:11:46	
37	1000	POST /	{"id":9,"message":"درخواست مرخصی ثبت شد"}	127.0.0.1	2026-07-26 12:12:00	
38	6038141	POST /upload-scan	{"url":"/uploads/signatures/sig-1785056172202.png","success":true}	127.0.0.1	2026-07-26 12:26:12	
39	6038141	DELETE /1	{"success":true}	127.0.0.1	2026-07-26 12:26:17	
40	6038141	POST /rooms	{"id":1,"success":true}	127.0.0.1	2026-07-26 13:08:18	
41	6038141	POST /rooms/1/messages	{"id":1,"success":true}	127.0.0.1	2026-07-26 13:08:22	
42	6038141	POST /rooms/1/messages	{"id":2,"success":true}	127.0.0.1	2026-07-26 13:08:28	
43	6038141	POST /rooms/1/messages	{"id":3,"success":true}	127.0.0.1	2026-07-26 13:08:33	
44	1000	POST /save	{"id":2,"success":true}	127.0.0.1	2026-07-26 13:18:15	
45	1000	DELETE /2	{"success":true}	127.0.0.1	2026-07-26 13:18:18	
46	1000	POST /upload-scan	{"url":"/uploads/signatures/sig-1785059330805.png","success":true}	127.0.0.1	2026-07-26 13:18:50	
47	1000	POST /	{"id":10,"message":"درخواست مرخصی ثبت شد"}	127.0.0.1	2026-07-26 13:19:14	
48	1000	DELETE /3	{"success":true}	127.0.0.1	2026-07-26 14:10:29	
49	1000	POST /upload-scan	{"url":"/uploads/signatures/sig-1785062964159.png","success":true}	127.0.0.1	2026-07-26 14:19:24	
50	1000	DELETE /4	{"success":true}	127.0.0.1	2026-07-26 14:19:28	
51	1000	POST /upload-scan	{"url":"/uploads/signatures/sig-1785062989050.png","success":true}	127.0.0.1	2026-07-26 14:19:49	
52	1000	PUT /read-all	{"message":"همه خوانده شد"}	127.0.0.1	2026-07-26 15:43:06	
53	6034789	POST /upload-scan	{"url":"/uploads/signatures/sig-1785129036744.png","success":true}	172.20.2.200	2026-07-27 08:40:36	
54	6034789	POST /	{"id":11,"message":"درخواست مرخصی ثبت شد"}	172.20.2.200	2026-07-27 08:41:03	
55	6040062	PUT /11/approve-supervisor	{"message":"درخواست توسط سرپرست تایید شد"}	127.0.0.1	2026-07-27 08:42:57	
56	1000	PUT /users/6002734	{"message":"کاربر با موفقیت ویرایش شد"}	172.20.2.200	2026-07-27 08:44:17	
57	6002734	PUT /11/approve-manager	{"message":"مرخصی توسط مدیر تایید شد"}	172.20.2.200	2026-07-27 08:44:36	
58	1000	PUT /users/6034682	{"message":"کاربر با موفقیت ویرایش شد"}	172.20.2.200	2026-07-27 08:46:47	
59	1000	POST /save	{"id":7,"success":true}	172.20.2.200	2026-07-27 08:46:47	
60	1000	PUT /users/6002734	{"message":"کاربر با موفقیت ویرایش شد"}	172.20.2.200	2026-07-27 08:47:08	
61	1000	POST /save	{"id":8,"success":true}	172.20.2.200	2026-07-27 08:47:08	
62	6040062	POST /upload-scan	{"url":"/uploads/signatures/sig-1785129742988.png","success":true}	127.0.0.1	2026-07-27 08:52:22	
63	6038141	PUT /7/seen-security	{"message":"مرخصی رویت شد"}	127.0.0.1	2026-07-27 09:37:45	
64	6040062	PUT /read-all	{"message":"همه خوانده شد"}	127.0.0.1	2026-07-27 11:20:26	
65	6040062	PUT /read-all	{"message":"همه خوانده شد"}	127.0.0.1	2026-07-27 11:20:35	
66	1000	POST /api/admin/server-restart	{"message":"سرور در حال ری‌استارت..."}	127.0.0.1	2026-07-27 12:04:45	admin
67	1000	PUT /	{"message":"دسترسی‌ها ذخیره شد"}	127.0.0.1	2026-07-27 12:05:20	
68	1000	PUT /	{"message":"دسترسی‌ها ذخیره شد"}	127.0.0.1	2026-07-27 12:05:35	
69	1000	PUT /	{"message":"دسترسی‌ها ذخیره شد"}	127.0.0.1	2026-07-27 13:14:15	
70	1000	PUT /user-permissions	{"message":"دسترسی‌های کاربر ذخیره شد"}	127.0.0.1	2026-07-27 13:14:15	
71	1000	PUT /	{"message":"دسترسی‌ها ذخیره شد"}	127.0.0.1	2026-07-27 13:22:43	
72	1000	POST /run/daily	{"error":"Command failed: pg_dump -h \\"localhost\\" -p \\"5432\\" -U \\"postgres\\" -d \\"edari?schema=public\\" -f \\"C:\\\\Users\\\\najjari\\\\Documents\\\\edari-backups\\\\daily\\\\2026-07-27_1538\\\\edari_2026-07-27_1538.sql\\" --no-owner --no-privileges\\npg_dump: error: invalid connection option \\"edari?schema\\"\\r\\n"}	127.0.0.1	2026-07-27 15:38:15	
73	1000	POST /run/daily	{"error":"archiver is not a function"}	127.0.0.1	2026-07-27 15:38:39	
74	1000	POST /run/daily	{"success":true,"result":{"type":"daily","date":"2026-07-27_1539","backupDir":"C:\\\\Users\\\\najjari\\\\Documents\\\\edari-backups\\\\daily\\\\2026-07-27_1539","dbFile":"edari_2026-07-27_1539.sql.gz","dbSize":55078,"uploadsFile":"uploads_2026-07-27_1539.zip","uploadsSize":333743,"uploadsFiles":6}}	127.0.0.1	2026-07-27 15:39:29	
75	1000	PUT /settings	{"success":true,"message":"تنظیمات بکاپ ذخیره شد"}	127.0.0.1	2026-07-27 15:41:41	
76	1000	POST /run/daily	{"success":true,"result":{"type":"daily","date":"2026-07-27_1542","backupDir":"C:\\\\Users\\\\najjari\\\\Documents\\\\edari-backups\\\\daily\\\\2026-07-27_1542","dbFile":"edari_2026-07-27_1542.sql.gz","dbSize":55264,"uploadsFile":"uploads_2026-07-27_1542.zip","uploadsSize":22,"uploadsFiles":0}}	127.0.0.1	2026-07-27 15:42:50	
77	1000	POST /run/weekly	{"success":true,"result":{"type":"weekly","date":"2026-07-27_1542","backupDir":"C:\\\\Users\\\\najjari\\\\Documents\\\\edari-backups\\\\weekly\\\\2026-07-27_1542","dbFile":"edari_2026-07-27_1542.sql.gz","dbSize":55307,"uploadsFile":"uploads_2026-07-27_1542.zip","uploadsSize":333743,"uploadsFiles":6}}	127.0.0.1	2026-07-27 15:42:58	
78	1000	PUT /settings	{"success":true,"message":"تنظیمات بکاپ ذخیره شد"}	127.0.0.1	2026-07-27 15:45:24	
79	6040062	POST /rooms	{"id":2,"success":true}	127.0.0.1	2026-07-27 16:38:39	
80	6040062	POST /rooms/2/messages	{"id":4,"success":true}	127.0.0.1	2026-07-27 16:38:48	
81	1000	POST /run/daily	{"success":true,"result":{"type":"daily","date":"2026-07-28_0815","backupDir":"C:\\\\Users\\\\najjari\\\\Documents\\\\edari-backups\\\\daily\\\\2026-07-28_0815","dbFile":"edari_2026-07-28_0815.sql.gz","dbSize":55497,"uploadsFile":"uploads_2026-07-28_0815.zip","uploadsSize":22,"uploadsFiles":0}}	127.0.0.1	2026-07-28 08:15:38	
82	1000	POST /	{"error":"PostgreSQL Error: syntax error at or near \\"EXCLUSIVE\\"\\nQuery: BEGIN EXCLUSIVE"}	127.0.0.1	2026-07-28 11:28:13	
83	1000	POST /	{"error":"PostgreSQL Error: syntax error at or near \\"EXCLUSIVE\\"\\nQuery: BEGIN EXCLUSIVE"}	127.0.0.1	2026-07-28 11:32:42	
84	1000	POST /	{"error":"PostgreSQL Error: syntax error at or near \\"EXCLUSIVE\\"\\nQuery: BEGIN EXCLUSIVE"}	127.0.0.1	2026-07-28 11:32:58	
85	1000	POST /	{"error":"این درخواست با یکی از مرخصی‌های قبلی شما همپوشانی دارد (1405/05/06 تا 1405/05/07)"}	127.0.0.1	2026-07-28 11:57:48	
86	1000	POST /	{"id":12,"message":"درخواست مرخصی ثبت شد"}	127.0.0.1	2026-07-28 11:58:00	
87	1000	PUT /read-all	{"message":"همه خوانده شد"}	127.0.0.1	2026-07-28 12:20:22	
88	1000	POST /	{"error":"PostgreSQL Error: syntax error at or near \\"EXCLUSIVE\\"\\nQuery: BEGIN EXCLUSIVE"}	127.0.0.1	2026-07-28 13:54:45	
89	1000	POST /	{"error":"PostgreSQL Error: syntax error at or near \\"EXCLUSIVE\\"\\nQuery: BEGIN EXCLUSIVE"}	127.0.0.1	2026-07-28 13:54:47	
90	1000	POST /	{"error":"Invalid history table"}	127.0.0.1	2026-07-28 13:56:47	
91	1000	POST /	{"error":"Invalid history table"}	127.0.0.1	2026-07-28 13:56:53	
92	1000	POST /	{"id":3,"request_number":"تعمیر خارجی-1405-003"}	127.0.0.1	2026-07-28 13:58:06	
93	1000	DELETE /2	{"success":true}	127.0.0.1	2026-07-28 14:00:21	
94	1000	DELETE /1	{"success":true}	127.0.0.1	2026-07-28 14:00:23	
95	1000	POST /	{"id":4,"request_number":"تعمیر خارجی-1405-004"}	127.0.0.1	2026-07-28 14:50:05	
96	1000	POST /api/admin/server-restart	{"message":"سرور در حال ری‌استارت..."}	127.0.0.1	2026-07-28 14:50:44	admin
97	1000	DELETE /3	{"success":true}	127.0.0.1	2026-07-28 14:51:25	
98	1000	PUT /	{"message":"دسترسی‌ها ذخیره شد"}	127.0.0.1	2026-07-28 14:54:55	
99	1000	DELETE /4	{"success":true}	127.0.0.1	2026-07-28 15:06:40	
100	1000	POST /api/admin/server-restart	{"message":"سرور در حال ری‌استارت..."}	127.0.0.1	2026-07-28 15:07:33	admin
101	1000	POST /	{"id":5,"request_number":"تعمیر خارجی-1405-005"}	127.0.0.1	2026-07-28 15:08:45	
102	1000	POST /5/approve	{"success":true,"status":"pending_pm"}	127.0.0.1	2026-07-28 15:08:59	
103	1000	POST /5/approve	{"success":true,"status":"pending_tech_manager"}	127.0.0.1	2026-07-28 15:09:05	
104	1000	POST /5/approve	{"success":true,"status":"pending_warehouse"}	127.0.0.1	2026-07-28 15:09:15	
105	1000	POST /5/approve	{"success":true,"status":"pending_factory_manager"}	127.0.0.1	2026-07-28 15:09:19	
106	1000	POST /5/approve	{"success":true,"status":"pending_support"}	127.0.0.1	2026-07-28 15:09:27	
107	1000	POST /5/approve	{"success":true,"status":"pending_quality"}	127.0.0.1	2026-07-28 15:09:31	
108	1000	POST /5/approve	{"success":true,"status":"pending_final_warehouse"}	127.0.0.1	2026-07-28 15:09:35	
109	1000	POST /5/approve	{"success":true,"status":"completed"}	127.0.0.1	2026-07-28 15:09:40	
110	1000	POST /api/admin/server-restart	{"message":"سرور در حال ری‌استارت..."}	127.0.0.1	2026-07-28 15:24:20	admin
111	1000	POST /api/admin/server-restart	{"message":"سرور در حال ری‌استارت..."}	127.0.0.1	2026-07-28 15:36:16	admin
112	1000	POST /api/admin/server-restart	{"message":"سرور در حال ری‌استارت..."}	127.0.0.1	2026-07-28 15:56:24	admin
113	1000	POST /api/admin/server-restart	{"message":"سرور در حال ری‌استارت..."}	127.0.0.1	2026-07-29 09:37:04	admin
\.


--
-- Data for Name: announcements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.announcements (id, title, body, image_path, target_audience, priority, is_active, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: attachments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.attachments (id, user_id, filename, original_name, mimetype, size, url, module_name, record_id, created_at) FROM stdin;
1	1000	1784957596514-253301.txt	test-upload.txt	text/plain	33	/uploads/attachments/1784957596514-253301.txt	test	\N	2026-07-25 09:03:16
\.


--
-- Data for Name: backup_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.backup_logs (id, type, date, db_file, db_size, uploads_file, uploads_size, uploads_files, backup_dir, status, error, created_at) FROM stdin;
1	daily	2026-07-27_2300	edari_2026-07-27_2300.sql.gz	55435	uploads_2026-07-27_2300.zip	22	0	C:\\Users\\najjari\\Documents\\edari-backups\\daily\\2026-07-27_2300	success		2026-07-27 23:00:00
2	daily	2026-07-28_2300	edari_2026-07-28_2300.sql.gz	57769	uploads_2026-07-28_2300.zip	342555	5	C:\\Users\\najjari\\Documents\\edari-backups\\daily\\2026-07-28_2300	success		2026-07-28 23:00:00
\.


--
-- Data for Name: backup_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.backup_settings (id, daily_path, weekly_path, daily_hour, daily_minute, weekly_day, weekly_hour, weekly_minute, daily_retention_days, weekly_retention_weeks, daily_enabled, weekly_enabled, created_at, updated_at) FROM stdin;
1	C:\\Users\\najjari\\Documents\\edari-backups\\daily	C:\\Users\\najjari\\Documents\\edari-backups\\weekly	23	0	5	14	0	30	12	1	1	2026-07-27 15:41:41	2026-07-27 15:45:24
\.


--
-- Data for Name: cardex; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cardex (id, user_id, item_id, quantity, delivery_date, status, warehouse_user_id, notes, user_confirm_date, created_at) FROM stdin;
\.


--
-- Data for Name: chat_members; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chat_members (id, room_id, user_id, last_read_at, joined_at) FROM stdin;
2	1	1003	\N	2026-07-26 13:08:18
3	2	6040062	2026-07-27 16:53:09	2026-07-27 16:38:39
1	1	6038141	2026-07-26 13:08:42	2026-07-26 13:08:18
4	2	6043146	\N	2026-07-27 16:38:39
\.


--
-- Data for Name: chat_messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chat_messages (id, room_id, user_id, message, message_type, attachment_url, created_at) FROM stdin;
1	1	6038141	vbnvbn	text	\N	2026-07-26 13:08:22
2	1	6038141	./m,/	text	\N	2026-07-26 13:08:28
3	1	6038141	asdasd	text	\N	2026-07-26 13:08:33
4	2	6040062	سلام	text	\N	2026-07-27 16:38:48
\.


--
-- Data for Name: chat_rooms; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chat_rooms (id, name, type, created_by, created_at) FROM stdin;
1	\N	direct	6038141	2026-07-26 13:08:18
2	\N	direct	6040062	2026-07-27 16:38:39
\.


--
-- Data for Name: conference_bookings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.conference_bookings (id, user_id, request_number, meeting_date, start_time, end_time, title, description, attendees_count, status, manager_id, manager_comment, created_at) FROM stdin;
\.


--
-- Data for Name: conference_counter; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.conference_counter (id, year, last_number) FROM stdin;
\.


--
-- Data for Name: conference_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.conference_history (id, booking_id, user_id, user_name, action, comment, created_at) FROM stdin;
\.


--
-- Data for Name: csv_imports_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.csv_imports_log (id, file_name, file_path, imported_by, imported_at, row_count) FROM stdin;
1	test_import1.csv	C:\\Users\\najjari\\Documents\\work-automation\\backend\\uploads\\csv_imports\\import_1000_1784116401197_test_import1.csv	1000	2026-07-15 15:23:21	241
\.


--
-- Data for Name: daily_output; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.daily_output (id, user_id, report_date, product_name, quantity, unit, quality_score, machine_number, description, status, supervisor_id, supervisor_comment, supervisor_date, manager_id, manager_comment, manager_date, created_at, department_id, product_type) FROM stdin;
\.


--
-- Data for Name: daily_output_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.daily_output_history (id, output_id, user_id, user_name, action, comment, created_at) FROM stdin;
\.


--
-- Data for Name: daily_work_report_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.daily_work_report_history (id, report_id, user_id, user_name, action, comment, created_at) FROM stdin;
\.


--
-- Data for Name: daily_work_reports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.daily_work_reports (id, user_id, report_date, work_description, work_duration, department_id, status, central_comment, central_by, central_at, manager_comment, manager_by, manager_at, project_control_comment, project_control_by, project_control_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.departments (id, name, parent_id, is_active, created_at) FROM stdin;
1	بدون واحد	\N	1	2026-07-11 14:24:05
2	ساخت	\N	1	2026-07-15 15:23:01
3	ترابری	\N	1	2026-07-15 15:23:01
4	برق	\N	1	2026-07-15 15:23:01
5	اداری	\N	1	2026-07-15 15:23:01
6	خدمات سایت	\N	1	2026-07-15 15:23:01
7	معدن	\N	1	2026-07-15 15:23:01
8	تاسیسات و پایپینگ	\N	1	2026-07-15 15:23:01
9	PM	\N	1	2026-07-15 15:23:01
10	عمران	\N	1	2026-07-15 15:23:01
11	آشپزخانه	\N	1	2026-07-15 15:23:01
12	بهداشت حرفه ای	\N	1	2026-07-15 15:23:01
13	مالی	\N	1	2026-07-15 15:23:01
14	انبار	\N	1	2026-07-15 15:23:01
15	سانترال	\N	1	2026-07-15 15:23:01
16	انتظامات	\N	1	2026-07-15 15:23:01
17	مامور خرید	\N	1	2026-07-15 15:23:01
18	آجرنسوز	\N	1	2026-07-15 15:23:01
19	HSE	\N	1	2026-07-15 15:23:01
20	کنترل پروژه	\N	1	2026-07-15 15:23:01
21	ناظر فلزی	\N	1	2026-07-15 15:23:01
22	کنترل کیفی	\N	1	2026-07-15 15:23:01
23	نقشه برداری	\N	1	2026-07-15 15:23:01
24	انبار کنترل متریال	\N	1	2026-07-15 15:23:01
25	خدمات مدیریت	\N	1	2026-07-15 15:23:01
26	اجرائی عمران	\N	1	2026-07-15 15:23:01
27	مسئول نصب تجهیزات	\N	1	2026-07-15 15:23:01
28	روابط عمومی	\N	1	2026-07-15 15:23:01
29	ساخت کیسینگ	\N	1	2026-07-15 15:23:01
30	مکانیک بچ پلانت	\N	1	2026-07-15 15:23:01
31	مکانیک صنعتی	\N	1	2026-07-15 15:23:01
32	نصب استراکچر	\N	1	2026-07-15 15:23:01
33	انفورماتیک	\N	1	2026-07-15 15:23:01
34	نصب کیسینگ	\N	1	2026-07-15 15:23:01
35	خدمات فنی	\N	1	2026-07-15 15:23:01
\.


--
-- Data for Name: digital_signatures; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.digital_signatures (id, user_id, signature_data, signature_type, created_at, scanned_signature, employee_code) FROM stdin;
5	1000		scanned	2026-07-26 14:19:49	/uploads/signatures/sig-1785062989050.png	1000
6	6034789		scanned	2026-07-27 08:40:36	/uploads/signatures/sig-1785129036744.png	6034789
7	6034682	data:image/png;base64,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	drawn	2026-07-27 08:46:47	\N	6034682
8	6002734	data:image/png;base64,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	drawn	2026-07-27 08:47:08	\N	6002734
9	6040062		scanned	2026-07-27 08:52:22	/uploads/signatures/sig-1785129742988.png	6040062
\.


--
-- Data for Name: inspection_counter; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inspection_counter (id, year, last_number) FROM stdin;
\.


--
-- Data for Name: inspection_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inspection_history (id, inspection_id, user_id, user_name, action, comment, created_at) FROM stdin;
\.


--
-- Data for Name: inspection_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inspection_requests (id, user_id, request_number, title, description, equipment_name, location, inspection_type, urgency, deadline, department_id, assigned_to, inspection_result, inspection_description, inspect_date, status, supervisor_id, supervisor_comment, supervisor_date, manager_id, manager_comment, manager_date, created_at) FROM stdin;
\.


--
-- Data for Name: inventory_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inventory_items (id, name, description, unit, is_active, created_at) FROM stdin;
1	میز اداری	میز کار اداری	عدد	1	2026-07-11 14:24:05
2	صندلی اداری	صندلی گردان	عدد	1	2026-07-11 14:24:05
3	کامپیوتر	کیس و مانیتور	عدد	1	2026-07-11 14:24:05
4	پرینتر	پرینتر لیزری	عدد	1	2026-07-11 14:24:05
5	کاغذ A4	بسته 500 برگی	بسته	1	2026-07-11 14:24:05
6	خودکار	خودکار آبی	عدد	1	2026-07-11 14:24:05
7	پوشه	پوشه فنری	عدد	1	2026-07-11 14:24:05
\.


--
-- Data for Name: it_request_counter; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.it_request_counter (id, year, last_number) FROM stdin;
1	1405	1
\.


--
-- Data for Name: it_request_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.it_request_history (id, it_request_id, user_id, user_name, action, comment, created_at) FROM stdin;
1	1	1000	مدیر سیستم	ثبت درخواست		2026-07-15 16:51:52
\.


--
-- Data for Name: it_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.it_requests (id, user_id, request_number, title, description, request_type, urgency, device_info, assigned_to, accept_date, complete_date, complete_comment, status, created_at, department_id) FROM stdin;
1	1000	IT-1405-001	نم		hardware	normal		1000	\N	\N	\N	in_progress	2026-07-15 16:51:52	1
\.


--
-- Data for Name: job_application_attachments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.job_application_attachments (id, application_id, file_name, file_path, file_type, created_at) FROM stdin;
\.


--
-- Data for Name: job_application_counter; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.job_application_counter (id, year, last_number) FROM stdin;
\.


--
-- Data for Name: job_application_work_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.job_application_work_history (id, application_id, org_name, "position", duration, last_salary, leave_reason, contact_info, sort_order) FROM stdin;
\.


--
-- Data for Name: job_applications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.job_applications (id, user_id, application_number, full_name, father_name, national_id, national_id_issued_from, birth_date, birth_place, residence_duration, nationality, religion, language, education_level, education_place, military_status, military_done, military_service_type, military_exempt_non_medical, military_exempt_medical, military_exempt_reason, marital_status, children_count, spouse_job, requested_salary, housing_status, housing_rent_amount, residential_address, phone_number, moral_traits, relatives_in_company, relatives_details, criminal_record, kave_factories, smoking, smoking_duration, foreign_languages, turkish_known, computer_skills, training_courses, references_info, photo, status, reviewed_by, reviewed_at, review_comment, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: leave_balance; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.leave_balance (id, user_id, total_days, used_hours) FROM stdin;
2	1003	0	0
3	6000885	0	0
4	6011540	0	0
5	6012950	0	0
6	6034682	0	0
7	6034684	0	0
8	6035008	0	0
9	6036420	0	0
10	6036421	0	0
11	6036422	0	0
12	6036521	0	0
13	6036696	0	0
14	6036805	0	0
15	6037857	0	0
16	6038124	0	0
17	6038141	0	0
18	6038466	0	0
19	6040602	0	0
20	6040604	0	0
21	6040990	0	0
22	6042593	0	0
23	6043146	0	0
24	6043148	0	0
25	6043151	0	0
26	6044899	0	0
27	6046435	0	0
28	6046853	0	0
29	6046858	0	0
30	10008	0	0
31	10014	0	0
32	10022	0	0
33	10023	0	0
34	10028	0	0
35	10030	0	0
36	10036	0	0
38	6001552	0	0
39	6010184	0	0
40	6029092	0	0
41	6030513	0	0
42	6032032	0	0
43	6032455	0	0
44	6034787	0	0
46	6035009	0	0
47	6035010	0	0
48	6035363	0	0
49	6036520	0	0
50	6036522	0	0
51	6036523	0	0
52	6036806	0	0
53	6037048	0	0
54	6037595	0	0
55	6037859	0	0
56	6038095	0	0
57	6038140	0	0
58	6038412	0	0
59	6038455	0	0
60	6038464	0	0
61	6038465	0	0
62	6038544	0	0
63	6038818	0	0
64	6038869	0	0
65	6040063	0	0
66	6040373	0	0
67	6040377	0	0
68	6040601	0	0
69	6040603	0	0
70	6040989	0	0
71	6041131	0	0
72	6041132	0	0
73	6041133	0	0
74	6041134	0	0
75	6041534	0	0
76	6041535	0	0
77	6042039	0	0
78	6042040	0	0
79	6042041	0	0
80	6042045	0	0
81	6042310	0	0
82	6042592	0	0
83	6042594	0	0
84	6042959	0	0
85	6042958	0	0
86	6042960	0	0
87	6042961	0	0
88	6042962	0	0
89	6042963	0	0
90	6043122	0	0
91	6043147	0	0
92	6043149	0	0
93	6043371	0	0
94	6043372	0	0
95	6043767	0	0
96	6043768	0	0
97	6043769	0	0
98	6043770	0	0
99	6043771	0	0
100	6043772	0	0
101	6043773	0	0
102	6043774	0	0
103	6044187	0	0
104	6044188	0	0
105	6044189	0	0
106	6044191	0	0
107	6044193	0	0
108	6044194	0	0
109	6044196	0	0
110	6044197	0	0
111	6044307	0	0
112	6044308	0	0
113	6044310	0	0
114	6044570	0	0
115	6044571	0	0
116	6044572	0	0
117	6044573	0	0
118	6044574	0	0
119	6044575	0	0
120	6044577	0	0
121	6044580	0	0
122	6044581	0	0
123	6044582	0	0
124	6044583	0	0
125	6044619	0	0
126	6044623	0	0
127	6044900	0	0
128	6044901	0	0
129	6044902	0	0
130	6044928	0	0
131	6044929	0	0
132	6044930	0	0
133	6044931	0	0
134	6045199	0	0
135	6045200	0	0
136	6045232	0	0
137	6045233	0	0
138	6045250	0	0
139	6045251	0	0
140	6045540	0	0
141	6045541	0	0
142	6045542	0	0
143	6045545	0	0
144	6045546	0	0
145	6045560	0	0
146	6045562	0	0
147	6045563	0	0
148	6045648	0	0
149	6045649	0	0
150	6045650	0	0
151	6045651	0	0
152	6045652	0	0
153	6045822	0	0
154	6045830	0	0
155	6045845	0	0
156	6045846	0	0
157	6045848	0	0
37	6040062	0	1.5
158	6045849	0	0
159	6045850	0	0
160	6045851	0	0
162	6045862	0	0
163	6045863	0	0
164	6045865	0	0
165	6046098	0	0
166	6046099	0	0
167	6046100	0	0
168	6046101	0	0
169	6046104	0	0
170	6046105	0	0
171	6046107	0	0
172	6046124	0	0
173	6046126	0	0
174	6046127	0	0
175	6046128	0	0
176	6046139	0	0
177	6046140	0	0
178	6046141	0	0
179	6046143	0	0
180	6046144	0	0
181	6046431	0	0
182	6046436	0	0
183	6046437	0	0
184	6046438	0	0
185	6046439	0	0
186	6046440	0	0
187	6046450	0	0
188	6046453	0	0
189	6046672	0	0
190	6046673	0	0
191	6046712	0	0
192	6046713	0	0
193	6046714	0	0
194	6046715	0	0
195	6046716	0	0
196	6046885	0	0
197	6046886	0	0
198	6046887	0	0
199	6047001	0	0
200	10001	0	0
201	10002	0	0
202	10003	0	0
203	10004	0	0
204	10005	0	0
205	10006	0	0
206	10007	0	0
207	10009	0	0
208	10010	0	0
209	10011	0	0
210	10012	0	0
211	10013	0	0
212	10015	0	0
213	10016	0	0
214	10017	0	0
215	10018	0	0
216	10019	0	0
217	10020	0	0
218	10021	0	0
219	10024	0	0
220	10029	0	0
221	10031	0	0
222	10032	0	0
223	10033	0	0
224	10034	0	0
225	10035	0	0
226	10037	0	0
227	10038	0	0
228	10039	0	0
229	10040	0	0
230	10041	0	0
231	10042	0	0
232	10043	0	0
233	10044	0	0
234	10045	0	0
235	10046	0	0
236	10047	0	0
237	10048	0	0
238	10049	0	0
239	10050	0	0
240	10051	0	0
241	10052	0	0
242	10053	0	0
243	10054	0	0
161	6045861	0	3.5
244	6002734	0	0
45	6034789	0	21
1	1000	0	39
\.


--
-- Data for Name: leave_change_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.leave_change_logs (id, action_by, action_type, target_id, old_value, new_value, details, created_at) FROM stdin;
\.


--
-- Data for Name: leave_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.leave_requests (id, user_id, leave_type, start_date, end_date, hours_count, reason, status, supervisor_id, supervisor_comment, supervisor_date, manager_id, manager_comment, manager_date, security_id, security_date, edited_by, edited_at, edit_reason, created_at, start_hour, end_hour, admin_id, admin_comment, admin_date, remaining_leave_days) FROM stdin;
1	1000	مرخصی	1405/04/25	1405/04/25	3		seen_security	\N	\N	\N	1000	\N	2026-07-15 16:52:21	1000	2026-07-15 16:52:48	\N	\N	\N	2026-07-15 16:52:21	08:00	11:00	\N	\N	\N	\N
2	1000	مرخصی	1405/04/25	1405/04/27	6		seen_security	\N	\N	\N	1000	\N	2026-07-16 08:40:16	1000	2026-07-16 08:40:32	\N	\N	\N	2026-07-16 08:40:16	14:00	15:00	\N	\N	\N	\N
5	6045861	مرخصی	1405/05/05	1405/05/05	3.5		seen_security	\N	\N	\N	1000	\N	2026-07-26 09:53:00	1000	2026-07-26 09:53:13	\N	\N	\N	2026-07-26 09:53:00	08:00	11:30	\N	\N	\N	\N
4	1000	مرخصی	1405/05/05	1405/05/05	8		seen_security	\N	\N	\N	1000	\N	2026-07-26 09:51:10	1000	2026-07-26 09:53:14	\N	\N	\N	2026-07-26 09:51:10	08:00	17:00	\N	\N	\N	\N
3	6040062	مرخصی	1405/05/03	1405/05/03	1.5		seen_security	\N	\N	\N	1000	\N	2026-07-25 12:36:10	1000	2026-07-26 09:53:15	\N	\N	\N	2026-07-25 12:36:10	13:30	15:00	\N	\N	\N	\N
6	6034789	مرخصی	1405/05/04	1405/05/04	1		approved	6040062		2026-07-26 10:00:59	6002734		2026-07-26 10:11:38	\N	\N	\N	\N	\N	2026-07-26 10:00:55	11:00	12:00	\N	\N	\N	\N
8	1000	مرخصی	1405/05/06	1405/05/07	11		approved	\N	\N	\N	1000	\N	2026-07-26 12:11:46	\N	\N	\N	\N	\N	2026-07-26 12:11:46	10:30	14:30	\N	\N	\N	\N
9	1000	مرخصی	1405/05/04	1405/05/04	1		approved	\N	\N	\N	1000	\N	2026-07-26 12:12:00	\N	\N	\N	\N	\N	2026-07-26 12:12:00	14:30	15:30	\N	\N	\N	\N
10	1000	مرخصی	1405/05/13	1405/05/13	8		approved	\N	\N	\N	1000	\N	2026-07-26 13:19:14	\N	\N	\N	\N	\N	2026-07-26 13:19:14	08:00	17:00	\N	\N	\N	\N
11	6034789	مرخصی	1405/05/08	1405/05/08	4		approved	6040062		2026-07-27 08:42:57	6002734		2026-07-27 08:44:36	\N	\N	\N	\N	\N	2026-07-27 08:41:03	08:00	12:00	\N	\N	\N	\N
7	6034789	مرخصی	1405/05/05	1405/05/06	16		seen_security	6040062		2026-07-26 10:01:21	6002734		2026-07-26 10:14:33	6038141	2026-07-27 09:37:45	\N	\N	\N	2026-07-26 10:01:18	08:00	17:00	6034682		2026-07-26 10:14:10	\N
12	1000	مرخصی	1405/05/20	1405/05/20	2		approved	\N	\N	\N	1000	\N	2026-07-28 11:58:00	\N	\N	\N	\N	\N	2026-07-28 11:58:00	12:30	15:00	\N	\N	\N	\N
\.


--
-- Data for Name: letter_attachments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.letter_attachments (id, letter_id, file_name, file_path, created_at) FROM stdin;
\.


--
-- Data for Name: letter_counter; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.letter_counter (id, year, last_number) FROM stdin;
\.


--
-- Data for Name: letter_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.letter_history (id, letter_id, user_id, user_name, action, comment, created_at) FROM stdin;
\.


--
-- Data for Name: letter_units; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.letter_units (id, letter_id, unit_id, status, seen_date) FROM stdin;
\.


--
-- Data for Name: letters; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.letters (id, letter_number, subject, body, sender_id, sender_unit_id, priority, status, manager_id, manager_comment, manager_date, signature_data, attachment_name, attachment_path, central_comment, created_at, central_id, central_date, selected_manager_id) FROM stdin;
\.


--
-- Data for Name: mission_counter; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.mission_counter (id, year, last_number) FROM stdin;
\.


--
-- Data for Name: mission_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.mission_history (id, mission_id, user_id, user_name, action, comment, created_at) FROM stdin;
\.


--
-- Data for Name: mission_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.mission_requests (id, user_id, request_number, mission_date, start_time, end_time, destination, mission_type, description, reason, department_id, status, supervisor_id, supervisor_comment, supervisor_date, manager_id, manager_comment, manager_date, created_at) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, title, body, link, is_read, created_at) FROM stdin;
1	6040601	درخواست فناوری اطلاعات جدید	درخواست شماره IT-1405-001 توسط مدیر سیستم ثبت شد	/it-request	0	2026-07-15 16:51:52
2	6042039	درخواست فناوری اطلاعات جدید	درخواست شماره IT-1405-001 توسط مدیر سیستم ثبت شد	/it-request	0	2026-07-15 16:51:52
3	6044197	درخواست فناوری اطلاعات جدید	درخواست شماره IT-1405-001 توسط مدیر سیستم ثبت شد	/it-request	0	2026-07-15 16:51:52
4	6045861	ثبت اضافه کار توسط مدیریت	اضافه کار برای شما توسط مدیریت (مدیر سیستم) ثبت و تایید گردید	/overtime	0	2026-07-16 08:42:08
6	6045861	ثبت مرخصی توسط مدیریت	مرخصی برای شما توسط مدیریت (مدیر سیستم) ثبت و تایید گردید	/leave	0	2026-07-26 09:53:00
8	6034789	تایید سرپرست	درخواست مرخصی شما توسط سرپرست تایید شد و برای مدیر ارسال شد	/leave	0	2026-07-26 10:00:59
10	6034789	تایید سرپرست	درخواست مرخصی شما توسط سرپرست تایید شد و برای اداری ارسال شد	/leave	0	2026-07-26 10:01:21
12	6034789	تایید نهایی مرخصی	مرخصی شما توسط مدیر تایید شد	/leave	0	2026-07-26 10:11:38
13	6034789	تایید اداری	مرخصی روزانه شما توسط اداری تایید شد و برای مدیر ارسال شد	/leave	0	2026-07-26 10:14:10
14	6002734	درخواست مرخصی جدید	مرخصی روزانه 6034789 توسط اداری تایید شده و نیاز به تایید مدیر دارد	/leave	0	2026-07-26 10:14:10
15	6034789	تایید نهایی مرخصی	مرخصی شما توسط مدیر تایید شد	/leave	0	2026-07-26 10:14:33
17	6034789	تایید سرپرست	درخواست مرخصی شما توسط سرپرست تایید شد و برای مدیر ارسال شد	/leave	0	2026-07-27 08:42:57
18	6002734	درخواست مرخصی جدید	درخواست مرخصی ساعتی 6034789 نیاز به تایید مدیر دارد	/leave	0	2026-07-27 08:42:57
19	6034789	تایید نهایی مرخصی	مرخصی شما توسط مدیر تایید شد	/leave	0	2026-07-27 08:44:36
5	6040062	ثبت مرخصی توسط مدیریت	مرخصی برای شما توسط مدیریت (مدیر سیستم) ثبت و تایید گردید	/leave	1	2026-07-25 12:36:10
7	6040062	درخواست مرخصی جدید	مهدی چمنی درخواست مرخصی ثبت کرده است	/leave	1	2026-07-26 10:00:55
9	6040062	درخواست مرخصی جدید	مهدی چمنی درخواست مرخصی ثبت کرده است	/leave	1	2026-07-26 10:01:18
16	6040062	درخواست مرخصی جدید	مهدی چمنی درخواست مرخصی ثبت کرده است	/leave	1	2026-07-27 08:41:03
11	1000	درخواست مرخصی جدید	درخواست مرخصی روزانه 6034789 نیاز به بررسی اداری دارد	/leave	1	2026-07-26 10:01:21
\.


--
-- Data for Name: official_holidays; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.official_holidays (id, holiday_date, title, created_at) FROM stdin;
\.


--
-- Data for Name: overtime_counter; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.overtime_counter (id, year, last_number) FROM stdin;
\.


--
-- Data for Name: overtime_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.overtime_history (id, request_id, user_id, user_name, action, comment, old_status, new_status, created_at) FROM stdin;
\.


--
-- Data for Name: overtime_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.overtime_requests (id, user_id, start_date, end_date, start_hour, end_hour, hours_count, reason, status, supervisor_id, supervisor_comment, supervisor_date, manager_id, manager_comment, manager_date, security_id, security_date, edited_by, edited_at, edit_reason, created_at) FROM stdin;
1	6045861	1405/04/25	1405/04/25	14:30	22:30	8		seen_security	\N	\N	\N	1000	\N	2026-07-16 08:42:08	1000	2026-07-16 08:42:30	\N	\N	\N	2026-07-16 08:42:08
\.


--
-- Data for Name: payment_counter; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payment_counter (id, year, last_number) FROM stdin;
\.


--
-- Data for Name: payment_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payment_history (id, payment_id, user_id, user_name, action, comment, created_at) FROM stdin;
\.


--
-- Data for Name: payment_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payment_requests (id, user_id, request_number, amount, payment_type, description, reason, recipient_name, bank_name, card_number, department_id, status, supervisor_id, supervisor_comment, supervisor_date, manager_id, manager_comment, manager_date, created_at) FROM stdin;
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.permissions (id, module_key, department_id, user_id, is_enabled, created_at) FROM stdin;
264	dashboard_view	1	\N	1	2026-07-28 14:54:55
265	leave_request	1	\N	1	2026-07-28 14:54:55
266	letters_send	1	\N	1	2026-07-28 14:54:55
267	dashboard_view	2	\N	1	2026-07-28 14:54:55
268	leave_request	2	\N	1	2026-07-28 14:54:55
269	letters_send	2	\N	1	2026-07-28 14:54:55
270	dashboard_view	3	\N	1	2026-07-28 14:54:55
271	leave_request	3	\N	1	2026-07-28 14:54:55
272	letters_send	3	\N	1	2026-07-28 14:54:55
273	dashboard_view	4	\N	1	2026-07-28 14:54:55
274	leave_request	4	\N	1	2026-07-28 14:54:55
275	letters_send	4	\N	1	2026-07-28 14:54:55
276	dashboard_view	5	\N	1	2026-07-28 14:54:55
277	leave_request	5	\N	1	2026-07-28 14:54:55
278	letters_send	5	\N	1	2026-07-28 14:54:55
279	dashboard_view	6	\N	1	2026-07-28 14:54:55
280	leave_request	6	\N	1	2026-07-28 14:54:55
281	letters_send	6	\N	1	2026-07-28 14:54:55
282	dashboard_view	7	\N	1	2026-07-28 14:54:55
283	leave_request	7	\N	1	2026-07-28 14:54:55
284	letters_send	7	\N	1	2026-07-28 14:54:55
285	dashboard_view	8	\N	1	2026-07-28 14:54:55
286	leave_request	8	\N	1	2026-07-28 14:54:55
287	letters_send	8	\N	1	2026-07-28 14:54:55
288	dashboard_view	9	\N	1	2026-07-28 14:54:55
289	leave_request	9	\N	1	2026-07-28 14:54:55
290	letters_send	9	\N	1	2026-07-28 14:54:55
291	dashboard_view	10	\N	1	2026-07-28 14:54:55
292	leave_request	10	\N	1	2026-07-28 14:54:55
293	letters_send	10	\N	1	2026-07-28 14:54:55
294	dashboard_view	11	\N	1	2026-07-28 14:54:55
295	leave_request	11	\N	1	2026-07-28 14:54:55
296	letters_send	11	\N	1	2026-07-28 14:54:55
297	dashboard_view	12	\N	1	2026-07-28 14:54:55
298	leave_request	12	\N	1	2026-07-28 14:54:55
299	letters_send	12	\N	1	2026-07-28 14:54:55
300	dashboard_view	13	\N	1	2026-07-28 14:54:55
301	leave_request	13	\N	1	2026-07-28 14:54:55
302	letters_send	13	\N	1	2026-07-28 14:54:55
303	dashboard_view	14	\N	1	2026-07-28 14:54:55
304	leave_request	14	\N	1	2026-07-28 14:54:55
305	letters_send	14	\N	1	2026-07-28 14:54:55
306	dashboard_view	15	\N	1	2026-07-28 14:54:55
307	leave_request	15	\N	1	2026-07-28 14:54:55
308	letters_send	15	\N	1	2026-07-28 14:54:55
309	dashboard_view	16	\N	1	2026-07-28 14:54:55
310	leave_request	16	\N	1	2026-07-28 14:54:55
311	letters_send	16	\N	1	2026-07-28 14:54:55
312	dashboard_view	17	\N	1	2026-07-28 14:54:55
313	leave_request	17	\N	1	2026-07-28 14:54:55
314	letters_send	17	\N	1	2026-07-28 14:54:55
315	dashboard_view	18	\N	1	2026-07-28 14:54:55
316	leave_request	18	\N	1	2026-07-28 14:54:55
317	letters_send	18	\N	1	2026-07-28 14:54:55
318	dashboard_view	19	\N	1	2026-07-28 14:54:55
319	leave_request	19	\N	1	2026-07-28 14:54:55
320	letters_send	19	\N	1	2026-07-28 14:54:55
321	dashboard_view	20	\N	1	2026-07-28 14:54:55
322	leave_request	20	\N	1	2026-07-28 14:54:55
323	letters_send	20	\N	1	2026-07-28 14:54:55
324	dashboard_view	21	\N	1	2026-07-28 14:54:55
325	leave_request	21	\N	1	2026-07-28 14:54:55
326	letters_send	21	\N	1	2026-07-28 14:54:55
327	dashboard_view	22	\N	1	2026-07-28 14:54:55
328	leave_request	22	\N	1	2026-07-28 14:54:55
329	letters_send	22	\N	1	2026-07-28 14:54:55
330	dashboard_view	23	\N	1	2026-07-28 14:54:55
331	leave_request	23	\N	1	2026-07-28 14:54:55
332	letters_send	23	\N	1	2026-07-28 14:54:55
333	dashboard_view	24	\N	1	2026-07-28 14:54:55
334	leave_request	24	\N	1	2026-07-28 14:54:55
335	letters_send	24	\N	1	2026-07-28 14:54:55
336	dashboard_view	25	\N	1	2026-07-28 14:54:55
337	leave_request	25	\N	1	2026-07-28 14:54:55
338	letters_send	25	\N	1	2026-07-28 14:54:55
339	dashboard_view	26	\N	1	2026-07-28 14:54:55
340	leave_request	26	\N	1	2026-07-28 14:54:55
341	letters_send	26	\N	1	2026-07-28 14:54:55
342	dashboard_view	27	\N	1	2026-07-28 14:54:55
343	leave_request	27	\N	1	2026-07-28 14:54:55
344	letters_send	27	\N	1	2026-07-28 14:54:55
345	dashboard_view	28	\N	1	2026-07-28 14:54:55
346	leave_request	28	\N	1	2026-07-28 14:54:55
347	letters_send	28	\N	1	2026-07-28 14:54:55
348	dashboard_view	29	\N	1	2026-07-28 14:54:55
349	leave_request	29	\N	1	2026-07-28 14:54:55
350	letters_send	29	\N	1	2026-07-28 14:54:55
351	dashboard_view	30	\N	1	2026-07-28 14:54:55
352	leave_request	30	\N	1	2026-07-28 14:54:55
353	letters_send	30	\N	1	2026-07-28 14:54:55
354	dashboard_view	31	\N	1	2026-07-28 14:54:55
355	leave_request	31	\N	1	2026-07-28 14:54:55
356	letters_send	31	\N	1	2026-07-28 14:54:55
357	dashboard_view	32	\N	1	2026-07-28 14:54:55
358	leave_request	32	\N	1	2026-07-28 14:54:55
359	letters_send	32	\N	1	2026-07-28 14:54:55
360	dashboard_view	33	\N	1	2026-07-28 14:54:55
361	leave_request	33	\N	1	2026-07-28 14:54:55
362	letters_send	33	\N	1	2026-07-28 14:54:55
363	dashboard_view	34	\N	1	2026-07-28 14:54:55
364	leave_request	34	\N	1	2026-07-28 14:54:55
365	letters_send	34	\N	1	2026-07-28 14:54:55
366	dashboard_view	35	\N	1	2026-07-28 14:54:55
367	leave_request	35	\N	1	2026-07-28 14:54:55
368	letters_send	35	\N	1	2026-07-28 14:54:55
369	chat_view	33	\N	1	2026-07-28 14:54:55
370	repair_external_create	4	\N	1	2026-07-28 14:54:55
371	repair_external_view	4	\N	1	2026-07-28 14:54:55
\.


--
-- Data for Name: permissions_migrated; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.permissions_migrated (id) FROM stdin;
\.


--
-- Data for Name: project_supply; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_supply (id, user_id, request_number, project_name, items, description, urgency, estimated_cost, deadline, department_id, status, supervisor_id, supervisor_comment, supervisor_date, manager_id, manager_comment, manager_date, created_at) FROM stdin;
\.


--
-- Data for Name: project_supply_counter; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_supply_counter (id, year, last_number) FROM stdin;
\.


--
-- Data for Name: project_supply_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_supply_history (id, supply_id, user_id, user_name, action, comment, created_at) FROM stdin;
\.


--
-- Data for Name: project_supply_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_supply_requests (id, request_number, user_id, project_name, items, description, estimated_cost, urgency, deadline, status, supervisor_id, supervisor_comment, supervisor_date, manager_id, manager_comment, manager_date, created_at, department_id) FROM stdin;
\.


--
-- Data for Name: purchase_counter; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_counter (id, year, last_number) FROM stdin;
\.


--
-- Data for Name: purchase_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_history (id, purchase_id, user_id, user_name, action, comment, created_at) FROM stdin;
\.


--
-- Data for Name: purchase_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_requests (id, user_id, request_number, items, urgency, reason, department_id, status, supervisor_id, supervisor_comment, supervisor_date, manager_id, manager_comment, manager_date, created_at) FROM stdin;
\.


--
-- Data for Name: push_subscriptions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.push_subscriptions (id, user_id, endpoint, p256dh, auth_key, created_at) FROM stdin;
\.


--
-- Data for Name: repair_counter; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.repair_counter (id, year, last_number) FROM stdin;
1	1405	5
\.


--
-- Data for Name: repair_external_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.repair_external_history (id, request_id, user_id, user_name, action, comment, old_status, new_status, created_at) FROM stdin;
3	5	1000	مدیر سیستم	ثبت درخواست		\N	\N	2026-07-28 15:08:45
4	5	1000	مدیر سیستم	تایید مسئول واحد		\N	\N	2026-07-28 15:08:59
5	5	1000	مدیر سیستم	تایید PM		\N	\N	2026-07-28 15:09:05
6	5	1000	مدیر سیستم	تایید مدیر فنی		\N	\N	2026-07-28 15:09:15
7	5	1000	مدیر سیستم	تایید انبار		\N	\N	2026-07-28 15:09:19
8	5	1000	مدیر سیستم	تایید مدیر کارخانه		\N	\N	2026-07-28 15:09:27
9	5	1000	مدیر سیستم	تکمیل پشتیبانی و ثبت تعمیرات		\N	\N	2026-07-28 15:09:31
10	5	1000	مدیر سیستم	تایید کنترل کیفی		\N	\N	2026-07-28 15:09:35
11	5	1000	مدیر سیستم	تایید نهایی انبار - بستن درخواست		\N	\N	2026-07-28 15:09:40
\.


--
-- Data for Name: repair_external_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.repair_external_items (id, request_id, item_name, tech_specs, serial_number, quantity, attachments_desc, created_at) FROM stdin;
5	5	41	4141	141	1		2026-07-28 15:08:45
\.


--
-- Data for Name: repair_external_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.repair_external_requests (id, request_number, user_id, department_id, status, from_unit, to_unit, manager_name, request_date, urgency, deadline, work_type, tech_description, estimated_cost, fault_description, fault_reason, warehouse_stock, warehouse_stock_status, delivery_date, send_date, send_serial, destination, contractor_name, contractor_address, repair_description, repair_cost, supporter_name, return_date, return_serial, quality_status, quality_notes, images, pm_approved, pm_approved_at, dept_manager_approved, dept_manager_approved_at, tech_manager_approved, tech_manager_approved_at, warehouse_approved, warehouse_approved_at, factory_manager_approved, factory_manager_approved_at, support_completed, support_completed_at, quality_approved, quality_approved_at, final_warehouse_approved, final_warehouse_approved_at, created_at, updated_at, doc_code, edit_date, revision_number, form_date, repair_speed, sketch_file, photo_file, equipment_name, pm_electrical_approved, pm_electrical_approved_at, dept_manager_signature_approved, dept_manager_signature_approved_at, manager_approved, manager_approved_at, pm_id, dept_manager_id, tech_manager_id, warehouse_id, factory_manager_id) FROM stdin;
5	تعمیر خارجی-1405-005	1000	1	completed	انتظامات	واحد PM	مدیر سیستم	2026-07-28 15:08:45	normal	1405/05/06	تعمیر	تئدوذ	45	ذدتئ	کارکرد زیاد / استهلاک قطعات داخلی	1	سالم	1405/05/06	1405/05/07	1		لاتدذئ	تئنذد	اتئذا	45	مدیر سیستم	2026-07-28T11:39:35.639Z				\N	1	2026-07-28T11:39:05.540Z	1	2026-07-28T11:38:59.079Z	1	2026-07-28T11:39:15.190Z	1	2026-07-28T11:39:19.957Z	1	2026-07-28T11:39:27.468Z	1	2026-07-28T11:39:31.626Z	1	2026-07-28T11:39:35.639Z	1	2026-07-28T11:39:40.068Z	2026-07-28 15:08:45	2026-07-28 15:09:40	PM_01	۱۴۰۴/۰۹/۲۶	\N	1405/05/06	urgent	\N	\N	نت	0	\N	0	\N	0	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: repair_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.repair_history (id, repair_id, user_id, user_name, action, comment, created_at) FROM stdin;
\.


--
-- Data for Name: repair_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.repair_requests (id, user_id, request_number, title, description, equipment_name, location, urgency, estimated_cost, department_id, status, supervisor_id, supervisor_comment, supervisor_date, manager_id, manager_comment, manager_date, created_at, images) FROM stdin;
\.


--
-- Data for Name: restaurant_menu; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.restaurant_menu (id, food_date, option_number, food_name, description, price, is_active, created_at) FROM stdin;
1	1405/04/27	1	vcxbxcv		0	1	2026-07-16 08:44:04
2	1405/04/27	2	vcxbxc		0	1	2026-07-16 08:44:04
3	1405/04/28	1	سبزی		0	1	2026-07-16 08:45:03
4	1405/04/28	2	کباب		0	1	2026-07-16 08:45:03
5	1405/04/29	1	لوبیا		0	1	2026-07-16 08:45:16
6	1405/04/29	2	گوشت		0	1	2026-07-16 08:45:16
\.


--
-- Data for Name: restaurant_reservations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.restaurant_reservations (id, user_id, food_id, food_date, quantity, status, notes, created_at) FROM stdin;
1	1000	1	1405/04/27	1	active		2026-07-16 08:48:22
3	1000	5	1405/04/29	1	active		2026-07-16 08:48:26
2	1000	3	1405/04/28	1	cancelled		2026-07-16 08:48:25
\.


--
-- Data for Name: security_counter; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.security_counter (id, year, last_number) FROM stdin;
\.


--
-- Data for Name: security_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.security_history (id, security_report_id, user_id, user_name, action, comment, created_at) FROM stdin;
\.


--
-- Data for Name: security_reports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.security_reports (id, user_id, report_date, shift_type, incidents, visitors, vehicles, notes, status, supervisor_id, supervisor_comment, supervisor_date, manager_id, manager_comment, manager_date, created_at, report_number, department_id) FROM stdin;
\.


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.settings (id, key, value, updated_at) FROM stdin;
1	camera_config	{"ip":"172.20.2.26","port":80,"username":"admin","password":"@Aa3603912!","channel":1,"rtsp_port":554}	2026-07-16 08:47:30
\.


--
-- Data for Name: shift_change_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.shift_change_requests (id, user_id, current_shift_id, requested_shift_id, requested_date, reason, status, reviewed_by, reviewed_at, review_comment, created_at) FROM stdin;
\.


--
-- Data for Name: signature_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.signature_logs (id, user_id, signature_id, module_name, record_id, action, ip_address, created_at) FROM stdin;
\.


--
-- Data for Name: signatures; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.signatures (id, user_id, image_data, created_at) FROM stdin;
\.


--
-- Data for Name: sms_codes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sms_codes (id, phone, code, expires_at, used, created_at) FROM stdin;
2	09141234567	426671	2026-07-25T05:40:10.023Z	1	2026-07-25 09:07:10
\.


--
-- Data for Name: ticket_responses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ticket_responses (id, ticket_id, user_id, message, is_internal, created_at) FROM stdin;
\.


--
-- Data for Name: tickets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tickets (id, user_id, title, description, category, priority, status, assigned_to, department_id, created_at, updated_at, closed_at) FROM stdin;
\.


--
-- Data for Name: user_shift_assignments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_shift_assignments (id, user_id, shift_id, is_active, created_at) FROM stdin;
1	1000	1	1	2026-07-11 14:24:05
2	1003	1	1	2026-07-15 14:15:44
3	6000885	1	1	2026-07-15 15:28:05
4	6011540	1	1	2026-07-15 15:28:05
5	6012950	1	1	2026-07-15 15:28:05
6	6034682	1	1	2026-07-15 15:28:05
7	6034684	1	1	2026-07-15 15:28:05
8	6035008	1	1	2026-07-15 15:28:05
9	6036420	1	1	2026-07-15 15:28:05
10	6036421	1	1	2026-07-15 15:28:05
11	6036422	1	1	2026-07-15 15:28:05
12	6036521	1	1	2026-07-15 15:28:05
13	6036696	1	1	2026-07-15 15:28:05
14	6036805	1	1	2026-07-15 15:28:05
15	6037857	1	1	2026-07-15 15:28:05
16	6038124	1	1	2026-07-15 15:28:05
17	6038141	1	1	2026-07-15 15:28:05
18	6038466	1	1	2026-07-15 15:28:05
19	6040602	1	1	2026-07-15 15:28:05
21	6040990	1	1	2026-07-15 15:28:05
22	6042593	1	1	2026-07-15 15:28:05
23	6043146	1	1	2026-07-15 15:28:05
24	6043148	1	1	2026-07-15 15:28:05
25	6043151	1	1	2026-07-15 15:28:05
26	6044899	1	1	2026-07-15 15:28:05
27	6046435	1	1	2026-07-15 15:28:05
28	6046853	1	1	2026-07-15 15:28:05
29	6046858	1	1	2026-07-15 15:28:05
30	10008	1	1	2026-07-15 15:28:05
31	10014	1	1	2026-07-15 15:28:05
32	10022	1	1	2026-07-15 15:28:05
33	10023	1	1	2026-07-15 15:28:05
34	10028	1	1	2026-07-15 15:28:05
35	10030	1	1	2026-07-15 15:28:05
36	10036	1	1	2026-07-15 15:28:05
37	6040062	1	1	2026-07-15 15:28:05
38	6001552	1	1	2026-07-15 15:28:05
39	6010184	1	1	2026-07-15 15:28:05
40	6029092	1	1	2026-07-15 15:28:05
41	6030513	1	1	2026-07-15 15:28:05
42	6032032	1	1	2026-07-15 15:28:05
43	6032455	1	1	2026-07-15 15:28:05
45	6034789	1	1	2026-07-15 15:28:05
46	6035009	1	1	2026-07-15 15:28:05
47	6035010	1	1	2026-07-15 15:28:05
48	6035363	1	1	2026-07-15 15:28:05
49	6036520	1	1	2026-07-15 15:28:05
50	6036522	1	1	2026-07-15 15:28:05
51	6036523	1	1	2026-07-15 15:28:05
52	6036806	1	1	2026-07-15 15:28:05
53	6037048	1	1	2026-07-15 15:28:05
54	6037595	1	1	2026-07-15 15:28:05
55	6037859	1	1	2026-07-15 15:28:05
56	6038095	1	1	2026-07-15 15:28:05
57	6038140	1	1	2026-07-15 15:28:05
58	6038412	1	1	2026-07-15 15:28:05
59	6038455	1	1	2026-07-15 15:28:05
60	6038464	1	1	2026-07-15 15:28:05
61	6038465	1	1	2026-07-15 15:28:05
62	6038544	1	1	2026-07-15 15:28:05
63	6038818	1	1	2026-07-15 15:28:05
64	6038869	1	1	2026-07-15 15:28:05
65	6040063	1	1	2026-07-15 15:28:05
66	6040373	1	1	2026-07-15 15:28:05
67	6040377	1	1	2026-07-15 15:28:05
68	6040601	1	1	2026-07-15 15:28:05
69	6040603	1	1	2026-07-15 15:28:05
70	6040989	1	1	2026-07-15 15:28:05
71	6041131	1	1	2026-07-15 15:28:05
72	6041132	1	1	2026-07-15 15:28:05
73	6041133	1	1	2026-07-15 15:28:05
74	6041134	1	1	2026-07-15 15:28:05
75	6041534	1	1	2026-07-15 15:28:05
76	6041535	1	1	2026-07-15 15:28:05
77	6042039	1	1	2026-07-15 15:28:05
78	6042040	1	1	2026-07-15 15:28:05
79	6042041	1	1	2026-07-15 15:28:05
80	6042045	1	1	2026-07-15 15:28:05
81	6042310	1	1	2026-07-15 15:28:05
82	6042592	1	1	2026-07-15 15:28:05
83	6042594	1	1	2026-07-15 15:28:05
84	6042959	1	1	2026-07-15 15:28:05
85	6042958	1	1	2026-07-15 15:28:05
86	6042960	1	1	2026-07-15 15:28:05
87	6042961	1	1	2026-07-15 15:28:05
88	6042962	1	1	2026-07-15 15:28:05
89	6042963	1	1	2026-07-15 15:28:05
90	6043122	1	1	2026-07-15 15:28:05
91	6043147	1	1	2026-07-15 15:28:05
92	6043149	1	1	2026-07-15 15:28:05
93	6043371	1	1	2026-07-15 15:28:05
94	6043372	1	1	2026-07-15 15:28:05
95	6043767	1	1	2026-07-15 15:28:05
96	6043768	1	1	2026-07-15 15:28:05
97	6043769	1	1	2026-07-15 15:28:05
98	6043770	1	1	2026-07-15 15:28:05
99	6043771	1	1	2026-07-15 15:28:05
100	6043772	1	1	2026-07-15 15:28:05
101	6043773	1	1	2026-07-15 15:28:05
102	6043774	1	1	2026-07-15 15:28:05
103	6044187	1	1	2026-07-15 15:28:05
104	6044188	1	1	2026-07-15 15:28:05
105	6044189	1	1	2026-07-15 15:28:05
106	6044191	1	1	2026-07-15 15:28:05
107	6044193	1	1	2026-07-15 15:28:05
108	6044194	1	1	2026-07-15 15:28:05
109	6044196	1	1	2026-07-15 15:28:05
110	6044197	1	1	2026-07-15 15:28:05
111	6044307	1	1	2026-07-15 15:28:05
112	6044308	1	1	2026-07-15 15:28:05
113	6044310	1	1	2026-07-15 15:28:05
114	6044570	1	1	2026-07-15 15:28:05
115	6044571	1	1	2026-07-15 15:28:05
116	6044572	1	1	2026-07-15 15:28:05
117	6044573	1	1	2026-07-15 15:28:05
118	6044574	1	1	2026-07-15 15:28:05
119	6044575	1	1	2026-07-15 15:28:05
120	6044577	1	1	2026-07-15 15:28:05
20	6040604	1	0	2026-07-15 15:28:05
121	6044580	1	1	2026-07-15 15:28:05
122	6044581	1	1	2026-07-15 15:28:05
123	6044582	1	1	2026-07-15 15:28:05
124	6044583	1	1	2026-07-15 15:28:05
125	6044619	1	1	2026-07-15 15:28:05
126	6044623	1	1	2026-07-15 15:28:05
127	6044900	1	1	2026-07-15 15:28:05
128	6044901	1	1	2026-07-15 15:28:05
129	6044902	1	1	2026-07-15 15:28:05
130	6044928	1	1	2026-07-15 15:28:05
131	6044929	1	1	2026-07-15 15:28:05
132	6044930	1	1	2026-07-15 15:28:05
133	6044931	1	1	2026-07-15 15:28:05
134	6045199	1	1	2026-07-15 15:28:05
135	6045200	1	1	2026-07-15 15:28:05
136	6045232	1	1	2026-07-15 15:28:05
137	6045233	1	1	2026-07-15 15:28:05
138	6045250	1	1	2026-07-15 15:28:05
139	6045251	1	1	2026-07-15 15:28:05
140	6045540	1	1	2026-07-15 15:28:05
141	6045541	1	1	2026-07-15 15:28:05
142	6045542	1	1	2026-07-15 15:28:06
143	6045545	1	1	2026-07-15 15:28:06
144	6045546	1	1	2026-07-15 15:28:06
145	6045560	1	1	2026-07-15 15:28:06
146	6045562	1	1	2026-07-15 15:28:06
147	6045563	1	1	2026-07-15 15:28:06
148	6045648	1	1	2026-07-15 15:28:06
149	6045649	1	1	2026-07-15 15:28:06
150	6045650	1	1	2026-07-15 15:28:06
151	6045651	1	1	2026-07-15 15:28:06
152	6045652	1	1	2026-07-15 15:28:06
153	6045822	1	1	2026-07-15 15:28:06
154	6045830	1	1	2026-07-15 15:28:06
155	6045845	1	1	2026-07-15 15:28:06
156	6045846	1	1	2026-07-15 15:28:06
157	6045848	1	1	2026-07-15 15:28:06
158	6045849	1	1	2026-07-15 15:28:06
159	6045850	1	1	2026-07-15 15:28:06
160	6045851	1	1	2026-07-15 15:28:06
161	6045861	1	1	2026-07-15 15:28:06
162	6045862	1	1	2026-07-15 15:28:06
163	6045863	1	1	2026-07-15 15:28:06
164	6045865	1	1	2026-07-15 15:28:06
165	6046098	1	1	2026-07-15 15:28:06
166	6046099	1	1	2026-07-15 15:28:06
167	6046100	1	1	2026-07-15 15:28:06
168	6046101	1	1	2026-07-15 15:28:06
169	6046104	1	1	2026-07-15 15:28:06
170	6046105	1	1	2026-07-15 15:28:06
171	6046107	1	1	2026-07-15 15:28:06
172	6046124	1	1	2026-07-15 15:28:06
173	6046126	1	1	2026-07-15 15:28:06
174	6046127	1	1	2026-07-15 15:28:06
175	6046128	1	1	2026-07-15 15:28:06
176	6046139	1	1	2026-07-15 15:28:06
177	6046140	1	1	2026-07-15 15:28:06
178	6046141	1	1	2026-07-15 15:28:06
179	6046143	1	1	2026-07-15 15:28:06
180	6046144	1	1	2026-07-15 15:28:06
181	6046431	1	1	2026-07-15 15:28:06
182	6046436	1	1	2026-07-15 15:28:06
183	6046437	1	1	2026-07-15 15:28:06
184	6046438	1	1	2026-07-15 15:28:06
185	6046439	1	1	2026-07-15 15:28:06
186	6046440	1	1	2026-07-15 15:28:06
187	6046450	1	1	2026-07-15 15:28:06
188	6046453	1	1	2026-07-15 15:28:06
189	6046672	1	1	2026-07-15 15:28:06
190	6046673	1	1	2026-07-15 15:28:06
191	6046712	1	1	2026-07-15 15:28:06
192	6046713	1	1	2026-07-15 15:28:06
193	6046714	1	1	2026-07-15 15:28:06
194	6046715	1	1	2026-07-15 15:28:06
195	6046716	1	1	2026-07-15 15:28:06
196	6046885	1	1	2026-07-15 15:28:06
197	6046886	1	1	2026-07-15 15:28:06
198	6046887	1	1	2026-07-15 15:28:06
199	6047001	1	1	2026-07-15 15:28:06
200	10001	1	1	2026-07-15 15:28:06
201	10002	1	1	2026-07-15 15:28:06
202	10003	1	1	2026-07-15 15:28:06
203	10004	1	1	2026-07-15 15:28:06
204	10005	1	1	2026-07-15 15:28:06
205	10006	1	1	2026-07-15 15:28:06
206	10007	1	1	2026-07-15 15:28:06
207	10009	1	1	2026-07-15 15:28:06
208	10010	1	1	2026-07-15 15:28:06
209	10011	1	1	2026-07-15 15:28:06
210	10012	1	1	2026-07-15 15:28:06
211	10013	1	1	2026-07-15 15:28:06
212	10015	1	1	2026-07-15 15:28:06
213	10016	1	1	2026-07-15 15:28:06
214	10017	1	1	2026-07-15 15:28:06
215	10018	1	1	2026-07-15 15:28:06
216	10019	1	1	2026-07-15 15:28:06
217	10020	1	1	2026-07-15 15:28:06
218	10021	1	1	2026-07-15 15:28:06
219	10024	1	1	2026-07-15 15:28:06
220	10029	1	1	2026-07-15 15:28:06
221	10031	1	1	2026-07-15 15:28:06
222	10032	1	1	2026-07-15 15:28:06
223	10033	1	1	2026-07-15 15:28:06
224	10034	1	1	2026-07-15 15:28:06
225	10035	1	1	2026-07-15 15:28:06
226	10037	1	1	2026-07-15 15:28:06
227	10038	1	1	2026-07-15 15:28:06
228	10039	1	1	2026-07-15 15:28:06
229	10040	1	1	2026-07-15 15:28:06
230	10041	1	1	2026-07-15 15:28:06
231	10042	1	1	2026-07-15 15:28:06
232	10043	1	1	2026-07-15 15:28:06
233	10044	1	1	2026-07-15 15:28:06
234	10045	1	1	2026-07-15 15:28:06
235	10046	1	1	2026-07-15 15:28:06
236	10047	1	1	2026-07-15 15:28:06
237	10048	1	1	2026-07-15 15:28:06
238	10049	1	1	2026-07-15 15:28:06
239	10050	1	1	2026-07-15 15:28:06
240	10051	1	1	2026-07-15 15:28:06
241	10052	1	1	2026-07-15 15:28:06
242	10053	1	1	2026-07-15 15:28:06
243	10054	1	1	2026-07-15 15:28:06
44	6034787	1	0	2026-07-15 15:28:05
244	6034787	1	1	2026-07-15 16:37:14
245	6040604	3	0	2026-07-16 08:49:35
246	6040604	1	1	2026-07-18 08:01:48
247	6047002	1	1	2026-07-25 09:11:32
248	6002734	1	1	2026-07-26 10:24:47
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, password, full_name, role, department_id, work_type, is_active, must_change_password, created_at, username, phone, email, last_login) FROM stdin;
1000	$2a$10$2sIcrhS2eV37fXIB1..wduOcq3V2jnB0vIBHFQ7JFX2BL88jIH0t6	مدیر سیستم	admin	1	normal	1	0	2026-07-11 14:24:05	\N	\N	\N	\N
1003	$2a$10$ZWZwnANmJFjQnJ.5jSe0DuN/iasw9E6xlpEkXMqSG5NFSyKPb6Z06	m	user	\N	normal	1	0	2026-07-15 13:31:39	\N	\N	\N	\N
6000885	$2a$10$CHSJRH7MgtJP1EVAbT7WzOS8vYjTKd.vDkOL3ld.y9.gWk9Bxb0YG	سرپرست حسین زارعی	supervisor	2	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6011540	$2a$10$56BWkgbcDTc2Bt/K6Qs66.C1zgXEKZi272vNtgOW35/XF0/3AHwNa	شهرام پاشاپور	supervisor	3	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6012950	$2a$10$BBL5SzOizFcXNTKnFJrjYeNrHAV6DuIO2ad5H2u2Xvfry9d0PWZJW	امیرملکی ینگجه	supervisor	4	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6034684	$2a$10$RVpEvrddsX675XoT8rC34eG3k.Vi5BJ5ZQEgRhvYK7htbZYryqwYG	فرشید خبیری	supervisor	6	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6035008	$2a$10$QDVGojvf42kKZU/AM57sd.GvbE92GgyTq3vlqyk9v6jyGo3SlAbqq	ایوب رسولی	supervisor	7	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6036420	$2a$10$0ic7AKJfCoLSdAyrTo8Jtef.tVCZwrZkt0zdB6BVnvV9onZgxckUK	سرپرست یاسرتیمور پور	supervisor	8	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6036421	$2a$10$gVDUV1Lx5OlulvZR0hGDEuRX9Ub.ph0AGihh/cXZWshHiV7sSXcoi	سهراب احمدی	supervisor	9	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6036422	$2a$10$NWQALmyoCuUb5lbqpL1Ezepf3EUaLn4Ysp5b6wmk4psH1oEXCnS/2	سرپرست رضا شکر زاده	supervisor	10	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6036521	$2a$10$xJifHIcz.ubwkiAtygl6oOaBZx1tMIgGZTbsg1kyEjn8zS/Kmhqaa	بهمن سلمان پور	supervisor	11	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6036696	$2a$10$ZuAoo.FbGlseUDbNoyJYoO3k//ggI38CHum2KGMAzVVZrt1Uwj5NC	سمیه تاتاری	supervisor	12	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6036805	$2a$10$xfMB1tGcg412OqlQTDM2aOVoTtlR7pX0Rj16AAne1cJ1YkZO6sava	ساراخمسه نژاد	supervisor	13	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6037857	$2a$10$Qt3VxIoDe/2B4fOmZIQuyuVCuiC.6DLQNSyYa4n40.zkwzuOnpBc2	احسان حسین زاده	supervisor	14	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6038124	$2a$10$tblRv7xOFICddN8Qluk8Ce1j41cLWLa5uWu8hM9HdhmAmQEwJ20NO	مسرور معروفی	supervisor	15	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6038466	$2a$10$2E7uD8gozn2xgNMhshUE.OTrmbMKIo44M6FxJUHjBLD8q7xgONGzG	نورالدین علیزاده	supervisor	17	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6040602	$2a$10$ZcGE/YKgiF4.C9Hk9dnRHuiD05doCt4i9Zl8W82jC4944oKNR2gZW	پیمان بختیاری	supervisor	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6040990	$2a$10$MlOi8dz2tZuJ3DIiXpF33egnX2pSE0I7ebo2Ic0mxN7kDDs7o54q2	بهنودشیخی	supervisor	20	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6042593	$2a$10$fmj0.Ym4H81YvXyCdXOlCOqapUT/DC0286Hq2kvKSGBAByIroX4.m	سجاد کریم خانی	supervisor	21	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6043146	$2a$10$JREmI.GOIhBNfMQzJ4qR7.Ro9wrvkXZgx/Odz7HDnR884dcvJb.Xi	ابراهیم مردانی	supervisor	22	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6043148	$2a$10$m6PSyrkECd8xelOiWhMd8.jxi/L5h2P8KFNV7aSX.BZrX4z6hLweG	توحید شریفی	supervisor	23	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6043151	$2a$10$WhJa9sM59aSYJ/nD5rM/bOT9LoosRgqEJL04P5.W0Tvrds4ujmZL6	یاور یوسفی	supervisor	24	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044899	$2a$10$MVwBnM0qx0K4aSrvR81Fsu5N.SGDDYeQ5pf.27SJqllitpBvG/qMi	ناهید شهاب	supervisor	25	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046435	$2a$10$iyaBv1I4HgUXGuu2VQPJUuH2w4iWT8h8qeJzKzcx/Awkd0vNN.cXG	علیرضا کریم خانی	supervisor	26	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046853	$2a$10$WcJCQYMK/hNoUgaQmH0EyeYOzgi.G1CVwu6tajogA7rQKJY15M8.i	فروردین وفاجو	supervisor	27	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046858	$2a$10$oCmOIxMh.rNaZJblGYOGeOgwFrKgJwKjKhAYFy7kdrIP0evtj8xzW	هادی عبدالله زاد	supervisor	7	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10008	$2a$10$/zlHJDTx6kGDAAnMB8EYqu8EOClF6ce7i3bE/NCrhOfa3jgA7dKlS	عبدیل عزیزی	supervisor	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10014	$2a$10$Eau/XovtxEikHQWrUmMeA.W.kuJBSqsHvIkGILYb.vaM9wXOSZJpe	حاج علیوند	supervisor	8	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10022	$2a$10$DGWp62LgwYM9e/9T60sl/OzaEwBFFszU7OWhzfOfW45Yq.ImwSJmW	امیر ملکی ترمکچی	supervisor	28	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10023	$2a$10$zCtlkWLTE8lWddnvPFJQ..EleIDBNEcr53Bn.OtTqoOxjje/rgRgO	رسول شیخلر	supervisor	29	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10028	$2a$10$aZyPFJddu4Q1nubMnDort.cndh1l0t9JoTfPJERP.EKCsqD0Pd4xm	سعید سلیمانی	supervisor	30	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10030	$2a$10$Yk4eldkcZDH2UEjC1J5G5uE8V2L7ZTCeyixN5krWxJ2W9zExHEZX2	محمد عباس زاده	supervisor	31	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10036	$2a$10$S190JRK.IGYkJS2LR4D4t.V40r/3c4L3MwaZvUP5GdZ7ABEsLOiSm	حسین ذاکری	supervisor	32	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6001552	$2a$10$ndpANSHKSB1gTpfXf7wNDO6ohmHQ.OdBbd69yM0AbzlQuzVTntGK.	علی خداداد	user	19	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6010184	$2a$10$wZ2o83AlUIC3oCMuDvmjhOU6Wo5kBWSdHtVxGx772n54sFCWI0Giq	مهدی سلمانی	user	31	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6029092	$2a$10$nrL/k9ZptwScNBXylhw7yeafyYcOijqyu2lOxJKESVulROvdgxgAK	آیدین مهتاب خواه	user	4	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6030513	$2a$10$EX1Deyt2MUlRU4gqXAJqDexwmKWjD5RHR6/rPTZzch.3lQV9so6kW	مجتبی پاویر	user	16	shift	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6032032	$2a$10$5g84RbFGX/EBwP6mOp3Q5uSPOBzSlpmim/DS4PLZ0RHogUKzwS0Ey	حامد یاقوتی	user	16	shift	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6032455	$2a$10$CwPsAQSDol0iPJ063ynwFOYS0DmW40QmggaDiETTuBz42r.u827Ju	لیلا آقاعلیزاده	user	20	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6034789	$2a$10$KlOqgnu5ih3odHAh9BoOkuVF7DKs9RXkDH3iSAIJpLv.r.uisoO0K	مهدی چمنی	user	33	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6035009	$2a$10$vabEdA.xyyqdGXX5HCYeie/NRIbDH/eqXJY.6s4U.2dPmQqX4Jbre	آرش عزیزی	user	16	shift	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6034682	$2a$10$cTYzxj8S8b0ldDUpLRlmCuVBqaX6eAn9EhLUeGSlRkBBYMdDISfIK	کوثر ماهر	supervisor	5	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6040604	$2a$10$D63MFK4oY6ynQNTW6u4uBe4Owf0SUgTvnIXv34CmiskxiiqDEKETq	حافظ جباری	supervisor	19	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6038141	$2a$10$D0en4YIeQwBTb.ws1INSkOq5OH0QFAYBqvrUvNPn8PiRwJOAaoCai	حسین فرجی	supervisor	16	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6035010	$2a$10$PAAH7WeSH777t1rJbYQGo.U6H19akN5tEqjMj7voWvn6EQV0ZR/he	میلاد قزلباش	user	16	shift	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6035363	$2a$10$4S6hTI6794sszvqZXOZ8ruHWVskJ5UVlyElJ09Hufw8L/LazHiHp2	زین العابدین صادقی	user	16	shift	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6036520	$2a$10$1QY3.GCXBDjN9EDnON37b.u.CSyfD.bongAeTogmmsAJVm92Er7Qy	کاوان ملکی	user	31	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6036522	$2a$10$CUdsa3ktaUvPpjYSmz/pueDPgi70QMhnO15IY3Esx9699rjtuf3gK	ساسان حسن خانی	user	34	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6036523	$2a$10$bJwVFSvRslxjtyy/xWCyqeBWRdUtGr0HMBkJ.npemYHDY4kz/8i/W	علیرضا یلمس	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6036806	$2a$10$tlzza5X7f3BzCq/zSevSGe6ZPkcrgRXVDSV37NXQ644xqApcYONl6	محمد جعفری	user	16	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6037048	$2a$10$2bFyd0ZCE5wrVMIgodloCON7Ls6FzhPVo1SH7fQjNSHZOLrJCYOqq	ابراهیم حاتم پور	user	3	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6037595	$2a$10$6oy47KOjQOK7L6z0YUfuNOnfP2dMPE0QEOotNyWEoQ21V.XPkSAR.	پیمان عبدیلی	user	11	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6037859	$2a$10$TvbX4y/Jm3U3hFzpg/yxGORilHs.ynqNsIEr8muPy4r.Z3VyVhkeC	زین العابدین حسنی	user	6	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6038095	$2a$10$6Xu9UL0HLnAmjOOsDK6paeEUb2r68zFjZJaKt0fAyEMCzipZC/XC2	امین علیزاده	user	11	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6038140	$2a$10$zsxyq1z41B1E/9lm7pBJ.uWPNOrEk66d2Xkqrk1lT8A95d/JscPDm	مجتبی تاری ویردی	user	3	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6038412	$2a$10$HQSkIBOmTxDX2RvIeFq4/eFm7mZgZvgiEfackczZyE3LHhpwZnH9y	مهدی غلامی	user	16	shift	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6038455	$2a$10$ApYBjXzD4NoNEAKuPQLu5OWEGx2zYiEQfLA63CJ9XCGsIs9Iu06Z.	محسن حسینلوی	user	32	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6038464	$2a$10$cCETZZLm2u6GBYfjvDfi3ufOGOesxehhCN.QogtQvTPkqSf.sXqxO	فرشاد علی پور	user	32	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6038465	$2a$10$pvTz33omHb4wsypYxvzCjOABDOMf6OJDMbYmg8tg4YORNlXHr75tu	حسین غلامی	user	8	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6038544	$2a$10$LQvzHFP3aQUD9XSWR2ID1e4VrNsd8sXiU/HKhFiOSq0LJlSTi.KA.	سعید علی زاده	user	3	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6038818	$2a$10$Ykl88GH7Lr/fUiru/2MbLOy5YTOYJFNA4KVNyEQLi/Lg6tJko7og.	وحید نجفی خضرلو	user	4	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6038869	$2a$10$Z.0y5zXIXbPIc4QelI0Lr.hr/0C8bZN76MjTQAtTS130Spx1GyYkS	پویا فلاح	user	14	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6040063	$2a$10$3tDcXKo02YzTkWBxu/CR1OIgo6Z1/ebPxZh/qnfMQDtUhBjon1TNC	امیرحسین همتی	user	14	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6040373	$2a$10$RJdzVJ7aN4gl6bBMwoAO4OUxiPMSZP4No6cxrs9h3x68EY4X31HtO	حیدرعلی نوری	user	11	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6040377	$2a$10$57/oZDH5rKitjWjFCbJkLu4BK2iKKiQ0OGe3hd0HoXt3Km0xcXg52	علی علیزاده حصاری	user	8	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6040601	$2a$10$FtpDWEdbrqSXw6leuz6Ur.jKoJUKQW.ST5aJ6ppi7Xl5FQT9B.cFO	توحید شهاب کردلر	user	35	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6040603	$2a$10$S9TPrQ/h9sau.DswnIGKO.hT3V50s.C61JLwA8xFyHBNchpSB1QOK	اصغر نیک زاد	user	3	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6040989	$2a$10$C6n35Y0ec2oCMoJ/rh66aOq2vfycVpbiSCiCDZ2FNjQxhGEPVVfs6	امیرحسین آقازاده	user	16	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6041131	$2a$10$qLVA6PwiQv6O9J/dZLHiyuZLwEKE7UukcYBWv9fl3hPQCj4APT0Na	اصغر اژدر زاده	user	3	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6041132	$2a$10$nGkcXQYpp1gsEzKSdQTJJ.YI4wFMJS4bwH8M2Oq0zIPU/26CBFpn.	احمدپاشاپور	user	14	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6041133	$2a$10$XiooKjU8I83P1HCF/C7Oxeot8b.ZeTjS1Jr1gOxFDbY9pesHb2wdW	عبدالرضا وکیلی	user	16	shift	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6041134	$2a$10$zMcVX/vfCUfY373KEplIheihyqNfs6vgvkhKX3DKcqTxIv07rG2ym	محمد قنبری	user	16	shift	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6041534	$2a$10$pxWrTZNF/fRhMfUVBzRPBu1yYXVoFVfMDE8pbX6ffPrwN1S8VmJv.	میثم امانی	user	16	shift	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6041535	$2a$10$w6Nsxd2AeaX/OpvC.NwQs.WOvFTctkNGvwWJI3MX89tlfvUM.y1wu	طوفان یعقوب زاده	user	16	shift	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6042039	$2a$10$4ZnbY2KB49evvK70tX4vjOcVEU/RyX6lXAxtX.TxQ9ZU.Jdb6RkgC	علی قاسمی	user	35	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6042040	$2a$10$MOCOTvc2QJpPxq/CMV509e9dfvlNe7aht4LnQwaJFXkRER3k01HPO	سعید میرزازاده	user	4	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6042041	$2a$10$AbT1lJjLTdzD1Cv8Gr5PteYjl.f2HTMRU3p00vggSfL8FiO24QlNi	سید محمد حسینی	user	31	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6042045	$2a$10$AnY08GzTsF0D7Jy04Dn2wuus4GR61RMrnA/tQ/6ZaWS3LSVoekl/.	سعید پور جعفری	user	31	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6042310	$2a$10$zX6htj.ZbyOLOAlGfg79beYOEEoey097XxrBZ9InIzmnxjzDoc4va	سجاد قهرمانی	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6042592	$2a$10$KoILLBsNn.wCKEIWlL5GA.x9t1Is78uvhC/mQ0jxPOWY0GtXxJs6i	هیدیکا جلالی	user	14	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6042594	$2a$10$GFOjiwDhLP5r9Q93vMW1deRj/6T3Ej9/nmK8QGxJ4dAfzAfDDYNxK	جلیل قهرمانزاد آبگرمی	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6042959	$2a$10$gSg.OrjK9bGUFfeZSTNq5.NXidJmNmEinsOBffL30pNYs8GkWMG7q	محمد باقری	user	6	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6042958	$2a$10$UVbAfaXb5FDiINWfGzBf0e.0AzzYoMeFIorZnpwe7FhFaa.Rl.Ige	سهند شکاری	user	32	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6042960	$2a$10$2H6jO51DJZp8TuVaSZUHE.3RXKKwP98dUzhnrHqmOXB5mXd3EF9tK	یحیی امان پور	user	32	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6042961	$2a$10$h/vnjrUoAX.ejeKwK8kS9eD8vUSQ3xiSOD.UWGwcNiZ2wXPDupRuy	فردین حسن زاده	user	32	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6042962	$2a$10$4iunvRZrooekgtKR4fTmNe/O1U8O6hxyny5fAY4GRGLDSN1cv.loy	میلاد جعفری	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6042963	$2a$10$EG9Xes5fDpInRHbb8TY22uApXDZSdqZTfV7F2p/cydVNID4uOmIiW	اصغر شاهسونی	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6043122	$2a$10$5G1GLi.HP3NJv2WW0zQi/.UkBWKnvVte9Z1mGveQUT/rNzskEVBOO	عاطفه رضائی	user	5	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6043147	$2a$10$gdZXPv1SC1cR5wfFR1WOGO8/QbaOlWSpVuzBSo35ykS7PJ0sGDxHa	یعقوب علی اشرفی	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6043149	$2a$10$Q1JpKwl0zSX54pEO6vR0bOwWbAIgoXgSgSNYRb7YocXbR5bnDKwyS	علی حسن زاده	user	31	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6043371	$2a$10$F99krA3JZOc6bGL9J8kIAePIqOV042/Vq7o5HLgxkTpLaTEERL6q2	غلامرضا رحیمی	user	16	shift	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6043372	$2a$10$abU.YTioe4nJXjk/SJR/EOWkS20z1pmFhmSC7GSU0rIeHgCe3Xssa	حمیدرضا پاک نیت	user	19	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6043767	$2a$10$tovOe1FQ/W6ZrHQP2xJ.ue9lc4I4YXIHFmIuqyjOClvLEb9a4PPtK	هادی احمدالی	user	14	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6043768	$2a$10$y5/aAkRaRzcBLTF1ADHoqu5kZ9A.hFw1EZ7MZhehn8zsGSVXLNwLG	اکبر ابراهیمی	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6043769	$2a$10$Fecg3SwtAKLQrmtCovsOMeh27jft3pFs/1IxdsKYn8ViPB2mNrFoi	سجاد قاضی وکیلی	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6043770	$2a$10$7GLzMah5dW37YXoXp/o/OuMDE97z1AsPVPuHqyvLG6cAp1v3TVXoq	علیرضا یاوری	user	23	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6043771	$2a$10$c3R1c0xwtU9TnB4R9h3/zuV5N3aewAhQxj.MF5pt4ifL.rZrPNow.	سیروس ایلخانی	user	32	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6043772	$2a$10$t/XBIVAR2LV5sNYZXC91seFYJiIByQgXF5NgdwmOk0lUF/uum5iRO	میلاد قربانی	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6043773	$2a$10$wwUcdmxSNJ93hckMUxaWx.VpU/6PWLiqyO0sHdXeIdw39NNqjaNTi	مصطفی شکری	user	16	shift	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6043774	$2a$10$r72.98sVYWfekyDSTYmXEu4.HT0O.u4tWT6yzvJKMF35XpGbHD5M.	اصغر اکبرزاده	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044187	$2a$10$H..Un2cj5/sHdqDTQzV72eM66/fahsFvP8rwMP0ZxoOdsHFWcyNcu	علی علی پور	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044188	$2a$10$L3I8cP9m0CF4laYOz9awEe1MJxqgLoCd1S84Oe7IdcTpUdPhHrcdi	متین مصطفائی	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044189	$2a$10$SCFF5.19YXptremyCAPW/OLjdEHtZr96bCy1qgd8tZWVcA/LjNaJy	حمیدرضا قنبرپور	user	10	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044191	$2a$10$nAnF06N4UrFRx6hXrBpyS.FCqhm6ZTZVne8GuRv7p1YHzx9DXMdUK	آرمان کریمی زاد	user	4	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044193	$2a$10$f3gR9CydF1JDgMQ9Ak64EeClt5FQhYb1XjtY7jY7vNY6zB1M8lo/G	امین علی پور	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044194	$2a$10$Ty5h4eQO5l2TmIuw.K5dWOvnGPGejDtBzqj5afRs.UTxnGs0BHc/G	فرید جاوید	user	11	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044196	$2a$10$xoAWjbD5ZWJNPEaoSXOOr./8NoRZfcjHyY0dCx.GNFvRJa21M.kMe	مهدی عادلی	user	10	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044197	$2a$10$UoX4kn8gKqJLlPLnZEE30OjjGWbDIefFlXXoNoFunjv8RCKBXyJpq	حسن آلبوغبیش	user	35	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044307	$2a$10$cMp3pVsvRAe8hY2pCz1IKOClNBoHtncNJzX8ZHO/ZXE12VOMSPAY.	امیرنجف آبادی	user	4	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044308	$2a$10$s34oDlmZbzdrGn8vFK1C5esI4rUL1oUuDTuAt2jmwY1XC3eVK2H6i	اکبر رحمانی	user	8	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044310	$2a$10$I52dVu.1FXj4qHsYYlHKseDiwklltpaQ1LxiPIxLzQ6PHk7fKRl2C	جعفرسلیمان	user	2	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044570	$2a$10$.6XM8x3injyfjUoDksr2CuCC5MhXilMxBEwiyRZWKkabEg4Rrqs12	ارشد پاشائی	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044571	$2a$10$aPfu3xyn/YOximTQlhqDWOee2OsqiIV/DvZqELpgbZk5R0KEpflSO	علی جمشیدی	user	2	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044572	$2a$10$jozRxcpAy5.eFznoeWDbq.pRLQto/V4nO79Thl7Jo.OItANPHRzLi	حسین قهرمان قهاری	user	8	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044573	$2a$10$bUetaQ82j7VV7W2XvAZFg.EyXaZV7ygsc/GSRSOO.UPmoZrLIbMI.	امین علی اکبرزاده	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044574	$2a$10$bws7voElb8Vw4f3Wcl9Eqe692M8Kdb9UG08TkbVfxk.o7.tWgZeFy	امیرحسین حسنی	user	8	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044575	$2a$10$NMNTWRcv6UIvIuNCQAgI6urOOQMlRypQxmPX8SVr/VdvtK3aDV5oW	مهدادمحمودی	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044577	$2a$10$IgIXTWcxDlH6to28QQtBMu14ek8DaG4V4hB8vuA7NgOwOYKb3QGgq	حمید ساده دل	user	8	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044580	$2a$10$UkdhAx6G0dFbvhCwVl0YseUDHuEKI.8mW2rEPpSxQ/w3.o7D/iYH2	علی محمدپور	user	4	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044581	$2a$10$cfLennk2shiCFFUIQ01pyuU4iXCoEMZfGDnPjTfVqqKmhcRLeCnLC	مصطفی جهانسوز	user	30	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044582	$2a$10$y./PxA2EWUWAb.Ygc/bd.O8UqtY40/DzW/DAPtlSPIWtaIE0Bz/iC	فرهاد نظامی	user	6	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044583	$2a$10$TIbCc385Tk9x6H51I8obpOWaKUBbEKWKIiq/MHbGxzVJ3ZVWPOdeq	حامد مندیل	user	31	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044619	$2a$10$H9UvUzGHi.t1oHsw3B5xdOVcsOmM5on8vReZXp.LpmCw4vYtXF71u	مهدی شیخلو	user	6	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044623	$2a$10$VslElDxu.yxgO2jC7ICKaeHxx1AvCDT0Rw1Tz5vQyPQZbx6dGX636	سید حسن حسن زاده	user	3	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044900	$2a$10$y/uEAzKi0TFfrpPJu9kONu4mp8ifZwh.hecIi.3CQNQJb7k2.SeTG	ماهان هوشیار	user	32	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044901	$2a$10$kLSITrGdtxMaUdQCH7XDTOHG5n471xDnEQTGZijJIKybI/9w58SGG	فرزین حضرتی	user	34	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044902	$2a$10$vG9arCRd/te1sRtZQK1Sj.U5VJPPuEtttN250cR6B3gEub7pm8ou.	محمد بیگ محمدی	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044928	$2a$10$sFz.acrHCrm.BhOz1tlbLuBdisEQc1IINp5bja/J4rFsEgXhdr3Ke	محمدپورسلیمانی	user	14	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044929	$2a$10$nQhIeTeM3f5AJo1MjRNkb.vh/u0M35NxGF5XQdqmNc62bzfpYeLfi	محمد میرزائی خانقاه	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044930	$2a$10$eUkGmT5QJwilEodRhtFSuO453j7TN5h4IqXWQ.EMBMWj2Ir6fbYe.	مهدی الهوردیزاده	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6044931	$2a$10$IGQm41ot6lpU5UqTLaGObeVA59m5VPGonpvwl0E8y/Tlff5ZI6BlG	امیر شیخلو	user	34	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045199	$2a$10$EgDHF0sXIuz1na3ilSoSde9bY6XqWpuOcMRmQvWvtCDcKdPu7MwW2	امین نجاتی	user	4	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045200	$2a$10$y7ld9M0s2Lm7Qy5H42P.COL1PQSXX6H5CPVpNGX/9Gy6ia//Fp8nC	محمد امامی	user	4	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045232	$2a$10$4D2DkwEw3E8THZDjYpuRE.93xPgPz5GHrQ9rxj74rKMrdIR3asM6u	آرین حسن پور	user	32	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045233	$2a$10$HNufHg9OQGJJ/bZEtlmkSuyViTS363OGl2hlkk8pYrC5cOjzBrOOu	رضا عابدی	user	32	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045250	$2a$10$FZnrww.6E0knz67W/ITaMeU1Z4TVjiBnD98X.ZoAOc25kjmSmgbg2	شاهین حسین زاده	user	3	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045251	$2a$10$IeiFm0PFyzfqXnLtn0OQz.YgRR2e4if1aUKVs7wXEsMKjPJlFDuWe	آیت فکری	user	16	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045540	$2a$10$Ih7hiAA2qcf5QkgBumdAEufFo6fAdznUmwPh4PVJ3te4p7.hEz3FC	امین شیری	user	3	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045541	$2a$10$5WNPSSKkBxVG6d8E4LDUC.9vciBufhc60F/AVIkASo8wd.CVTdDFa	کیوان سپهر گنبدی	user	4	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045542	$2a$10$xA3YEWCbwLi2fFo17K35PeNLrZK.Rwtcl0bwmSYiG0gOH8t4hmhUq	علی جعفری خانقاه	user	4	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045545	$2a$10$Tgapb1tlLDPSFG.Sxdtz5OF675zxMskVRMSaQmZM9rakY.y1wH/Ze	محمدامین یعقوب زاده	user	32	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045546	$2a$10$Jx3sSI/Gb9vCGwiAKg6WWuunhcGzyU9mIxTWBOeioVFn.JPnEhQlm	امید همتی	user	8	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045560	$2a$10$VA/5q3Fky6GMoccna8gxPe2StoTpOyjN4iHtn/UmAcioaur5SmADa	عبدالصمد عثمانی	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045562	$2a$10$FnmD/./CY.kNbYIaWwgkhOPV6yS1MuYc3znSWym1lSaWObPLstLiS	امیرحسین دلیرخصم افکن	user	11	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045563	$2a$10$MWlplbEuABz4p4HYaDHcWOJQA2H66WCeddVDiM6vHdidMFAspMUUK	سعید بکری	user	2	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045648	$2a$10$5Jd9iBSP0o9yiHsQ6CddGuexijbNdZJmgzwEY1/wIcdexm/02Iii.	فاطمه خیاطی نژاد	user	13	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045649	$2a$10$//0p.cxkoQ0rdYIBmDYMd.3DiGf0cmVS0QW3EfjxM6tF8uP5p7nSy	اکبر طوسی	user	8	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045650	$2a$10$o3be42rdepAOqydr5N895.nzR05GF7hzCJ82FSA/sYJnNtkC2t1SK	رسول باقری	user	6	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045651	$2a$10$7oCkHoERWEgUWnZOEfp/ke/XY2Lrvcox1p3jQ7NCMtuyc6TVWdtK6	حسین عباسی	user	31	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045652	$2a$10$DJO/BsaoR3kviT4kU0aUsuwQeIhrQFyqBIym3K3S7QYNvTYtWyNCW	حسین اباطی	user	2	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045822	$2a$10$NeZzEy9W9SjTIsM.ZQJC2uy1SW6p5JKQ5JbtvyldTVnmwdmBNpaV6	سمیرا سلیمی	user	25	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045830	$2a$10$niHB7W/Qylo5qCYqsInflOTMut4LlZ/mzRkQuMTJ.Jvs/n1CcE82S	رضا غلامی	user	4	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045845	$2a$10$DNwgIjsqe.iQFUwvgQDbb.1mDJD89BoXYM8EIVIoU5dvvCvZvolCm	عسگر خدائی	user	16	shift	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045846	$2a$10$rtkCvZ6tIVwZb8FBCG.Tle6mCbxSKIbY3kSAyhbdjux6EEo6/pQBu	محمد بکری	user	6	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045848	$2a$10$lDlIX9cI3OF6XgHY5jvkAejYwHsK/UMQtjI.Y6qcD7ZzNqNPRouL6	حسن رحیمی	user	2	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045849	$2a$10$UL0E3EAXal2u.sZH7cWBMOii9UCjbf2xqFmxO8LgRs2pTiRK2RqWm	ابراهیم خالدی	user	16	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045850	$2a$10$MFMDVKAIuxr26u6pXDrXIeTMhS1BWLSUqOGkh.VyFVi3aqgK/DjAW	عبدالرزاق جلالتی علیه	user	16	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045851	$2a$10$fqcYg332J/0slGPLrkIDf.5rfcXUW.FZEMb/Fp/heLOm050y51fF2	مالک رمضانی	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045861	$2a$10$4qsJHTWlX3RvMrBrcznPVu72xCj4hE31dwHCZO7lr2QE179dLX6kO	ابراهیم تقوی	user	30	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045862	$2a$10$gOp6TlLHUIkcF1rsP5s8J.dagruAXW9Eh/RVShUD8vidchpRmOhm.	فرنوش قلیزاده	user	16	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045863	$2a$10$ZklO.mhGAL19ix75BFFRkeT30sZGANsVPM87TaJer/E4qMPEmxx42	محمدجمالی	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6045865	$2a$10$86KOaq2uO36r2M.bqEFVWea6l1NyT1G8xOZIdh4KUkqs.bNA3Moqy	فرزاد صیادی	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046098	$2a$10$ERbUj.ed5kS2ctYkMk.T..4bl1.ebbD2UI2cigJO0SLckwcNocYuW	علی قهارآده	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046099	$2a$10$HrXzc8HVyDr1I5PIgpiAruu5SyseAAvO4ullTvK3cvJNuXZk4wNiW	یاسین جعفرزاده	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046100	$2a$10$.bZ.2JHjkRV1wkJkghrpU.Bru9tP2OGVvzs/ByDoE9bSAYjZV1pYi	جاوید شکوریان	user	31	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046101	$2a$10$QZHDdeR2Yo2DxvelQr.52eutSHnkVIa3ptkT2g3c.WpLkdteJZ9Rm	محمد یعقوب زاده	user	32	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046104	$2a$10$uLf0CyJXpq32fKW1ZP0/8O78XybUwkv.EX87eJ84lhzLWG1AVpxje	میلاد جعفرپور	user	16	shift	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046105	$2a$10$gAKQcZCE8Mf8e1/XeGqW4uv2CmARY9y.D4M8sJGdC.nIqzWldEziq	نوید هوشیار	user	30	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046107	$2a$10$xN1UDbuzH9il9V9ZCHU/fO0bX6S5JnoLdBtSjOWXlhRnPlB36M.xu	توحید کریمی	user	30	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046124	$2a$10$q5eseqr1JUbcn6D8XWUPjO.OayE8GYAAxxKgmQL4sltO.fWNVryky	امین عبدیلی	user	4	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046126	$2a$10$R7jAb/Py7943Loewej0.UOKFpKn8TCMczkyozuIntPORmhkYhK2UC	آریگا مرادیانس	user	16	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046127	$2a$10$lSt3i5JaZsVDZmv2MsnlYe3v1ATWpdALAUo9g8yZ29XyrVPwIvVT2	حسین ترک سرای	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046128	$2a$10$a2Ph/.WwCUfxMDtg.u22o.kvYBF/QKZaWOUH5vf51hZBICRzKbVDi	احسان بیگ محمدی	user	4	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046139	$2a$10$6O6HG4PodF7GYxfxD7s48.Kaox/MgRmdnUWqsoU3G3u3MBWyMowa2	حسن میکائیلی	user	6	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046140	$2a$10$aNAeExqhPFCb3PIU.yucKeUU.aZU839Dio.DlZeDNwd1koAdm4I4e	محمد درخوار	user	4	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046141	$2a$10$KJgOkMYH8ipWLsaRyCACD.JEXyvWRO..eABnPdRw0yf6I93/wG4ma	امین نظام افشار	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046143	$2a$10$2dzQnCX6O3L6JYvf6cLSmuYhvwM0JyBE.Z06MSHTMpLoH1YNWHb4y	حسین کاظم علیلو	user	31	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046144	$2a$10$gqiRgIGCV697lormiHGHtOlB6ri7IYjIuY7eIKV5MbIEHNYGDRUa.	مجید فرجی	user	2	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046431	$2a$10$2z.5Mh0yPh/bNWxrZ0Hrju5pCNfgSqy2Jyue9IW6d809g3Ri6Bo7u	بهرنگ میرزاپور	user	8	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046436	$2a$10$dJFupwFsCVibemEiNh.b7.ZemSka9K62ksj0.bv5nWySVnVyqUlAm	عرشیا یعقوب زاده	user	4	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046437	$2a$10$Hlbokjee6gPS5GWsh7Wwjehct4.EpQCrQtj29e.yWD.6iGrJTQ0xK	احمدرضا عزیزپور	user	31	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046438	$2a$10$hqFvmHkGZ7rrCwmyOBZtiOnrDUAJeA9vA5pxutsXTY/XaS0wzpCym	پویادرخوار	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046439	$2a$10$NDna8xEYJhCoGYjzspCJ9.vR64Nr.5mA5HZRF3/sl2j3nYVTdDkAi	وحید محمدپور	user	8	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046440	$2a$10$XQHk9eEEQWkhN22WucXhMeTWhV/oa0k41q0iUcZJSn5zUWZnAwsJS	صیاد حسین زاده	user	8	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046450	$2a$10$iFjUU/6KHsX4w6ypKEv2yeqXQH/w/8eypSniuEhzZeG6jLlM/eGXe	امیر جمشیدی	user	8	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046453	$2a$10$iUpYy.CM7MkVVItCDo1C6OPEhV/nGropmLcCaKaKL/tbP13BR4gb.	میثم قاسمی	user	31	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046672	$2a$10$fvO.nPVwwhhpAnUrKHvoL.GYtY8MGs8jmSwlNYLBm9xeocFLYfZtO	میثم جعفرزاده	user	3	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046673	$2a$10$SYLIaBknmlh6cghSOtBz3eIDggK3KmQ9RlT2GkmGVLnRl4hpS6JZK	رضا دوستی پور	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046712	$2a$10$KJCqbh5BBuutrw5VYAtwC.hCFON8xrGXdNdVCagvCXhZpacCg7s.u	انصار صمدزاده	user	30	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046713	$2a$10$8agjwdNPh/9LfMLOMrpgZutYOwg5rwnqoeKCNYrJ1YaJ7i4sx.H2C	مبین صمدی	user	2	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046714	$2a$10$wFXU9prt0LQ3n1h1YFqg0uyZWF49DdYAaKBo9P0b3pWTwVuqCFkQu	مصطفی میرزائی	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046715	$2a$10$ycj5MLvxRPotwIK7uD3MPe5B3AnFj1WWkGseff6mopgIz2p.0nKkG	احسان ایمانی	user	31	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046716	$2a$10$VbsNYHcvArFIIUk79Dt7deQef3xkuO0.BVMGPeYxJ4Re/T15E09Fq	بهرام خدائی	user	14	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046885	$2a$10$ITHNkTbbBv06mjgF5aY2.Oq3b/3q67eEow5l6RU.9jo5mq1zVvqFe	یوسف ابراهیم زاده	user	3	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046886	$2a$10$3nO269YEQg9CueyuSXl0ue6pSmXzwVCbFAWLoYN2oXk2BY56cRASS	امین صراحتی	user	3	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6046887	$2a$10$pzm9Q6BsqPCEG7lrmXO6BeJlrntqUlqlWOWBe/aN6ZEM7IyesmLp6	حجت شکوری	user	32	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6047001	$2a$10$NR3LXwqW2RILpGWDAcNhfeEA9F4l8BBPRVj6Hbyif.GNhDnY02hV2	حافظ فانی	user	2	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10001	$2a$10$WqRS4DJEr73OPVezYxuei.bE3kixA4BbL8rtsNr8zEQ.gOzBh6h8m	ابوالفضل نقی زاده	user	26	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10002	$2a$10$Z80j1nxOl1/Vcp2rleVAlufBU.x6oktYHP4jIXtTlffzUYHbICGyC	جعفر پاویر	user	26	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10003	$2a$10$dtwRVLyzUNncz8boyDhIuexu4/u5lGyMhgfCKzWtjT7h1m8Q//FjC	حسین سیدگولانی	user	26	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10004	$2a$10$jks.mlWm.0QB0Ub1cc1GneK.PP5fXfymFSbJDpFGUaf9Jfkbs18q6	رامین ورزیده	user	26	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10005	$2a$10$IMeFJ4.rlRwNFUG0i24mAe9auygqz.0.938TtWHyW3U0wLFc9zyti	فرزاد میرزایی	user	26	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10006	$2a$10$ffEOulVxzyTXBpyrQVzfq.fG1MNdYDwPSLgwoz8bSeb1KPER7csO2	محمد اصغری	user	26	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10007	$2a$10$VVffpN5mVjws8306J83rreo2nXu6hpSoJqkeMw35Zx/tJBhQ9RcsO	وحید خاکزاد	user	26	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10009	$2a$10$g21bEwlL03EEbzhnx8CrbOq3S7rCeuZB5SrcoNNjeWjGaWbQbiXVi	سجاد سهراب زاده	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10010	$2a$10$1aBudC0kDDyas.ZJZyPcluorqMNSiweQJac.YE9xTu9tXNDpyIRVe	حسین عبدی	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10011	$2a$10$gGLauB6GlOzB2.QViXgnm.mqD3fpqYWCpq0CTjZcHlWEapX9cXOMO	طالب آمده	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10012	$2a$10$vZFSweTlhXT3.2sl5cehheQbnv1X9ZfzZP0O/gpnlF6oaG82k/nwC	علی نوروزیان	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10013	$2a$10$teAQ.IKNFJK/z0ouzcsEgex1cY8G18Kb9SWCQZHnaUPfgiX/fmf9y	میکائیل قلی پور	user	18	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10015	$2a$10$rf5vwKbS9j1wO4VT30l6gOLVNKtYBJPjn99MkAVGGB784FyWNnak2	احد فرهنگ	user	8	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10016	$2a$10$1WvJpbeEoqch5KlhyzkupeTstePRhwDsbaVbkuGLgqdm24uip8yJS	احمد سکوتی	user	8	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10017	$2a$10$XSGx1/W.AS47LX8q9Ypb9e0VIR.KaGmdnutB7jMR0ay8.oHLnshS6	اصغر پولادی	user	8	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10018	$2a$10$IxFsmAM/Db0ONMFkZB6iJuMQMGQYVAzAMy6PfZIv9sgRPgUoyS7YO	صفدر مظفری	user	8	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10019	$2a$10$4pXB3IrIhvnDin1mr58E5upLgtBDkT/hCFV/y8yL8XmTT4qMqBaBu	علی ابراهیمی	user	8	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10020	$2a$10$zpWg3nzCtf1/WAvg3CrgC.X0Q7V/OS7lyprPP0SGpnXfs3CzccArK	فرهاد پای بست	user	8	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10021	$2a$10$0uvJHzfvfXfwU966LrWuzeCp1Pu.9SuuPiWsmgbatnNRlnAMgUvmq	نوید ولیان وند	user	8	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10024	$2a$10$QyxSFLkTyJbIaN7OYqNPieUFBRLAg5VynvqXy5OYrXIbfnDJGpO12	هاشم پورعبداله	user	29	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10029	$2a$10$hMHnkTkWfOupxS75qyyQlOiAL/nagX5YuDX9jcLPGuMSUZTwUdpP2	وحید امیدی	user	30	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10031	$2a$10$ASZ7mdMGkz.H/w8.CcBP2edUN3jobfl60tPmIqoXxJJHj5RCuO1JO	حامد سیدپور	user	31	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10032	$2a$10$B9NUi1tS3rNwvC0bjPdieOG3H.D0N7I9hg6rReJLWSUciB8Wp86zC	علی حسن زاده	user	31	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10033	$2a$10$6UDSKqAbIQTq.vMSw4flWObGxAuSezGc50wA25TUyiaBhr5kGp/K2	فرهاد خلیل نژاد	user	31	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10034	$2a$10$4iP67eNXnyFxNEi8KlglMOcUqRgiZOWKXzJIy0jDrJOz9A0aLkDMW	قربان بهروز	user	31	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10035	$2a$10$JfjWhb.6MDEL6qx7ePmPJufxZywGQWbNDpJmeJwjqJg6TtsKJoPla	هادی رضایی	user	31	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10037	$2a$10$jlOc7wxIxxtX0J9LHqxYOeUdeN.ALjNV3fQMVilgJDdR16k2r6me6	سجاد حبیب پور	user	32	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10038	$2a$10$.MbtvxEjCa4ZvhC/cwEEduWLsaBOPhEdwgGnWyIm8HnW.IKSHU09e	افشین احمدی	user	32	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10039	$2a$10$0ciuGXokuw4VJY9nue5mF.//z0wSf5qa3pdJ58Sc5dP9IOFuo14YK	امیرز علی مولایی	user	32	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10040	$2a$10$rX/VgXjyWtNHGAxIclWK1.PrJb75i8nFrtNbaSAFV.Z47HKUNitou	آرش محمودیان	user	32	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10041	$2a$10$ClvhQQaVaL.BMwtzH9fW5Or29g156kTxPFJtDLpRYTSWlD3qanTQW	باقر زلیخائی	user	32	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10042	$2a$10$m19dDdeA4Ypa0.njStlsjO0gQk4LpReLXm9oFWHufvKZ6UUnLF5oe	جاوید زاهدی	user	32	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10043	$2a$10$jG8SPprSxdjbcSyQG2W4j.BR6wdn/r/iJ9ay7.dwJo5Kf4/OREPGu	حسن منصوری	user	32	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10044	$2a$10$yRzrfiPWmDtTf5qYvqjHq.00fEHjCX2OsdgB0XC5GIFryfKT.jj4O	سعید امیری	user	32	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10045	$2a$10$vlCdZxjLelA7Pm.wF8DhrOOzWOq1UZYBrHFRl4ISjgVAfxh1CN7CW	سیدعلی موسوی	user	32	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10046	$2a$10$WHyeJiFQNijdATLnMbDwSeeMwT4rdf9JfMqThIxxZ9MFx4tRyyDq2	شاهین عزیزی	user	32	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10047	$2a$10$IV3oLpD8WhT5AmiQK9rJBOCGVrYOFCpBnq8wG81CItfuS6hNgWjIy	علی اکبرزاده	user	32	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10048	$2a$10$u1T7ZLu1LwHQjjzEnP7jUubIQNEVxqjWm8cd0JLWXErr347Ad9UEC	علی بشیری	user	32	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10049	$2a$10$roQTpbmbhyCkMeDFE76dfe84vmIxAL.Opj0D4hZYUTYg6xCDXzb.m	علی رزافشان	user	32	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10050	$2a$10$3dmJ74lFOctY97HWwwjWouayW9pqK3SA4xr85oXtrUFQIGgzskYJe	محمدعلی مهرزادی	user	32	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10051	$2a$10$zlyUn1gI987eZ4lq.dWNmeya3Vfcxy350MbvsA7/jVhsvlzdepG7.	مرتضی نجف زاده	user	32	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10052	$2a$10$rR..z94yiI/R53yn4xHeK.f.l0awAh7w6RT4khoYlkFYXhkv1fWCq	حافظ فانی	user	34	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10053	$2a$10$1EPEeSfv0ubLVqExFMQYD.wPUaNKsB4R9evi79WLzlrufa.D8IhqK	رضا نادری	user	34	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
10054	$2a$10$6WNPYxg6.DUvbfPyyMOuduu2/vSNu4J5uueN3lK9JEd4OuzLiOKre	مهدی سامانی فام	user	34	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6034787	$2a$10$RnlG1KlaqDVbbYxL07/DO.jEMqHy.KDiaz1u43nrBGt/912itUEIC	توحید عطا کشتیبان	user	16	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6047002	$2a$10$lleQzMm67P14J0cBvVejkeORYL..KMBS.elhCGvOOj8uC4i03tZ0S	کاربر جدید	user	1	normal	1	0	2026-07-25 09:07:10	6047002	09141234567	\N	\N
6040062	$2a$10$u12o23Kh.7Kb0NZhJ15YduSGGPFF6sDiDIttW0wtv7Ha1LQQqR7a2	افشین نجاری	supervisor	33	normal	1	0	2026-07-15 15:23:01	\N	\N	\N	\N
6002734	$2a$10$/cqO4ve0lOsMx4IEUqsZve5JZfNbiQ/apG8rVtVIat.K3v3oNszHe	رنجبر	manager	\N	normal	1	0	2026-07-26 10:06:00	\N	\N	\N	\N
\.


--
-- Data for Name: work_order_counter; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.work_order_counter (id, year, last_number) FROM stdin;
\.


--
-- Data for Name: work_order_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.work_order_history (id, work_order_id, user_id, user_name, action, comment, created_at) FROM stdin;
\.


--
-- Data for Name: work_orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.work_orders (id, user_id, request_number, title, description, work_type, priority, estimated_cost, deadline, department_id, status, supervisor_id, supervisor_comment, supervisor_date, manager_id, manager_comment, manager_date, created_at) FROM stdin;
\.


--
-- Data for Name: work_shifts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.work_shifts (id, name, start_time, end_time, description, color, is_active, created_at) FROM stdin;
1	عادی کاری	08:00	17:00	شیفت عادی کاری	#3b82f6	1	2026-07-11 14:24:05
2	شیفت عصر	13:00	22:00	شیفت عصر	#f59e0b	1	2026-07-11 14:24:05
3	شیفت شب	22:00	06:00	شیفت شب	#111827	1	2026-07-11 14:24:05
\.


--
-- Data for Name: workflow_instances; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workflow_instances (id, template_id, record_id, current_step, status, started_by, created_at, completed_at) FROM stdin;
\.


--
-- Data for Name: workflow_steps_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workflow_steps_log (id, instance_id, step_index, actor_id, action, comment, created_at) FROM stdin;
\.


--
-- Data for Name: workflow_templates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workflow_templates (id, name, module_name, steps, is_active, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Name: activity_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.activity_log_id_seq', 113, true);


--
-- Name: announcements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.announcements_id_seq', 1, false);


--
-- Name: attachments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.attachments_id_seq', 1, true);


--
-- Name: backup_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.backup_logs_id_seq', 2, true);


--
-- Name: cardex_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.cardex_id_seq', 1, false);


--
-- Name: chat_members_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.chat_members_id_seq', 4, true);


--
-- Name: chat_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.chat_messages_id_seq', 4, true);


--
-- Name: chat_rooms_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.chat_rooms_id_seq', 2, true);


--
-- Name: conference_bookings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.conference_bookings_id_seq', 1, false);


--
-- Name: conference_counter_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.conference_counter_id_seq', 1, false);


--
-- Name: conference_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.conference_history_id_seq', 1, false);


--
-- Name: csv_imports_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.csv_imports_log_id_seq', 1, true);


--
-- Name: daily_output_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.daily_output_history_id_seq', 1, false);


--
-- Name: daily_output_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.daily_output_id_seq', 1, false);


--
-- Name: daily_work_report_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.daily_work_report_history_id_seq', 1, false);


--
-- Name: daily_work_reports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.daily_work_reports_id_seq', 1, false);


--
-- Name: departments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.departments_id_seq', 35, true);


--
-- Name: digital_signatures_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.digital_signatures_id_seq', 9, true);


--
-- Name: inspection_counter_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.inspection_counter_id_seq', 1, false);


--
-- Name: inspection_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.inspection_history_id_seq', 1, false);


--
-- Name: inspection_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.inspection_requests_id_seq', 1, false);


--
-- Name: inventory_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.inventory_items_id_seq', 7, true);


--
-- Name: it_request_counter_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.it_request_counter_id_seq', 1, true);


--
-- Name: it_request_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.it_request_history_id_seq', 1, true);


--
-- Name: it_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.it_requests_id_seq', 1, true);


--
-- Name: job_application_attachments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.job_application_attachments_id_seq', 1, false);


--
-- Name: job_application_counter_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.job_application_counter_id_seq', 1, false);


--
-- Name: job_application_work_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.job_application_work_history_id_seq', 1, false);


--
-- Name: job_applications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.job_applications_id_seq', 1, false);


--
-- Name: leave_balance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.leave_balance_id_seq', 244, true);


--
-- Name: leave_change_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.leave_change_logs_id_seq', 1, false);


--
-- Name: leave_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.leave_requests_id_seq', 12, true);


--
-- Name: letter_attachments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.letter_attachments_id_seq', 1, false);


--
-- Name: letter_counter_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.letter_counter_id_seq', 1, false);


--
-- Name: letter_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.letter_history_id_seq', 1, false);


--
-- Name: letter_units_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.letter_units_id_seq', 1, false);


--
-- Name: letters_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.letters_id_seq', 1, false);


--
-- Name: mission_counter_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.mission_counter_id_seq', 1, false);


--
-- Name: mission_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.mission_history_id_seq', 1, false);


--
-- Name: mission_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.mission_requests_id_seq', 1, false);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notifications_id_seq', 19, true);


--
-- Name: official_holidays_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.official_holidays_id_seq', 1, false);


--
-- Name: overtime_counter_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.overtime_counter_id_seq', 1, false);


--
-- Name: overtime_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.overtime_history_id_seq', 1, false);


--
-- Name: overtime_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.overtime_requests_id_seq', 1, true);


--
-- Name: payment_counter_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payment_counter_id_seq', 1, false);


--
-- Name: payment_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payment_history_id_seq', 1, false);


--
-- Name: payment_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payment_requests_id_seq', 1, false);


--
-- Name: permissions_migrated_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.permissions_migrated_id_seq', 1, false);


--
-- Name: permissions_new_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.permissions_new_id_seq', 371, true);


--
-- Name: project_supply_counter_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.project_supply_counter_id_seq', 1, false);


--
-- Name: project_supply_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.project_supply_history_id_seq', 1, false);


--
-- Name: project_supply_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.project_supply_id_seq', 1, false);


--
-- Name: project_supply_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.project_supply_requests_id_seq', 1, false);


--
-- Name: purchase_counter_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.purchase_counter_id_seq', 1, false);


--
-- Name: purchase_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.purchase_history_id_seq', 1, false);


--
-- Name: purchase_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.purchase_requests_id_seq', 1, false);


--
-- Name: push_subscriptions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.push_subscriptions_id_seq', 1, false);


--
-- Name: repair_counter_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.repair_counter_id_seq', 1, true);


--
-- Name: repair_external_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.repair_external_history_id_seq', 11, true);


--
-- Name: repair_external_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.repair_external_items_id_seq', 5, true);


--
-- Name: repair_external_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.repair_external_requests_id_seq', 5, true);


--
-- Name: repair_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.repair_history_id_seq', 1, false);


--
-- Name: repair_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.repair_requests_id_seq', 1, false);


--
-- Name: restaurant_menu_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.restaurant_menu_id_seq', 6, true);


--
-- Name: restaurant_reservations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.restaurant_reservations_id_seq', 3, true);


--
-- Name: security_counter_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.security_counter_id_seq', 1, false);


--
-- Name: security_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.security_history_id_seq', 1, false);


--
-- Name: security_reports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.security_reports_id_seq', 1, false);


--
-- Name: settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.settings_id_seq', 1, true);


--
-- Name: shift_change_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.shift_change_requests_id_seq', 1, false);


--
-- Name: signature_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.signature_logs_id_seq', 1, false);


--
-- Name: signatures_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.signatures_id_seq', 1, false);


--
-- Name: sms_codes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.sms_codes_id_seq', 2, true);


--
-- Name: ticket_responses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ticket_responses_id_seq', 1, false);


--
-- Name: tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tickets_id_seq', 1, false);


--
-- Name: user_shift_assignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.user_shift_assignments_id_seq', 248, true);


--
-- Name: work_order_counter_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.work_order_counter_id_seq', 1, false);


--
-- Name: work_order_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.work_order_history_id_seq', 1, false);


--
-- Name: work_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.work_orders_id_seq', 1, false);


--
-- Name: work_shifts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.work_shifts_id_seq', 3, true);


--
-- Name: workflow_instances_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.workflow_instances_id_seq', 1, false);


--
-- Name: workflow_steps_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.workflow_steps_log_id_seq', 1, false);


--
-- Name: workflow_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.workflow_templates_id_seq', 1, false);


--
-- Name: activity_log activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_pkey PRIMARY KEY (id);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: attachments attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);


--
-- Name: backup_logs backup_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_logs
    ADD CONSTRAINT backup_logs_pkey PRIMARY KEY (id);


--
-- Name: backup_settings backup_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_settings
    ADD CONSTRAINT backup_settings_pkey PRIMARY KEY (id);


--
-- Name: cardex cardex_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cardex
    ADD CONSTRAINT cardex_pkey PRIMARY KEY (id);


--
-- Name: chat_members chat_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_members
    ADD CONSTRAINT chat_members_pkey PRIMARY KEY (id);


--
-- Name: chat_members chat_members_room_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_members
    ADD CONSTRAINT chat_members_room_id_user_id_key UNIQUE (room_id, user_id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: chat_rooms chat_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_rooms
    ADD CONSTRAINT chat_rooms_pkey PRIMARY KEY (id);


--
-- Name: conference_bookings conference_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conference_bookings
    ADD CONSTRAINT conference_bookings_pkey PRIMARY KEY (id);


--
-- Name: conference_counter conference_counter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conference_counter
    ADD CONSTRAINT conference_counter_pkey PRIMARY KEY (id);


--
-- Name: conference_counter conference_counter_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conference_counter
    ADD CONSTRAINT conference_counter_year_key UNIQUE (year);


--
-- Name: conference_history conference_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conference_history
    ADD CONSTRAINT conference_history_pkey PRIMARY KEY (id);


--
-- Name: csv_imports_log csv_imports_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.csv_imports_log
    ADD CONSTRAINT csv_imports_log_pkey PRIMARY KEY (id);


--
-- Name: daily_output_history daily_output_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_output_history
    ADD CONSTRAINT daily_output_history_pkey PRIMARY KEY (id);


--
-- Name: daily_output daily_output_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_output
    ADD CONSTRAINT daily_output_pkey PRIMARY KEY (id);


--
-- Name: daily_work_report_history daily_work_report_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_work_report_history
    ADD CONSTRAINT daily_work_report_history_pkey PRIMARY KEY (id);


--
-- Name: daily_work_reports daily_work_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_work_reports
    ADD CONSTRAINT daily_work_reports_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: digital_signatures digital_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.digital_signatures
    ADD CONSTRAINT digital_signatures_pkey PRIMARY KEY (id);


--
-- Name: inspection_counter inspection_counter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_counter
    ADD CONSTRAINT inspection_counter_pkey PRIMARY KEY (id);


--
-- Name: inspection_counter inspection_counter_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_counter
    ADD CONSTRAINT inspection_counter_year_key UNIQUE (year);


--
-- Name: inspection_history inspection_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_history
    ADD CONSTRAINT inspection_history_pkey PRIMARY KEY (id);


--
-- Name: inspection_requests inspection_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_requests
    ADD CONSTRAINT inspection_requests_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: it_request_counter it_request_counter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.it_request_counter
    ADD CONSTRAINT it_request_counter_pkey PRIMARY KEY (id);


--
-- Name: it_request_counter it_request_counter_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.it_request_counter
    ADD CONSTRAINT it_request_counter_year_key UNIQUE (year);


--
-- Name: it_request_history it_request_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.it_request_history
    ADD CONSTRAINT it_request_history_pkey PRIMARY KEY (id);


--
-- Name: it_requests it_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.it_requests
    ADD CONSTRAINT it_requests_pkey PRIMARY KEY (id);


--
-- Name: job_application_attachments job_application_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_application_attachments
    ADD CONSTRAINT job_application_attachments_pkey PRIMARY KEY (id);


--
-- Name: job_application_counter job_application_counter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_application_counter
    ADD CONSTRAINT job_application_counter_pkey PRIMARY KEY (id);


--
-- Name: job_application_counter job_application_counter_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_application_counter
    ADD CONSTRAINT job_application_counter_year_key UNIQUE (year);


--
-- Name: job_application_work_history job_application_work_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_application_work_history
    ADD CONSTRAINT job_application_work_history_pkey PRIMARY KEY (id);


--
-- Name: job_applications job_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_pkey PRIMARY KEY (id);


--
-- Name: leave_balance leave_balance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_balance
    ADD CONSTRAINT leave_balance_pkey PRIMARY KEY (id);


--
-- Name: leave_balance leave_balance_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_balance
    ADD CONSTRAINT leave_balance_user_id_key UNIQUE (user_id);


--
-- Name: leave_change_logs leave_change_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_change_logs
    ADD CONSTRAINT leave_change_logs_pkey PRIMARY KEY (id);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: letter_attachments letter_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letter_attachments
    ADD CONSTRAINT letter_attachments_pkey PRIMARY KEY (id);


--
-- Name: letter_counter letter_counter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letter_counter
    ADD CONSTRAINT letter_counter_pkey PRIMARY KEY (id);


--
-- Name: letter_counter letter_counter_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letter_counter
    ADD CONSTRAINT letter_counter_year_key UNIQUE (year);


--
-- Name: letter_history letter_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letter_history
    ADD CONSTRAINT letter_history_pkey PRIMARY KEY (id);


--
-- Name: letter_units letter_units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letter_units
    ADD CONSTRAINT letter_units_pkey PRIMARY KEY (id);


--
-- Name: letters letters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letters
    ADD CONSTRAINT letters_pkey PRIMARY KEY (id);


--
-- Name: mission_counter mission_counter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_counter
    ADD CONSTRAINT mission_counter_pkey PRIMARY KEY (id);


--
-- Name: mission_counter mission_counter_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_counter
    ADD CONSTRAINT mission_counter_year_key UNIQUE (year);


--
-- Name: mission_history mission_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_history
    ADD CONSTRAINT mission_history_pkey PRIMARY KEY (id);


--
-- Name: mission_requests mission_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_requests
    ADD CONSTRAINT mission_requests_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: official_holidays official_holidays_holiday_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.official_holidays
    ADD CONSTRAINT official_holidays_holiday_date_key UNIQUE (holiday_date);


--
-- Name: official_holidays official_holidays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.official_holidays
    ADD CONSTRAINT official_holidays_pkey PRIMARY KEY (id);


--
-- Name: overtime_counter overtime_counter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_counter
    ADD CONSTRAINT overtime_counter_pkey PRIMARY KEY (id);


--
-- Name: overtime_counter overtime_counter_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_counter
    ADD CONSTRAINT overtime_counter_year_key UNIQUE (year);


--
-- Name: overtime_history overtime_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_history
    ADD CONSTRAINT overtime_history_pkey PRIMARY KEY (id);


--
-- Name: overtime_requests overtime_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_requests
    ADD CONSTRAINT overtime_requests_pkey PRIMARY KEY (id);


--
-- Name: payment_counter payment_counter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_counter
    ADD CONSTRAINT payment_counter_pkey PRIMARY KEY (id);


--
-- Name: payment_counter payment_counter_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_counter
    ADD CONSTRAINT payment_counter_year_key UNIQUE (year);


--
-- Name: payment_history payment_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_history
    ADD CONSTRAINT payment_history_pkey PRIMARY KEY (id);


--
-- Name: payment_requests payment_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_requests
    ADD CONSTRAINT payment_requests_pkey PRIMARY KEY (id);


--
-- Name: permissions_migrated permissions_migrated_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions_migrated
    ADD CONSTRAINT permissions_migrated_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_new_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_new_pkey PRIMARY KEY (id);


--
-- Name: project_supply_counter project_supply_counter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_supply_counter
    ADD CONSTRAINT project_supply_counter_pkey PRIMARY KEY (id);


--
-- Name: project_supply_counter project_supply_counter_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_supply_counter
    ADD CONSTRAINT project_supply_counter_year_key UNIQUE (year);


--
-- Name: project_supply_history project_supply_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_supply_history
    ADD CONSTRAINT project_supply_history_pkey PRIMARY KEY (id);


--
-- Name: project_supply project_supply_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_supply
    ADD CONSTRAINT project_supply_pkey PRIMARY KEY (id);


--
-- Name: project_supply_requests project_supply_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_supply_requests
    ADD CONSTRAINT project_supply_requests_pkey PRIMARY KEY (id);


--
-- Name: purchase_counter purchase_counter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_counter
    ADD CONSTRAINT purchase_counter_pkey PRIMARY KEY (id);


--
-- Name: purchase_counter purchase_counter_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_counter
    ADD CONSTRAINT purchase_counter_year_key UNIQUE (year);


--
-- Name: purchase_history purchase_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_history
    ADD CONSTRAINT purchase_history_pkey PRIMARY KEY (id);


--
-- Name: purchase_requests purchase_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT purchase_requests_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: repair_counter repair_counter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_counter
    ADD CONSTRAINT repair_counter_pkey PRIMARY KEY (id);


--
-- Name: repair_counter repair_counter_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_counter
    ADD CONSTRAINT repair_counter_year_key UNIQUE (year);


--
-- Name: repair_external_history repair_external_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_external_history
    ADD CONSTRAINT repair_external_history_pkey PRIMARY KEY (id);


--
-- Name: repair_external_items repair_external_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_external_items
    ADD CONSTRAINT repair_external_items_pkey PRIMARY KEY (id);


--
-- Name: repair_external_requests repair_external_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_external_requests
    ADD CONSTRAINT repair_external_requests_pkey PRIMARY KEY (id);


--
-- Name: repair_history repair_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_history
    ADD CONSTRAINT repair_history_pkey PRIMARY KEY (id);


--
-- Name: repair_requests repair_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_requests
    ADD CONSTRAINT repair_requests_pkey PRIMARY KEY (id);


--
-- Name: restaurant_menu restaurant_menu_food_date_option_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_menu
    ADD CONSTRAINT restaurant_menu_food_date_option_number_key UNIQUE (food_date, option_number);


--
-- Name: restaurant_menu restaurant_menu_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_menu
    ADD CONSTRAINT restaurant_menu_pkey PRIMARY KEY (id);


--
-- Name: restaurant_reservations restaurant_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_reservations
    ADD CONSTRAINT restaurant_reservations_pkey PRIMARY KEY (id);


--
-- Name: security_counter security_counter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_counter
    ADD CONSTRAINT security_counter_pkey PRIMARY KEY (id);


--
-- Name: security_counter security_counter_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_counter
    ADD CONSTRAINT security_counter_year_key UNIQUE (year);


--
-- Name: security_history security_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_history
    ADD CONSTRAINT security_history_pkey PRIMARY KEY (id);


--
-- Name: security_reports security_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_reports
    ADD CONSTRAINT security_reports_pkey PRIMARY KEY (id);


--
-- Name: settings settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_key_key UNIQUE (key);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: shift_change_requests shift_change_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_change_requests
    ADD CONSTRAINT shift_change_requests_pkey PRIMARY KEY (id);


--
-- Name: signature_logs signature_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_logs
    ADD CONSTRAINT signature_logs_pkey PRIMARY KEY (id);


--
-- Name: signatures signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signatures
    ADD CONSTRAINT signatures_pkey PRIMARY KEY (id);


--
-- Name: signatures signatures_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signatures
    ADD CONSTRAINT signatures_user_id_key UNIQUE (user_id);


--
-- Name: sms_codes sms_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_codes
    ADD CONSTRAINT sms_codes_pkey PRIMARY KEY (id);


--
-- Name: ticket_responses ticket_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_responses
    ADD CONSTRAINT ticket_responses_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: user_shift_assignments user_shift_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_shift_assignments
    ADD CONSTRAINT user_shift_assignments_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: work_order_counter work_order_counter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_counter
    ADD CONSTRAINT work_order_counter_pkey PRIMARY KEY (id);


--
-- Name: work_order_counter work_order_counter_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_counter
    ADD CONSTRAINT work_order_counter_year_key UNIQUE (year);


--
-- Name: work_order_history work_order_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_history
    ADD CONSTRAINT work_order_history_pkey PRIMARY KEY (id);


--
-- Name: work_orders work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_pkey PRIMARY KEY (id);


--
-- Name: work_shifts work_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_shifts
    ADD CONSTRAINT work_shifts_pkey PRIMARY KEY (id);


--
-- Name: workflow_instances workflow_instances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_instances
    ADD CONSTRAINT workflow_instances_pkey PRIMARY KEY (id);


--
-- Name: workflow_steps_log workflow_steps_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_steps_log
    ADD CONSTRAINT workflow_steps_log_pkey PRIMARY KEY (id);


--
-- Name: workflow_templates workflow_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_templates
    ADD CONSTRAINT workflow_templates_pkey PRIMARY KEY (id);


--
-- Name: idx_activity_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_log_created ON public.activity_log USING btree (created_at);


--
-- Name: idx_activity_log_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_log_module ON public.activity_log USING btree (module_name);


--
-- Name: idx_activity_log_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_log_user ON public.activity_log USING btree (user_id);


--
-- Name: idx_cardex_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cardex_status ON public.cardex USING btree (status);


--
-- Name: idx_cardex_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cardex_user ON public.cardex USING btree (user_id);


--
-- Name: idx_conference_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conference_date ON public.conference_bookings USING btree (meeting_date);


--
-- Name: idx_conference_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conference_status ON public.conference_bookings USING btree (status);


--
-- Name: idx_conference_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conference_user ON public.conference_bookings USING btree (user_id);


--
-- Name: idx_daily_output_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_output_status ON public.daily_output USING btree (status);


--
-- Name: idx_daily_output_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_output_user ON public.daily_output USING btree (user_id);


--
-- Name: idx_inspection_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inspection_status ON public.inspection_requests USING btree (status);


--
-- Name: idx_inspection_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inspection_user ON public.inspection_requests USING btree (user_id);


--
-- Name: idx_it_request_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_it_request_status ON public.it_requests USING btree (status);


--
-- Name: idx_it_request_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_it_request_user ON public.it_requests USING btree (user_id);


--
-- Name: idx_it_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_it_status ON public.it_requests USING btree (status);


--
-- Name: idx_it_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_it_user ON public.it_requests USING btree (user_id);


--
-- Name: idx_job_app_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_app_active ON public.job_applications USING btree (is_active);


--
-- Name: idx_job_app_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_app_status ON public.job_applications USING btree (status);


--
-- Name: idx_job_app_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_app_user ON public.job_applications USING btree (user_id);


--
-- Name: idx_leave_change_action_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_change_action_by ON public.leave_change_logs USING btree (action_by);


--
-- Name: idx_leave_change_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_change_target ON public.leave_change_logs USING btree (target_id);


--
-- Name: idx_leave_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_status ON public.leave_requests USING btree (status);


--
-- Name: idx_leave_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_user ON public.leave_requests USING btree (user_id);


--
-- Name: idx_leave_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_user_status ON public.leave_requests USING btree (user_id, status);


--
-- Name: idx_letter_attachments_letter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_letter_attachments_letter ON public.letter_attachments USING btree (letter_id);


--
-- Name: idx_letter_history_letter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_letter_history_letter ON public.letter_history USING btree (letter_id);


--
-- Name: idx_letter_units_letter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_letter_units_letter ON public.letter_units USING btree (letter_id);


--
-- Name: idx_letter_units_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_letter_units_unit ON public.letter_units USING btree (unit_id);


--
-- Name: idx_letters_sender; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_letters_sender ON public.letters USING btree (sender_id);


--
-- Name: idx_letters_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_letters_status ON public.letters USING btree (status);


--
-- Name: idx_mission_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mission_status ON public.mission_requests USING btree (status);


--
-- Name: idx_mission_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mission_user ON public.mission_requests USING btree (user_id);


--
-- Name: idx_notifications_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_unread ON public.notifications USING btree (user_id, is_read);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);


--
-- Name: idx_overtime_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_overtime_status ON public.overtime_requests USING btree (status);


--
-- Name: idx_overtime_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_overtime_user ON public.overtime_requests USING btree (user_id);


--
-- Name: idx_overtime_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_overtime_user_status ON public.overtime_requests USING btree (user_id, status);


--
-- Name: idx_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_status ON public.payment_requests USING btree (status);


--
-- Name: idx_payment_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_user ON public.payment_requests USING btree (user_id);


--
-- Name: idx_permissions_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permissions_dept ON public.permissions USING btree (department_id);


--
-- Name: idx_permissions_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permissions_module ON public.permissions USING btree (module_key);


--
-- Name: idx_permissions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permissions_user ON public.permissions USING btree (user_id);


--
-- Name: idx_project_supply_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_supply_status ON public.project_supply USING btree (status);


--
-- Name: idx_project_supply_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_supply_user ON public.project_supply USING btree (user_id);


--
-- Name: idx_purchase_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_status ON public.purchase_requests USING btree (status);


--
-- Name: idx_purchase_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_user ON public.purchase_requests USING btree (user_id);


--
-- Name: idx_push_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_user ON public.push_subscriptions USING btree (user_id);


--
-- Name: idx_repair_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_repair_status ON public.repair_requests USING btree (status);


--
-- Name: idx_repair_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_repair_user ON public.repair_requests USING btree (user_id);


--
-- Name: idx_reservations_food; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservations_food ON public.restaurant_reservations USING btree (food_id);


--
-- Name: idx_reservations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservations_status ON public.restaurant_reservations USING btree (status);


--
-- Name: idx_reservations_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservations_user ON public.restaurant_reservations USING btree (user_id);


--
-- Name: idx_restaurant_menu_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restaurant_menu_date ON public.restaurant_menu USING btree (food_date);


--
-- Name: idx_security_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_status ON public.security_reports USING btree (status);


--
-- Name: idx_security_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_user ON public.security_reports USING btree (user_id);


--
-- Name: idx_shift_req_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shift_req_user ON public.shift_change_requests USING btree (user_id);


--
-- Name: idx_sms_codes_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sms_codes_phone ON public.sms_codes USING btree (phone);


--
-- Name: idx_user_shift_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_shift_user ON public.user_shift_assignments USING btree (user_id);


--
-- Name: idx_users_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_active ON public.users USING btree (is_active);


--
-- Name: idx_users_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_dept ON public.users USING btree (department_id);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_work_order_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_order_status ON public.work_orders USING btree (status);


--
-- Name: idx_work_order_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_order_user ON public.work_orders USING btree (user_id);


--
-- Name: activity_log activity_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: announcements announcements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: attachments attachments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: cardex cardex_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cardex
    ADD CONSTRAINT cardex_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;


--
-- Name: cardex cardex_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cardex
    ADD CONSTRAINT cardex_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: cardex cardex_warehouse_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cardex
    ADD CONSTRAINT cardex_warehouse_user_id_fkey FOREIGN KEY (warehouse_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: chat_members chat_members_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_members
    ADD CONSTRAINT chat_members_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(id) ON DELETE CASCADE;


--
-- Name: chat_members chat_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_members
    ADD CONSTRAINT chat_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: chat_rooms chat_rooms_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_rooms
    ADD CONSTRAINT chat_rooms_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: conference_bookings conference_bookings_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conference_bookings
    ADD CONSTRAINT conference_bookings_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: conference_bookings conference_bookings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conference_bookings
    ADD CONSTRAINT conference_bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: conference_history conference_history_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conference_history
    ADD CONSTRAINT conference_history_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.conference_bookings(id) ON DELETE CASCADE;


--
-- Name: conference_history conference_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conference_history
    ADD CONSTRAINT conference_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: csv_imports_log csv_imports_log_imported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.csv_imports_log
    ADD CONSTRAINT csv_imports_log_imported_by_fkey FOREIGN KEY (imported_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: daily_output daily_output_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_output
    ADD CONSTRAINT daily_output_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: daily_output_history daily_output_history_output_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_output_history
    ADD CONSTRAINT daily_output_history_output_id_fkey FOREIGN KEY (output_id) REFERENCES public.daily_output(id) ON DELETE CASCADE;


--
-- Name: daily_output_history daily_output_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_output_history
    ADD CONSTRAINT daily_output_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: daily_output daily_output_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_output
    ADD CONSTRAINT daily_output_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: daily_output daily_output_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_output
    ADD CONSTRAINT daily_output_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: daily_output daily_output_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_output
    ADD CONSTRAINT daily_output_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: daily_work_report_history daily_work_report_history_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_work_report_history
    ADD CONSTRAINT daily_work_report_history_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.daily_work_reports(id) ON DELETE CASCADE;


--
-- Name: daily_work_reports daily_work_reports_central_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_work_reports
    ADD CONSTRAINT daily_work_reports_central_by_fkey FOREIGN KEY (central_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: daily_work_reports daily_work_reports_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_work_reports
    ADD CONSTRAINT daily_work_reports_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: daily_work_reports daily_work_reports_manager_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_work_reports
    ADD CONSTRAINT daily_work_reports_manager_by_fkey FOREIGN KEY (manager_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: daily_work_reports daily_work_reports_project_control_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_work_reports
    ADD CONSTRAINT daily_work_reports_project_control_by_fkey FOREIGN KEY (project_control_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: daily_work_reports daily_work_reports_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_work_reports
    ADD CONSTRAINT daily_work_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: departments departments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.departments(id);


--
-- Name: digital_signatures digital_signatures_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.digital_signatures
    ADD CONSTRAINT digital_signatures_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: inspection_history inspection_history_inspection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_history
    ADD CONSTRAINT inspection_history_inspection_id_fkey FOREIGN KEY (inspection_id) REFERENCES public.inspection_requests(id) ON DELETE CASCADE;


--
-- Name: inspection_history inspection_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_history
    ADD CONSTRAINT inspection_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: inspection_requests inspection_requests_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_requests
    ADD CONSTRAINT inspection_requests_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: inspection_requests inspection_requests_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_requests
    ADD CONSTRAINT inspection_requests_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: inspection_requests inspection_requests_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_requests
    ADD CONSTRAINT inspection_requests_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: inspection_requests inspection_requests_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_requests
    ADD CONSTRAINT inspection_requests_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: inspection_requests inspection_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_requests
    ADD CONSTRAINT inspection_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: it_request_history it_request_history_it_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.it_request_history
    ADD CONSTRAINT it_request_history_it_request_id_fkey FOREIGN KEY (it_request_id) REFERENCES public.it_requests(id) ON DELETE CASCADE;


--
-- Name: it_request_history it_request_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.it_request_history
    ADD CONSTRAINT it_request_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: it_requests it_requests_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.it_requests
    ADD CONSTRAINT it_requests_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: it_requests it_requests_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.it_requests
    ADD CONSTRAINT it_requests_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: it_requests it_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.it_requests
    ADD CONSTRAINT it_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: job_application_attachments job_application_attachments_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_application_attachments
    ADD CONSTRAINT job_application_attachments_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.job_applications(id) ON DELETE CASCADE;


--
-- Name: job_application_work_history job_application_work_history_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_application_work_history
    ADD CONSTRAINT job_application_work_history_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.job_applications(id) ON DELETE CASCADE;


--
-- Name: job_applications job_applications_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: job_applications job_applications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: leave_balance leave_balance_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_balance
    ADD CONSTRAINT leave_balance_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: leave_change_logs leave_change_logs_action_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_change_logs
    ADD CONSTRAINT leave_change_logs_action_by_fkey FOREIGN KEY (action_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: leave_requests leave_requests_edited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_edited_by_fkey FOREIGN KEY (edited_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: leave_requests leave_requests_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: leave_requests leave_requests_security_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_security_id_fkey FOREIGN KEY (security_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: leave_requests leave_requests_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: leave_requests leave_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: letter_attachments letter_attachments_letter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letter_attachments
    ADD CONSTRAINT letter_attachments_letter_id_fkey FOREIGN KEY (letter_id) REFERENCES public.letters(id) ON DELETE CASCADE;


--
-- Name: letter_history letter_history_letter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letter_history
    ADD CONSTRAINT letter_history_letter_id_fkey FOREIGN KEY (letter_id) REFERENCES public.letters(id) ON DELETE CASCADE;


--
-- Name: letter_history letter_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letter_history
    ADD CONSTRAINT letter_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: letter_units letter_units_letter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letter_units
    ADD CONSTRAINT letter_units_letter_id_fkey FOREIGN KEY (letter_id) REFERENCES public.letters(id) ON DELETE CASCADE;


--
-- Name: letter_units letter_units_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letter_units
    ADD CONSTRAINT letter_units_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: letters letters_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letters
    ADD CONSTRAINT letters_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: letters letters_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letters
    ADD CONSTRAINT letters_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: letters letters_sender_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letters
    ADD CONSTRAINT letters_sender_unit_id_fkey FOREIGN KEY (sender_unit_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: mission_history mission_history_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_history
    ADD CONSTRAINT mission_history_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.mission_requests(id) ON DELETE CASCADE;


--
-- Name: mission_history mission_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_history
    ADD CONSTRAINT mission_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: mission_requests mission_requests_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_requests
    ADD CONSTRAINT mission_requests_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: mission_requests mission_requests_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_requests
    ADD CONSTRAINT mission_requests_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: mission_requests mission_requests_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_requests
    ADD CONSTRAINT mission_requests_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: mission_requests mission_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_requests
    ADD CONSTRAINT mission_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: overtime_requests overtime_requests_edited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_requests
    ADD CONSTRAINT overtime_requests_edited_by_fkey FOREIGN KEY (edited_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: overtime_requests overtime_requests_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_requests
    ADD CONSTRAINT overtime_requests_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: overtime_requests overtime_requests_security_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_requests
    ADD CONSTRAINT overtime_requests_security_id_fkey FOREIGN KEY (security_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: overtime_requests overtime_requests_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_requests
    ADD CONSTRAINT overtime_requests_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: overtime_requests overtime_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_requests
    ADD CONSTRAINT overtime_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payment_history payment_history_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_history
    ADD CONSTRAINT payment_history_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payment_requests(id) ON DELETE CASCADE;


--
-- Name: payment_history payment_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_history
    ADD CONSTRAINT payment_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payment_requests payment_requests_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_requests
    ADD CONSTRAINT payment_requests_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: payment_requests payment_requests_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_requests
    ADD CONSTRAINT payment_requests_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: payment_requests payment_requests_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_requests
    ADD CONSTRAINT payment_requests_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: payment_requests payment_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_requests
    ADD CONSTRAINT payment_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: project_supply project_supply_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_supply
    ADD CONSTRAINT project_supply_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: project_supply_history project_supply_history_supply_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_supply_history
    ADD CONSTRAINT project_supply_history_supply_id_fkey FOREIGN KEY (supply_id) REFERENCES public.project_supply(id) ON DELETE CASCADE;


--
-- Name: project_supply_history project_supply_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_supply_history
    ADD CONSTRAINT project_supply_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: project_supply project_supply_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_supply
    ADD CONSTRAINT project_supply_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: project_supply_requests project_supply_requests_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_supply_requests
    ADD CONSTRAINT project_supply_requests_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: project_supply_requests project_supply_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_supply_requests
    ADD CONSTRAINT project_supply_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: project_supply project_supply_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_supply
    ADD CONSTRAINT project_supply_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: project_supply project_supply_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_supply
    ADD CONSTRAINT project_supply_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: purchase_history purchase_history_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_history
    ADD CONSTRAINT purchase_history_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchase_requests(id) ON DELETE CASCADE;


--
-- Name: purchase_history purchase_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_history
    ADD CONSTRAINT purchase_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: purchase_requests purchase_requests_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT purchase_requests_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: purchase_requests purchase_requests_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT purchase_requests_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: purchase_requests purchase_requests_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT purchase_requests_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: purchase_requests purchase_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT purchase_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: push_subscriptions push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: repair_external_history repair_external_history_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_external_history
    ADD CONSTRAINT repair_external_history_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.repair_external_requests(id) ON DELETE CASCADE;


--
-- Name: repair_external_items repair_external_items_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_external_items
    ADD CONSTRAINT repair_external_items_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.repair_external_requests(id) ON DELETE CASCADE;


--
-- Name: repair_external_requests repair_external_requests_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_external_requests
    ADD CONSTRAINT repair_external_requests_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: repair_external_requests repair_external_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_external_requests
    ADD CONSTRAINT repair_external_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: repair_history repair_history_repair_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_history
    ADD CONSTRAINT repair_history_repair_id_fkey FOREIGN KEY (repair_id) REFERENCES public.repair_requests(id) ON DELETE CASCADE;


--
-- Name: repair_history repair_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_history
    ADD CONSTRAINT repair_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: repair_requests repair_requests_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_requests
    ADD CONSTRAINT repair_requests_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: repair_requests repair_requests_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_requests
    ADD CONSTRAINT repair_requests_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: repair_requests repair_requests_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_requests
    ADD CONSTRAINT repair_requests_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: repair_requests repair_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_requests
    ADD CONSTRAINT repair_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: restaurant_reservations restaurant_reservations_food_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_reservations
    ADD CONSTRAINT restaurant_reservations_food_id_fkey FOREIGN KEY (food_id) REFERENCES public.restaurant_menu(id) ON DELETE CASCADE;


--
-- Name: restaurant_reservations restaurant_reservations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_reservations
    ADD CONSTRAINT restaurant_reservations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: security_history security_history_security_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_history
    ADD CONSTRAINT security_history_security_report_id_fkey FOREIGN KEY (security_report_id) REFERENCES public.security_reports(id) ON DELETE CASCADE;


--
-- Name: security_history security_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_history
    ADD CONSTRAINT security_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: security_reports security_reports_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_reports
    ADD CONSTRAINT security_reports_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: security_reports security_reports_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_reports
    ADD CONSTRAINT security_reports_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: security_reports security_reports_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_reports
    ADD CONSTRAINT security_reports_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: security_reports security_reports_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_reports
    ADD CONSTRAINT security_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: shift_change_requests shift_change_requests_current_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_change_requests
    ADD CONSTRAINT shift_change_requests_current_shift_id_fkey FOREIGN KEY (current_shift_id) REFERENCES public.work_shifts(id) ON DELETE SET NULL;


--
-- Name: shift_change_requests shift_change_requests_requested_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_change_requests
    ADD CONSTRAINT shift_change_requests_requested_shift_id_fkey FOREIGN KEY (requested_shift_id) REFERENCES public.work_shifts(id) ON DELETE CASCADE;


--
-- Name: shift_change_requests shift_change_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_change_requests
    ADD CONSTRAINT shift_change_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: shift_change_requests shift_change_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_change_requests
    ADD CONSTRAINT shift_change_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: signature_logs signature_logs_signature_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_logs
    ADD CONSTRAINT signature_logs_signature_id_fkey FOREIGN KEY (signature_id) REFERENCES public.digital_signatures(id) ON DELETE SET NULL;


--
-- Name: signature_logs signature_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_logs
    ADD CONSTRAINT signature_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: signatures signatures_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signatures
    ADD CONSTRAINT signatures_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ticket_responses ticket_responses_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_responses
    ADD CONSTRAINT ticket_responses_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_responses ticket_responses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_responses
    ADD CONSTRAINT ticket_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tickets tickets_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_shift_assignments user_shift_assignments_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_shift_assignments
    ADD CONSTRAINT user_shift_assignments_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.work_shifts(id) ON DELETE CASCADE;


--
-- Name: user_shift_assignments user_shift_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_shift_assignments
    ADD CONSTRAINT user_shift_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: work_order_history work_order_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_history
    ADD CONSTRAINT work_order_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: work_order_history work_order_history_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_history
    ADD CONSTRAINT work_order_history_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;


--
-- Name: work_orders work_orders_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: work_orders work_orders_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: work_orders work_orders_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: work_orders work_orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workflow_instances workflow_instances_started_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_instances
    ADD CONSTRAINT workflow_instances_started_by_fkey FOREIGN KEY (started_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: workflow_instances workflow_instances_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_instances
    ADD CONSTRAINT workflow_instances_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.workflow_templates(id) ON DELETE CASCADE;


--
-- Name: workflow_steps_log workflow_steps_log_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_steps_log
    ADD CONSTRAINT workflow_steps_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: workflow_steps_log workflow_steps_log_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_steps_log
    ADD CONSTRAINT workflow_steps_log_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.workflow_instances(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict ZRFrycgq4Vto7ni7NPP1yshfBdMtZ0MfIR5mTo1Hzev0eOM4fczxGDLSUCP844m

