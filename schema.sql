CREATE DATABASE IF NOT EXISTS vinayagar_seettu
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE vinayagar_seettu;

CREATE TABLE IF NOT EXISTS members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  mobile VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  member_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_time TIME NOT NULL,
  payment_method ENUM('Online','Cash') NOT NULL,
  transaction_id VARCHAR(150) NULL,
  google_transaction_id VARCHAR(150) NULL,
  sender_name VARCHAR(150) NULL,
  sender_upi VARCHAR(150) NULL,
  receiver_name VARCHAR(150) NULL,
  receiver_upi VARCHAR(150) NULL,
  bank_name VARCHAR(150) NULL,
  bill_no VARCHAR(100) NOT NULL UNIQUE,
  screenshot_path VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payment_member
    FOREIGN KEY (member_id) REFERENCES members(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO members (name, mobile) VALUES
('Selva','9345884883'),
('Saravanan','9381187901'),
('Maheshkumar','8825842408'),
('Saravanan Abi','6382964906'),
('Sathishkumar','8526721579'),
('Ayyanar','8870513920'),
('Dinesh','8015161745'),
('Kesavan','9884201109'),
('Kumaresan','9994528084'),
('Boopathi','9688687044'),
('Soundhar','9345241769'),
('Venkatesan','8667584133'),
('Kamal','8754864353'),
('Jayabalaji','9751197612');
