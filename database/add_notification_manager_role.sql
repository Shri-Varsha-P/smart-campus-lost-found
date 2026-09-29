-- Migration to add notification_manager role and notification workflow support
-- Run this migration after the existing schema.sql

USE smart_campus_lost_found;

-- Step 1: Add notification_manager to the role ENUM in users table
ALTER TABLE users 
MODIFY COLUMN role ENUM('student', 'admin', 'security', 'notification_manager', 'staff') DEFAULT 'student';

-- Step 2: Add fields to notifications table for the new workflow
ALTER TABLE notifications 
ADD COLUMN notification_type ENUM('personal_lost_item', 'campus_asset_lost', 'asset_report', 'general') DEFAULT 'general' AFTER message,
ADD COLUMN asset_id INT NULL AFTER notification_type,
ADD COLUMN approval_status ENUM('pending', 'approved', 'rejected') NULL AFTER asset_id,
ADD COLUMN handled_by INT NULL AFTER approval_status,
ADD COLUMN handled_at TIMESTAMP NULL AFTER handled_at,
ADD COLUMN lost_item_id INT NULL AFTER handled_at,
ADD INDEX idx_notification_type (notification_type),
ADD INDEX idx_approval_status (approval_status),
ADD INDEX idx_asset_id (asset_id),
ADD INDEX idx_lost_item_id (lost_item_id);

-- Step 3: Add foreign key constraints for the new fields
ALTER TABLE notifications 
ADD CONSTRAINT fk_notifications_asset FOREIGN KEY (asset_id) REFERENCES institutional_assets(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_notifications_lost_item FOREIGN KEY (lost_item_id) REFERENCES lost_items(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_notifications_handled_by FOREIGN KEY (handled_by) REFERENCES users(id) ON DELETE SET NULL;

-- Step 4: Update existing notifications to have appropriate types
-- Existing notifications without specific types will remain 'general'
UPDATE notifications SET notification_type = 'asset_report' WHERE report_id IS NOT NULL;
