-- =========================================================
-- STOCK PORTAL (CLEAN FINAL DUMP)
-- Supports:
--  - personal + paper accounts (accounts.accountType)
--  - REAL vs PAPER holdings (user_holdings.mode)
--  - REAL vs PAPER transactions (stock_transactions.mode)
--  - Trigger auto-syncs holdings after every transaction insert
--
-- Notes:
-- 1) Transactions table has NO "unique exact" constraint (transactions should not be unique).
-- 2) Controller should INSERT into stock_transactions and UPDATE wallet only.
--    Trigger will maintain user_holdings for both REAL and PAPER.
-- =========================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

DROP DATABASE IF EXISTS `stock_portal`;
CREATE DATABASE `stock_portal`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;
USE `stock_portal`;

-- =========================================================
-- roles
-- =========================================================
CREATE TABLE `roles` (
  `roleId` INT(11) NOT NULL AUTO_INCREMENT,
  `roleName` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`roleId`),
  UNIQUE KEY `roleName` (`roleName`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `roles` (`roleId`, `roleName`)
VALUES (2,'admin'), (1,'user')
ON DUPLICATE KEY UPDATE `roleName` = VALUES(`roleName`);

-- =========================================================
-- users
-- =========================================================
CREATE TABLE `users` (
  `userId` INT(11) NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `roleId` INT(11) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `isFrozen` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`userId`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `fk_users_roles` (`roleId`),
  CONSTRAINT `fk_users_roles`
    FOREIGN KEY (`roleId`) REFERENCES `roles` (`roleId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `users` (`userId`, `username`, `email`, `password`, `roleId`, `created_at`, `isFrozen`)
VALUES
(1, 'admin2', 'admin@stock.com', '$2b$10$iUb2P3.3iJ0TDx.d4fmJweF7GEsSuiDZsACAdS9xK1ykSiO4OXlZW', 2, '2025-11-23 09:34:59', 0),
(4, 'yuzhii', 'yuzhi3112@gmail.com', '$2b$10$tHIC38AAEEsEK/NP2YgwlOn4ol.GntNRo9pAF7MwQk3MVKgaacyWC', 1, '2025-11-25 09:49:34', 0),
(5, 'venom3112', 'venom3112@gmail.com', '$2b$10$X.mtqQ4umu/y4Qr/NPfyBeracSIcxNUz61Dsl0MKdMaVcYOiTraEG', 1, '2026-01-21 04:35:01', 0)
ON DUPLICATE KEY UPDATE
  `username` = VALUES(`username`),
  `email` = VALUES(`email`),
  `password` = VALUES(`password`),
  `roleId` = VALUES(`roleId`),
  `isFrozen` = VALUES(`isFrozen`);

-- =========================================================
-- user_profiles
-- =========================================================
CREATE TABLE `user_profiles` (
  `profileId` INT(11) NOT NULL AUTO_INCREMENT,
  `userId` INT(11) NOT NULL,
  `fullName` VARCHAR(150) DEFAULT NULL,
  `bio` TEXT DEFAULT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `avatar` VARCHAR(255) DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `walletAddress` VARCHAR(255) DEFAULT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`profileId`),
  UNIQUE KEY `uniq_user_profiles_userId` (`userId`),
  KEY `fk_profile_user` (`userId`),
  CONSTRAINT `fk_profile_user`
    FOREIGN KEY (`userId`) REFERENCES `users` (`userId`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `user_profiles` (`profileId`, `userId`, `fullName`, `bio`, `phone`, `avatar`, `address`, `walletAddress`, `updated_at`)
VALUES
(1, 1, 'System Admin', 'Auto-created admin account', '', NULL, '', NULL, '2026-01-16 06:37:02'),
(4, 4, 'Chan Yu Zhi', 'sscscs', '94728914', 'avatar_4_1764064247016.png', 'street 91, #03-15', NULL, '2025-11-25 09:50:47'),
(5, 5, 'venom', NULL, NULL, NULL, NULL, NULL, '2026-01-21 04:35:01')
ON DUPLICATE KEY UPDATE
  `fullName` = VALUES(`fullName`),
  `bio` = VALUES(`bio`),
  `phone` = VALUES(`phone`),
  `avatar` = VALUES(`avatar`),
  `address` = VALUES(`address`),
  `walletAddress` = VALUES(`walletAddress`);

-- =========================================================
-- user_risk_profiles
-- =========================================================
CREATE TABLE `user_risk_profiles` (
  `riskProfileId` INT(11) NOT NULL AUTO_INCREMENT,
  `userId` INT(11) NOT NULL,
  `riskTolerance` VARCHAR(50) DEFAULT NULL,
  `investmentExperience` VARCHAR(50) DEFAULT NULL,
  `investmentGoal` VARCHAR(255) DEFAULT NULL,
  `timeHorizon` VARCHAR(50) DEFAULT NULL,
  `annualIncome` DECIMAL(15,2) DEFAULT NULL,
  `netWorth` DECIMAL(15,2) DEFAULT NULL,
  `age` INT(11) DEFAULT NULL,
  `completedAt` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`riskProfileId`),
  UNIQUE KEY `uniq_user_risk_userId` (`userId`),
  KEY `fk_risk_user` (`userId`),
  CONSTRAINT `fk_risk_user`
    FOREIGN KEY (`userId`) REFERENCES `users` (`userId`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `user_risk_profiles`
  (`userId`,`riskTolerance`,`investmentExperience`,`investmentGoal`,`timeHorizon`,`annualIncome`,`netWorth`,`age`,`completedAt`)
VALUES
  (5,'Medium','Beginner','Growth','3-5 years',30000.00,20000.00,20,'2026-01-21 06:34:00')
ON DUPLICATE KEY UPDATE
  `riskTolerance` = VALUES(`riskTolerance`),
  `investmentExperience` = VALUES(`investmentExperience`),
  `investmentGoal` = VALUES(`investmentGoal`),
  `timeHorizon` = VALUES(`timeHorizon`),
  `annualIncome` = VALUES(`annualIncome`),
  `netWorth` = VALUES(`netWorth`),
  `age` = VALUES(`age`),
  `completedAt` = VALUES(`completedAt`);

-- =========================================================
-- accounts (personal + paper)
-- =========================================================
CREATE TABLE `accounts` (
  `accountId` INT(11) NOT NULL AUTO_INCREMENT,
  `userId` INT(11) NOT NULL,
  `accountNumber` VARCHAR(50) NOT NULL,
  `accountType` ENUM('personal','paper') NOT NULL DEFAULT 'personal',
  `accountStatus` VARCHAR(50) DEFAULT 'active',
  `balance` DECIMAL(15,2) DEFAULT 0.00,
  `totalInvested` DECIMAL(15,2) DEFAULT 0.00,
  `totalReturns` DECIMAL(15,2) DEFAULT 0.00,
  `currency` VARCHAR(10) DEFAULT 'USD',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`accountId`),
  UNIQUE KEY `accountNumber` (`accountNumber`),
  UNIQUE KEY `uniq_user_accountType` (`userId`, `accountType`),
  KEY `fk_account_user` (`userId`),
  CONSTRAINT `fk_account_user`
    FOREIGN KEY (`userId`) REFERENCES `users` (`userId`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Seed: userId=5 gets BOTH personal + paper accounts
INSERT INTO `accounts`
  (`userId`,`accountNumber`,`accountType`,`accountStatus`,`balance`,`totalInvested`,`totalReturns`,`currency`)
VALUES
  (5,'ACC-000005','personal','active',100000.00,0.00,0.00,'USD'),
  (5,'PAPER-000005','paper','active',100000.00,0.00,0.00,'USD')
ON DUPLICATE KEY UPDATE
  `accountStatus` = VALUES(`accountStatus`),
  `balance` = VALUES(`balance`),
  `currency` = VALUES(`currency`);

-- =========================================================
-- account_stocks (legacy/optional)
-- =========================================================
CREATE TABLE `account_stocks` (
  `accountStockId` INT(11) NOT NULL AUTO_INCREMENT,
  `accountId` INT(11) NOT NULL,
  `stockSymbol` VARCHAR(10) NOT NULL,
  `stockName` VARCHAR(150) NOT NULL,
  `quantity` INT(11) NOT NULL DEFAULT 0,
  `purchasePrice` DECIMAL(10,2) NOT NULL,
  `currentPrice` DECIMAL(10,2) NOT NULL,
  `totalCost` DECIMAL(15,2) NOT NULL,
  `currentValue` DECIMAL(15,2) NOT NULL,
  `gainLoss` DECIMAL(15,2) NOT NULL,
  `gainLossPercent` DECIMAL(5,2) NOT NULL,
  `purchaseDate` TIMESTAMP NOT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`accountStockId`),
  KEY `fk_account_stock` (`accountId`),
  KEY `stockSymbol` (`stockSymbol`),
  CONSTRAINT `fk_account_stock`
    FOREIGN KEY (`accountId`) REFERENCES `accounts` (`accountId`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =========================================================
-- user_watchlist
-- =========================================================
CREATE TABLE `user_watchlist` (
  `watchlistId` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `symbol` VARCHAR(16) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`watchlistId`),
  UNIQUE KEY `uniq_user_symbol` (`userId`, `symbol`),
  KEY `idx_watchlist_user` (`userId`),
  CONSTRAINT `fk_watchlist_user`
    FOREIGN KEY (`userId`) REFERENCES `users` (`userId`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =========================================================
-- alert_rules
-- =========================================================
CREATE TABLE `alert_rules` (
  `alertId` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `symbol` VARCHAR(16) NOT NULL,
  `alertType` ENUM('above','below') NOT NULL,
  `targetPrice` DECIMAL(12,4) NOT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`alertId`),
  UNIQUE KEY `uniq_user_symbol_alert` (`userId`, `symbol`, `alertType`, `targetPrice`),
  KEY `idx_alert_user` (`userId`),
  KEY `idx_alert_active` (`isActive`),
  CONSTRAINT `fk_alert_user`
    FOREIGN KEY (`userId`) REFERENCES `users` (`userId`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =========================================================
-- user_holdings (REAL vs PAPER)
-- =========================================================
CREATE TABLE `user_holdings` (
  `holdingId` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `symbol` VARCHAR(16) NOT NULL,
  `qty` DECIMAL(12,4) NOT NULL DEFAULT 0,
  `avgPrice` DECIMAL(12,4) NOT NULL DEFAULT 0,
  `mode` ENUM('REAL','PAPER') NOT NULL DEFAULT 'REAL',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`holdingId`),
  UNIQUE KEY `uniq_hold_user_symbol_mode` (`userId`, `symbol`, `mode`),
  KEY `idx_holdings_user` (`userId`),
  CONSTRAINT `fk_holdings_user`
    FOREIGN KEY (`userId`) REFERENCES `users` (`userId`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Seed REAL holdings (paper starts empty)
INSERT INTO `user_holdings` (`userId`,`symbol`,`qty`,`avgPrice`,`mode`)
VALUES
(5,'AAPL',10.0000,170.0000,'REAL'),
(5,'TSLA',3.0000,200.0000,'REAL'),
(5,'NVDA',2.0000,450.0000,'REAL')
ON DUPLICATE KEY UPDATE
  `qty` = VALUES(`qty`),
  `avgPrice` = VALUES(`avgPrice`),
  `mode` = VALUES(`mode`);

-- =========================================================
-- stock_transactions (REAL vs PAPER)
-- =========================================================
CREATE TABLE `stock_transactions` (
  `txId` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `symbol` VARCHAR(16) NOT NULL,
  `txType` ENUM('BUY','SELL') NOT NULL DEFAULT 'BUY',
  `qty` DECIMAL(12,4) NOT NULL,
  `price` DECIMAL(12,4) NOT NULL,
  `dataSource` ENUM('finnhub','yahoo','cache') DEFAULT NULL,
  `isStale` TINYINT(1) NOT NULL DEFAULT 0,
  `mode` ENUM('REAL','PAPER') NOT NULL DEFAULT 'REAL',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`txId`),
  KEY `idx_tx_user` (`userId`),
  KEY `idx_tx_symbol` (`symbol`),
  KEY `idx_tx_user_symbol_time` (`userId`, `symbol`, `created_at`),
  KEY `idx_tx_user_mode` (`userId`, `mode`),
  CONSTRAINT `fk_tx_user`
    FOREIGN KEY (`userId`) REFERENCES `users` (`userId`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Seed REAL transaction history (paper starts empty)
INSERT INTO `stock_transactions`
  (`userId`,`symbol`,`txType`,`qty`,`price`,`dataSource`,`isStale`,`mode`,`created_at`)
VALUES
(5,'AAPL','BUY',10.0000,170.0000,'cache',1,'REAL','2026-01-21 06:34:10'),
(5,'TSLA','BUY',3.0000,200.0000,'cache',1,'REAL','2026-01-21 06:34:20'),
(5,'NVDA','BUY',2.0000,450.0000,'cache',1,'REAL','2026-01-21 06:34:30');

-- =========================================================
-- Trigger: MODE-aware holdings sync (source of truth = transactions)
-- Handles both REAL and PAPER mode
-- =========================================================
DROP TRIGGER IF EXISTS `trg_stock_tx_after_insert`;
DELIMITER $$

CREATE TRIGGER `trg_stock_tx_after_insert`
AFTER INSERT ON `stock_transactions`
FOR EACH ROW
BEGIN
  DECLARE existing_qty DECIMAL(12,4);
  DECLARE existing_avg DECIMAL(12,4);

  DECLARE CONTINUE HANDLER FOR NOT FOUND
  SET existing_qty = NULL, existing_avg = NULL;

  SELECT `qty`, `avgPrice`
    INTO existing_qty, existing_avg
  FROM `user_holdings`
  WHERE `userId` = NEW.`userId`
    AND `symbol` = UPPER(NEW.`symbol`)
    AND `mode` = NEW.`mode`
  LIMIT 1;

  IF NEW.`txType` = 'BUY' THEN
    -- BUY: Always add to holdings
    IF existing_qty IS NULL THEN
      INSERT INTO `user_holdings` (`userId`,`symbol`,`qty`,`avgPrice`,`mode`)
      VALUES (NEW.`userId`, UPPER(NEW.`symbol`), NEW.`qty`, NEW.`price`, NEW.`mode`)
      ON DUPLICATE KEY UPDATE
        `qty` = `qty` + VALUES(`qty`),
        `avgPrice` = ((`qty` * `avgPrice`) + (VALUES(`qty`) * NEW.`price`)) / (`qty` + VALUES(`qty`)),
        `mode` = VALUES(`mode`);
    ELSE
      UPDATE `user_holdings`
      SET
        `avgPrice` = ((existing_qty * existing_avg) + (NEW.`qty` * NEW.`price`)) / (existing_qty + NEW.`qty`),
        `qty` = existing_qty + NEW.`qty`
      WHERE `userId` = NEW.`userId`
        AND `symbol` = UPPER(NEW.`symbol`)
        AND `mode` = NEW.`mode`;
    END IF;
  ELSEIF NEW.`txType` = 'SELL' THEN
    -- SELL: Reduce holdings (or create with negative if needed)
    IF existing_qty IS NULL THEN
      INSERT INTO `user_holdings` (`userId`,`symbol`,`qty`,`avgPrice`,`mode`)
      VALUES (NEW.`userId`, UPPER(NEW.`symbol`), -NEW.`qty`, NEW.`price`, NEW.`mode`);
    ELSE
      UPDATE `user_holdings`
      SET `qty` = GREATEST(existing_qty - NEW.`qty`, 0)
      WHERE `userId` = NEW.`userId`
        AND `symbol` = UPPER(NEW.`symbol`)
        AND `mode` = NEW.`mode`;
    END IF;
  END IF;
END$$

DELIMITER ;

-- =========================================================
-- stock_risk_classification
-- =========================================================
CREATE TABLE `stock_risk_classification` (
  `symbol` VARCHAR(16) NOT NULL,
  `riskLevel` ENUM('Conservative','Moderate','Aggressive') NOT NULL DEFAULT 'Moderate',
  `method` ENUM('manual','auto') NOT NULL DEFAULT 'manual',
  `note` VARCHAR(255) DEFAULT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`symbol`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `stock_risk_classification` (`symbol`, `riskLevel`, `method`, `note`)
VALUES
('TSLA','Aggressive','manual','Manual override (high volatility)'),
('NVDA','Aggressive','manual','Manual override (high volatility)')
ON DUPLICATE KEY UPDATE
  `riskLevel` = VALUES(`riskLevel`),
  `method` = VALUES(`method`),
  `note` = VALUES(`note`);

COMMIT;
