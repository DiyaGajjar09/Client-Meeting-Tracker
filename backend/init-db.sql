-- Initialize development and test databases with UTF-8 support
CREATE DATABASE IF NOT EXISTS meeting_action_tracker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS meeting_action_tracker_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Grant permissions to application user
GRANT ALL PRIVILEGES ON meeting_action_tracker.* TO 'meeting_app'@'%';
GRANT ALL PRIVILEGES ON meeting_action_tracker_test.* TO 'meeting_app'@'%';
FLUSH PRIVILEGES;

