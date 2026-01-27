-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jan 21, 2026 at 06:34 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `stock_portal`
--

CREATE DATABASE IF NOT EXISTS `stock_portal` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `stock_portal`;

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

CREATE TABLE `roles` (
  `roleId` int(11) NOT NULL,
  `roleName` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `roles`
--

INSERT INTO `roles` (`roleId`, `roleName`) VALUES
(2, 'admin'),
(1, 'user');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `userId` int(11) NOT NULL,
  `username` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password` varchar(255) NOT NULL,
  `roleId` int(11) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `isFrozen` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`userId`, `username`, `email`, `password`, `roleId`, `created_at`, `isFrozen`) VALUES
(1, 'admin2', 'admin@stock.com', '$2b$10$iUb2P3.3iJ0TDx.d4fmJweF7GEsSuiDZsACAdS9xK1ykSiO4OXlZW', 2, '2025-11-23 09:34:59', 0),
(4, 'yuzhii', 'yuzhi3112@gmail.com', '$2b$10$tHIC38AAEEsEK/NP2YgwlOn4ol.GntNRo9pAF7MwQk3MVKgaacyWC', 1, '2025-11-25 09:49:34', 0),
(5, 'venom3112', 'venom3112@gmail.com', '$2b$10$X.mtqQ4umu/y4Qr/NPfyBeracSIcxNUz61Dsl0MKdMaVcYOiTraEG', 1, '2026-01-21 04:35:01', 0);

-- --------------------------------------------------------

--
-- Table structure for table `user_profiles`
--

CREATE TABLE `user_profiles` (
  `profileId` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `fullName` varchar(150) DEFAULT NULL,
  `bio` text DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `avatar` varchar(255) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `walletAddress` varchar(255) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_profiles`
--

INSERT INTO `user_profiles` (`profileId`, `userId`, `fullName`, `bio`, `phone`, `avatar`, `address`, `updated_at`) VALUES
(1, 1, 'System Admin', 'Auto-created admin account', '', NULL, '', '2026-01-16 06:37:02'),
(4, 4, 'Chan Yu Zhi', 'sscscs', '94728914', 'avatar_4_1764064247016.png', 'street 91, #03-15', '2025-11-25 09:50:47'),
(5, 5, 'venom', NULL, NULL, NULL, NULL, '2026-01-21 04:35:01');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`roleId`),
  ADD UNIQUE KEY `roleName` (`roleName`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`userId`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `fk_users_roles` (`roleId`);

--
-- Indexes for table `user_profiles`
--
ALTER TABLE `user_profiles`
  ADD PRIMARY KEY (`profileId`),
  ADD KEY `fk_profile_user` (`userId`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `roles`
--
ALTER TABLE `roles`
  MODIFY `roleId` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `userId` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `user_profiles`
--
ALTER TABLE `user_profiles`
  MODIFY `profileId` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_roles` FOREIGN KEY (`roleId`) REFERENCES `roles` (`roleId`);

--
-- Constraints for table `user_profiles`
--
ALTER TABLE `user_profiles`
  ADD CONSTRAINT `fk_profile_user` FOREIGN KEY (`userId`) REFERENCES `users` (`userId`) ON DELETE CASCADE;

-- --------------------------------------------------------

--
-- Table structure for table `user_risk_profiles`
--

CREATE TABLE `user_risk_profiles` (
  `riskProfileId` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `riskTolerance` varchar(50) DEFAULT NULL,
  `investmentExperience` varchar(50) DEFAULT NULL,
  `investmentGoal` varchar(255) DEFAULT NULL,
  `timeHorizon` varchar(50) DEFAULT NULL,
  `annualIncome` decimal(15,2) DEFAULT NULL,
  `netWorth` decimal(15,2) DEFAULT NULL,
  `age` int(11) DEFAULT NULL,
  `completedAt` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for table `user_risk_profiles`
--
ALTER TABLE `user_risk_profiles`
  ADD PRIMARY KEY (`riskProfileId`),
  ADD KEY `fk_risk_user` (`userId`);

--
-- AUTO_INCREMENT for table `user_risk_profiles`
--
ALTER TABLE `user_risk_profiles`
  MODIFY `riskProfileId` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for table `user_risk_profiles`
--
ALTER TABLE `user_risk_profiles`
  ADD CONSTRAINT `fk_risk_user` FOREIGN KEY (`userId`) REFERENCES `users` (`userId`) ON DELETE CASCADE;

-- --------------------------------------------------------

--
-- Table structure for table `accounts`
--

CREATE TABLE `accounts` (
  `accountId` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `accountNumber` varchar(50) NOT NULL,
  `accountType` varchar(50) DEFAULT 'personal',
  `accountStatus` varchar(50) DEFAULT 'active',
  `balance` decimal(15,2) DEFAULT 0.00,
  `totalInvested` decimal(15,2) DEFAULT 0.00,
  `totalReturns` decimal(15,2) DEFAULT 0.00,
  `currency` varchar(10) DEFAULT 'USD',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `account_stocks`
--

CREATE TABLE `account_stocks` (
  `accountStockId` int(11) NOT NULL,
  `accountId` int(11) NOT NULL,
  `stockSymbol` varchar(10) NOT NULL,
  `stockName` varchar(150) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 0,
  `purchasePrice` decimal(10,2) NOT NULL,
  `currentPrice` decimal(10,2) NOT NULL,
  `totalCost` decimal(15,2) NOT NULL,
  `currentValue` decimal(15,2) NOT NULL,
  `gainLoss` decimal(15,2) NOT NULL,
  `gainLossPercent` decimal(5,2) NOT NULL,
  `purchaseDate` timestamp NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for table `accounts`
--
ALTER TABLE `accounts`
  ADD PRIMARY KEY (`accountId`),
  ADD UNIQUE KEY `accountNumber` (`accountNumber`),
  ADD KEY `fk_account_user` (`userId`);

--
-- Indexes for table `account_stocks`
--
ALTER TABLE `account_stocks`
  ADD PRIMARY KEY (`accountStockId`),
  ADD KEY `fk_account_stock` (`accountId`),
  ADD KEY `stockSymbol` (`stockSymbol`);

--
-- AUTO_INCREMENT for table `accounts`
--
ALTER TABLE `accounts`
  MODIFY `accountId` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `account_stocks`
--
ALTER TABLE `account_stocks`
  MODIFY `accountStockId` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for table `accounts`
--
ALTER TABLE `accounts`
  ADD CONSTRAINT `fk_account_user` FOREIGN KEY (`userId`) REFERENCES `users` (`userId`) ON DELETE CASCADE;

--
-- Constraints for table `account_stocks`
--
ALTER TABLE `account_stocks`
  ADD CONSTRAINT `fk_account_stock` FOREIGN KEY (`accountId`) REFERENCES `accounts` (`accountId`) ON DELETE CASCADE;

-- =========================================================
-- 1) WATCHLIST TABLE (per user)
-- =========================================================
CREATE TABLE IF NOT EXISTS user_watchlist (
  watchlistId INT NOT NULL AUTO_INCREMENT,
  userId INT NOT NULL,
  symbol VARCHAR(16) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`watchlistId`),
  UNIQUE KEY uniq_user_symbol (`userId`, `symbol`),
  KEY idx_watchlist_user (`userId`),

  CONSTRAINT fk_watchlist_user
    FOREIGN KEY (`userId`) REFERENCES users (`userId`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =========================================================
-- 2) HOLDINGS TABLE (current portfolio per user)
-- =========================================================
CREATE TABLE IF NOT EXISTS user_holdings (
  holdingId INT NOT NULL AUTO_INCREMENT,
  userId INT NOT NULL,
  symbol VARCHAR(16) NOT NULL,
  qty DECIMAL(12,4) NOT NULL DEFAULT 0,
  avgPrice DECIMAL(12,4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`holdingId`),
  UNIQUE KEY uniq_hold_user_symbol (`userId`, `symbol`),
  KEY idx_holdings_user (`userId`),

  CONSTRAINT fk_holdings_user
    FOREIGN KEY (`userId`) REFERENCES users (`userId`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =========================================================
-- 3) TRANSACTION HISTORY (recommended for audit trail)
-- =========================================================
CREATE TABLE IF NOT EXISTS stock_transactions (
  txId INT NOT NULL AUTO_INCREMENT,
  userId INT NOT NULL,
  symbol VARCHAR(16) NOT NULL,

  -- Only BUY for now (you can add SELL later)
  txType ENUM('BUY','SELL') NOT NULL DEFAULT 'BUY',

  qty DECIMAL(12,4) NOT NULL,
  price DECIMAL(12,4) NOT NULL,

  -- Optional: store where the quote came from (MAS transparency)
  dataSource ENUM('finnhub','yahoo','cache') DEFAULT NULL,
  isStale TINYINT(1) NOT NULL DEFAULT 0,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`txId`),
  KEY idx_tx_user (`userId`),
  KEY idx_tx_symbol (`symbol`),

  CONSTRAINT fk_tx_user
    FOREIGN KEY (`userId`) REFERENCES users (`userId`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
