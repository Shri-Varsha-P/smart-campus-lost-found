-- Migration: Add report_id column to notifications table
-- This adds the ability to link notifications to specific asset reports

USE smart_campus_lost_found;

-- Add report_id column to notifications table
ALTER TABLE notifications 
ADD COLUMN report_id INT NULL,
ADD FOREIGN KEY (report_id) REFERENCES asset_reports(id);
