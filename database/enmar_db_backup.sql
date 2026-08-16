-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: enmar_db
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `ad_media`
--

DROP TABLE IF EXISTS `ad_media`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ad_media` (
  `id` varchar(60) NOT NULL,
  `url` varchar(500) NOT NULL,
  `type` enum('image','video') NOT NULL DEFAULT 'image',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ad_media`
--

LOCK TABLES `ad_media` WRITE;
/*!40000 ALTER TABLE `ad_media` DISABLE KEYS */;
/*!40000 ALTER TABLE `ad_media` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ads`
--

DROP TABLE IF EXISTS `ads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ads` (
  `id` varchar(60) NOT NULL,
  `tag` varchar(100) NOT NULL DEFAULT '',
  `title` varchar(200) DEFAULT '',
  `sub` varchar(300) NOT NULL DEFAULT '',
  `badge` varchar(100) NOT NULL DEFAULT '',
  `bg` longtext DEFAULT NULL,
  `category_target` varchar(120) NOT NULL DEFAULT '',
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `name` varchar(100) NOT NULL DEFAULT '',
  `image` mediumtext DEFAULT NULL,
  `image_size` int(11) NOT NULL DEFAULT 130,
  `text_color` varchar(40) NOT NULL DEFAULT '#ffffff',
  `headline` text DEFAULT NULL,
  `body` text DEFAULT NULL,
  `button_text` varchar(100) NOT NULL DEFAULT 'Shop Now →',
  `button_cat` varchar(120) NOT NULL DEFAULT 'None',
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ads`
--

LOCK TABLES `ads` WRITE;
/*!40000 ALTER TABLE `ads` DISABLE KEYS */;
INSERT INTO `ads` VALUES ('ad_1786907544199','LIMITED TIME','Up to 25% Off Fresh Himsagar','Hand-picked from Rajshahi organic orchards.','Shop Mangoes','linear-gradient(135deg,#f5a623,#f76b1c)','Fruits',1,'2026-08-16 19:12:24','Summer Organic Mango Blast',NULL,130,'#ffffff',NULL,NULL,'Shop Now →','None','2026-08-16 19:14:16');
/*!40000 ALTER TABLE `ads` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `categories` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `icon` varchar(80) NOT NULL DEFAULT 'leaf',
  `image` longtext NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `categories_name_unique` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categories`
--

LOCK TABLES `categories` WRITE;
/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `community_comments`
--

DROP TABLE IF EXISTS `community_comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `community_comments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `author_name` varchar(120) NOT NULL,
  `author_email` varchar(255) NOT NULL DEFAULT '',
  `author_role` varchar(60) NOT NULL DEFAULT 'customer',
  `text` text NOT NULL,
  `reply` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`reply`)),
  `pinned` tinyint(1) NOT NULL DEFAULT 0,
  `hidden` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `comments_hidden_pinned_index` (`hidden`,`pinned`),
  KEY `comments_user_fk` (`user_id`),
  CONSTRAINT `comments_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `community_comments`
--

LOCK TABLES `community_comments` WRITE;
/*!40000 ALTER TABLE `community_comments` DISABLE KEYS */;
INSERT INTO `community_comments` VALUES (2,5,'Guest','','customer','ENMAR provides the freshest organic groceries in Dhaka. Super fast delivery!',NULL,0,0,'2026-08-16 19:05:51','2026-08-16 19:05:51'),(3,NULL,'Guest','','customer','ENMAR provides the freshest organic groceries in Dhaka. Super fast delivery!',NULL,0,0,'2026-08-16 19:06:25','2026-08-16 19:06:25'),(4,NULL,'Guest','','customer','ENMAR provides the freshest organic groceries in Dhaka. Super fast delivery!',NULL,0,0,'2026-08-16 19:14:29','2026-08-16 19:14:29'),(6,17,'Guest','','customer','Proud to support Bangladeshi organic farmers through ENMAR! Super fast delivery in Dhanmondi.',NULL,0,0,'2026-08-16 19:34:34','2026-08-16 19:34:34'),(7,21,'Guest','','customer','Loving the quick delivery and organic freshness!',NULL,0,0,'2026-08-16 19:59:27','2026-08-16 19:59:27'),(8,23,'Guest','','customer','Loving the quick delivery and organic freshness!',NULL,0,0,'2026-08-16 20:00:05','2026-08-16 20:00:05');
/*!40000 ALTER TABLE `community_comments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customer_notifications`
--

DROP TABLE IF EXISTS `customer_notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `customer_notifications` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `target_role` varchar(30) NOT NULL DEFAULT 'all',
  `type` varchar(60) NOT NULL DEFAULT 'product_arrival',
  `title` varchar(200) NOT NULL,
  `message` text NOT NULL,
  `product_id` bigint(20) unsigned DEFAULT NULL,
  `link` varchar(500) NOT NULL DEFAULT '',
  `image` varchar(500) NOT NULL DEFAULT '',
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `notifications_user_created_index` (`user_id`,`created_at`),
  KEY `notifications_product_fk` (`product_id`),
  CONSTRAINT `notifications_product_fk` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_notifications`
--

LOCK TABLES `customer_notifications` WRITE;
/*!40000 ALTER TABLE `customer_notifications` DISABLE KEYS */;
INSERT INTO `customer_notifications` VALUES (1,NULL,'admin','new_user','👤 New Customer Registered','Notification Tester (notif.tester.1786910365532@example.com) just created an account.',NULL,'/admin/customers.html','',NULL,'2026-08-16 19:59:27'),(2,21,'customer','welcome','🌱 Welcome to ENMAR!','Thank you for joining our organic community. Enjoy fresh farm harvest delivered to your door!',NULL,'/#products','','2026-08-16 19:59:27','2026-08-16 19:59:27'),(3,NULL,'admin','comment','💬 New Community Voice Comment','Notification Tester: Loving the quick delivery and organic freshness!',NULL,'/admin/comments.html','',NULL,'2026-08-16 19:59:27'),(4,NULL,'admin','subscriber','📰 New Newsletter Subscriber','sub.1786910367499@example.com subscribed to seasonal crop updates.',NULL,'/admin/subscribers.html','',NULL,'2026-08-16 19:59:27'),(5,NULL,'all','announcement','🌾 Winter Harvest Festival is Live!','Enjoy 15% discount on seasonal winter vegetables and Sundarban honey.',NULL,'/#products','','2026-08-16 19:59:27','2026-08-16 19:59:27'),(6,NULL,'admin','new_user','👤 New Customer Registered','Customer 1 (user.1786910378035@example.com) just created an account.',NULL,'/admin/customers.html','',NULL,'2026-08-16 19:59:40'),(7,22,'customer','welcome','🌱 Welcome to ENMAR!','Thank you for joining our organic community. Enjoy fresh farm harvest delivered to your door!',NULL,'/#products','',NULL,'2026-08-16 19:59:40'),(8,NULL,'admin','new_user','👤 New Customer Registered','Notification Tester (notif.tester.1786910403066@example.com) just created an account.',NULL,'/admin/customers.html','',NULL,'2026-08-16 20:00:05'),(9,23,'customer','welcome','🌱 Welcome to ENMAR!','Thank you for joining our organic community. Enjoy fresh farm harvest delivered to your door!',NULL,'/#products','','2026-08-16 20:00:05','2026-08-16 20:00:05'),(10,NULL,'admin','order_placed','🛒 New Order #ORD-1786910405012-8898','Order of ৳910 placed by Notification Tester',NULL,'/admin/orders.html','',NULL,'2026-08-16 20:00:05'),(11,23,'customer','order_placed','📦 Order #ORD-1786910405012-8898 Placed!','Thank you! Your order for ৳910 has been received.',NULL,'/pages/my-orders.html','','2026-08-16 20:00:05','2026-08-16 20:00:05'),(12,NULL,'admin','order_message','💬 Message on Order #ORD-1786910405012-8898','Notification Tester: Please pack in eco-friendly carton',NULL,'/admin/orders.html','',NULL,'2026-08-16 20:00:05'),(13,23,'customer','order_message','💬 Support Reply on Order #ORD-1786910405012-8898','Super Administrator: Sure! Your produce is packed with organic wrap.',NULL,'/pages/my-orders.html','','2026-08-16 20:00:05','2026-08-16 20:00:05'),(14,23,'customer','order_status','✅ Order Confirmed — Delivery in 4 Hours!','Your order #ORD-1786910405012-8898 has been confirmed! Auto delivery countdown is active.',NULL,'/pages/my-orders.html','','2026-08-16 20:00:05','2026-08-16 20:00:05'),(15,NULL,'admin','review','⭐ New 5★ Review','Notification Tester: Crisp, sweet organic produce!',NULL,'/admin/reviews.html','',NULL,'2026-08-16 20:00:05'),(16,NULL,'admin','comment','💬 New Community Voice Comment','Notification Tester: Loving the quick delivery and organic freshness!',NULL,'/admin/comments.html','',NULL,'2026-08-16 20:00:05'),(17,NULL,'admin','subscriber','📰 New Newsletter Subscriber','sub.1786910405071@example.com subscribed to seasonal crop updates.',NULL,'/admin/subscribers.html','',NULL,'2026-08-16 20:00:05'),(18,NULL,'all','announcement','🌾 Winter Harvest Festival is Live!','Enjoy 15% discount on seasonal winter vegetables and Sundarban honey.',NULL,'/#products','','2026-08-16 20:00:05','2026-08-16 20:00:05'),(19,NULL,'admin','order_placed','🛒 New Order #ORD-1786910415275-3582','Order of ৳792 placed by Audit Customer',NULL,'/admin/orders.html','',NULL,'2026-08-16 20:00:15'),(20,24,'customer','order_placed','📦 Order #ORD-1786910415275-3582 Placed!','Thank you! Your order for ৳792 has been received.',NULL,'/pages/my-orders.html','',NULL,'2026-08-16 20:00:15'),(21,NULL,'admin','order_message','💬 Message on Order #ORD-1786910415275-3582','Audit Customer: Please deliver after 4 PM.',NULL,'/admin/orders.html','',NULL,'2026-08-16 20:00:15'),(22,NULL,'admin','order_placed','🛒 New Order #ORD-1786910887923-9453','Order of ৳792 placed by Audit Customer',NULL,'/admin/orders.html','',NULL,'2026-08-16 20:08:07'),(23,25,'customer','order_placed','📦 Order #ORD-1786910887923-9453 Placed!','Thank you! Your order for ৳792 has been received.',NULL,'/pages/my-orders.html','',NULL,'2026-08-16 20:08:07'),(24,NULL,'admin','order_message','💬 Message on Order #ORD-1786910887923-9453','Audit Customer: Please deliver after 4 PM.',NULL,'/admin/orders.html','',NULL,'2026-08-16 20:08:07'),(25,NULL,'admin','subscriber','📰 New Newsletter Subscriber','dd@gmail.com subscribed to seasonal crop updates.',NULL,'/admin/subscribers.html','',NULL,'2026-08-16 20:08:44'),(26,NULL,'admin','order_placed','🛒 New Order #ORD-1786911345307-4534','Order of ৳792 placed by Audit Customer',NULL,'/admin/orders.html','',NULL,'2026-08-16 20:15:45'),(27,26,'customer','order_placed','📦 Order #ORD-1786911345307-4534 Placed!','Thank you! Your order for ৳792 has been received.',NULL,'/pages/my-orders.html','',NULL,'2026-08-16 20:15:45'),(28,NULL,'admin','order_message','💬 Message on Order #ORD-1786911345307-4534','Audit Customer: Please deliver after 4 PM.',NULL,'/admin/orders.html','',NULL,'2026-08-16 20:15:45');
/*!40000 ALTER TABLE `customer_notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `email_gateway_config`
--

DROP TABLE IF EXISTS `email_gateway_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `email_gateway_config` (
  `id` tinyint(3) unsigned NOT NULL DEFAULT 1,
  `provider` varchar(60) NOT NULL DEFAULT 'smtp',
  `host` varchar(200) NOT NULL,
  `port` smallint(5) unsigned NOT NULL DEFAULT 587,
  `username` varchar(300) NOT NULL DEFAULT '',
  `password_encrypted` longtext NOT NULL,
  `from_email` varchar(255) NOT NULL DEFAULT '',
  `from_name` varchar(120) NOT NULL DEFAULT 'ENMAR',
  `use_tls` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_by_admin_id` bigint(20) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `email_gateway_config`
--

LOCK TABLES `email_gateway_config` WRITE;
/*!40000 ALTER TABLE `email_gateway_config` DISABLE KEYS */;
INSERT INTO `email_gateway_config` VALUES (1,'smtp','smtp.gmail.com',465,'mdhourira6712@gmail.com','abcdefghijklmnop','mdhourira6712@gmail.com','ENMAR Official',1,'2026-08-16 18:59:39','2026-08-16 18:59:39',NULL);
/*!40000 ALTER TABLE `email_gateway_config` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_items`
--

DROP TABLE IF EXISTS `order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `order_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint(20) unsigned NOT NULL,
  `product_id` bigint(20) unsigned DEFAULT NULL,
  `product_name` varchar(200) NOT NULL,
  `unit_price` decimal(10,2) unsigned NOT NULL,
  `quantity` smallint(5) unsigned NOT NULL,
  `unit` varchar(60) NOT NULL DEFAULT 'kg',
  `total_price` decimal(10,2) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `order_items_order_fk` (`order_id`),
  KEY `order_items_product_fk` (`product_id`),
  CONSTRAINT `order_items_order_fk` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `order_items_product_fk` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_items`
--

LOCK TABLES `order_items` WRITE;
/*!40000 ALTER TABLE `order_items` DISABLE KEYS */;
INSERT INTO `order_items` VALUES (3,3,4,'Sundarban Raw Organic Honey',950.00,2,'500g jar',1900.00),(4,3,5,'Cold Pressed Pure Mustard Oil',380.00,1,'1 Litre',380.00),(5,4,8,'Sundarban Raw Organic Honey',855.00,2,'500g jar',1710.00),(6,4,9,'Cold Pressed Pure Mustard Oil',361.00,1,'1 Litre',361.00),(12,9,15,'Organic Premium Nazirshail Rice',420.00,2,'5kg pack',840.00),(14,11,15,'Organic Premium Nazirshail Rice',420.00,1,'5kg pack',420.00),(15,12,15,'Organic Premium Nazirshail Rice',420.00,1,'5kg pack',420.00),(18,15,15,'Organic Premium Nazirshail Rice',420.00,2,'5kg pack',840.00);
/*!40000 ALTER TABLE `order_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `orders` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_number` varchar(40) NOT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `customer_name` varchar(120) NOT NULL,
  `customer_phone` varchar(30) NOT NULL,
  `delivery_address` varchar(500) NOT NULL,
  `delivery_city` varchar(120) NOT NULL,
  `delivery_zip` varchar(30) NOT NULL DEFAULT '',
  `delivery_notes` text DEFAULT NULL,
  `payment_method` enum('Cash on Delivery','bKash','Nagad') NOT NULL DEFAULT 'Cash on Delivery',
  `subtotal` decimal(10,2) unsigned NOT NULL,
  `shipping` decimal(10,2) unsigned NOT NULL,
  `total` decimal(10,2) unsigned NOT NULL,
  `status` enum('Pending','Confirmed','Processing','Shipped','Delivered','Cancelled') NOT NULL DEFAULT 'Pending',
  `estimated_delivery` varchar(120) NOT NULL DEFAULT '24–48 hours',
  `order_message` text DEFAULT NULL,
  `conversation` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`conversation`)),
  `customer_hidden` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `orders_number_unique` (`order_number`),
  KEY `orders_user_created_index` (`user_id`,`created_at`),
  KEY `orders_status_index` (`status`),
  CONSTRAINT `orders_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
INSERT INTO `orders` VALUES (3,'ORD-1786907151805-8295',5,'Rahim Ahmed','01819998877','House 42, Road 11, Block D, Banani','Dhaka','','Please call before arrival. Fragile glass jar items.','Cash on Delivery',2280.00,0.00,2280.00,'Shipped','2026-08-17T19:07:00.000Z','','{\"conversation\":[{\"id\":1786907151823,\"text\":\"Hello, please ensure the honey jar is bubble-wrapped securely.\",\"message\":\"Hello, please ensure the honey jar is bubble-wrapped securely.\",\"sender\":\"customer\",\"senderName\":\"Rahim Ahmed\",\"timestamp\":\"2026-08-16T19:05:51.823Z\"},{\"id\":1786907151831,\"text\":\"Dear Rahim, we have added extra bubble-wrap and fragile tags. Delivery dispatching tomorrow!\",\"message\":\"Dear Rahim, we have added extra bubble-wrap and fragile tags. Delivery dispatching tomorrow!\",\"sender\":\"staff\",\"senderName\":\"Super Administrator\",\"timestamp\":\"2026-08-16T19:05:51.831Z\"}],\"history\":[{\"id\":1,\"action\":\"Order Placed\",\"detail\":\"Order placed via Cash on Delivery\",\"actor\":\"customer\",\"actorName\":\"Rahim Ahmed\",\"timestamp\":\"2026-08-16T19:05:51.000Z\"}],\"messages\":[{\"id\":1786907151823,\"text\":\"Hello, please ensure the honey jar is bubble-wrapped securely.\",\"message\":\"Hello, please ensure the honey jar is bubble-wrapped securely.\",\"sender\":\"customer\",\"senderName\":\"Rahim Ahmed\",\"timestamp\":\"2026-08-16T19:05:51.823Z\"},{\"id\":1786907151831,\"text\":\"Dear Rahim, we have added extra bubble-wrap and fragile tags. Delivery dispatching tomorrow!\",\"message\":\"Dear Rahim, we have added extra bubble-wrap and fragile tags. Delivery dispatching tomorrow!\",\"sender\":\"staff\",\"senderName\":\"Super Administrator\",\"timestamp\":\"2026-08-16T19:05:51.831Z\"}],\"cancelledBy\":null,\"cancelledAt\":null,\"cancelReason\":\"\"}',0,'2026-08-16 19:05:51','2026-08-16 19:07:31'),(4,'ORD-1786907185566-9571',NULL,'Rahim Ahmed','01819998877','House 42, Road 11, Block D, Banani','Dhaka','','Please call before arrival. Fragile glass jar items.','Cash on Delivery',2071.00,0.00,2071.00,'Confirmed','2026-08-16T23:43:54.805Z','','{\"conversation\":[{\"id\":1786907185580,\"text\":\"Hello, please ensure the honey jar is bubble-wrapped securely.\",\"message\":\"Hello, please ensure the honey jar is bubble-wrapped securely.\",\"sender\":\"customer\",\"senderName\":\"Rahim Ahmed\",\"timestamp\":\"2026-08-16T19:06:25.580Z\"},{\"id\":1786907185587,\"text\":\"Dear Rahim, we have added extra bubble-wrap and fragile tags. Delivery dispatching tomorrow!\",\"message\":\"Dear Rahim, we have added extra bubble-wrap and fragile tags. Delivery dispatching tomorrow!\",\"sender\":\"staff\",\"senderName\":\"Super Administrator\",\"timestamp\":\"2026-08-16T19:06:25.587Z\"}],\"history\":[{\"id\":1,\"action\":\"Order Placed\",\"detail\":\"Order placed via Cash on Delivery\",\"actor\":\"customer\",\"actorName\":\"Rahim Ahmed\",\"timestamp\":\"2026-08-16T19:06:25.000Z\"},{\"id\":1786909434805,\"action\":\"Status: Confirmed\",\"detail\":\"Order updated by Jamal Store Manager (Auto delivery countdown: 4h)\",\"actor\":\"staff\",\"actorName\":\"Jamal Store Manager\",\"timestamp\":\"2026-08-16T19:43:54.805Z\"}],\"messages\":[{\"id\":1786907185580,\"text\":\"Hello, please ensure the honey jar is bubble-wrapped securely.\",\"message\":\"Hello, please ensure the honey jar is bubble-wrapped securely.\",\"sender\":\"customer\",\"senderName\":\"Rahim Ahmed\",\"timestamp\":\"2026-08-16T19:06:25.580Z\"},{\"id\":1786907185587,\"text\":\"Dear Rahim, we have added extra bubble-wrap and fragile tags. Delivery dispatching tomorrow!\",\"message\":\"Dear Rahim, we have added extra bubble-wrap and fragile tags. Delivery dispatching tomorrow!\",\"sender\":\"staff\",\"senderName\":\"Super Administrator\",\"timestamp\":\"2026-08-16T19:06:25.587Z\"}],\"cancelledBy\":null,\"cancelledAt\":null,\"cancelReason\":\"\",\"confirmedAt\":\"2026-08-16T19:43:54.805Z\",\"confirmedBy\":\"Jamal Store Manager\"}',0,'2026-08-16 19:06:25','2026-08-16 19:43:54'),(9,'ORD-1786908874448-1537',17,'Tanvir Hasan','01899887766','Flat 4B, Green Lake Apartments, Dhanmondi 27','Dhaka','','Please ring the doorbell twice.','Cash on Delivery',840.00,80.00,920.00,'Pending','24-48 hours','','{\"conversation\":[{\"id\":1786908874475,\"text\":\"Please ensure fresh morning harvest packaging. Thank you!\",\"message\":\"Please ensure fresh morning harvest packaging. Thank you!\",\"sender\":\"customer\",\"senderName\":\"Tanvir Hasan (Verified Buyer)\",\"timestamp\":\"2026-08-16T19:34:34.475Z\"}],\"history\":[{\"id\":1,\"action\":\"Order Placed\",\"detail\":\"Order placed via Cash on Delivery\",\"actor\":\"customer\",\"actorName\":\"Tanvir Hasan\",\"timestamp\":\"2026-08-16T19:34:34.000Z\"}],\"messages\":[{\"id\":1786908874475,\"text\":\"Please ensure fresh morning harvest packaging. Thank you!\",\"message\":\"Please ensure fresh morning harvest packaging. Thank you!\",\"sender\":\"customer\",\"senderName\":\"Tanvir Hasan (Verified Buyer)\",\"timestamp\":\"2026-08-16T19:34:34.475Z\"}],\"cancelledBy\":null,\"cancelledAt\":null,\"cancelReason\":\"\"}',0,'2026-08-16 19:34:34','2026-08-16 19:34:34'),(11,'ORD-1786909327758-3334',1,'Countdown Test Customer','01711002233','House 10, Road 5, Banani','Dhaka','','','Cash on Delivery',420.00,80.00,500.00,'Confirmed','2026-08-16T23:42:07.773Z','','{\"conversation\":[],\"history\":[{\"id\":1,\"action\":\"Order Placed\",\"detail\":\"Order placed via Cash on Delivery\",\"actor\":\"customer\",\"actorName\":\"Countdown Test Customer\",\"timestamp\":\"2026-08-16T19:42:07.000Z\"},{\"id\":1786909327773,\"action\":\"Status: Confirmed\",\"detail\":\"Order updated by Super Administrator (Auto delivery countdown: 4h)\",\"actor\":\"staff\",\"actorName\":\"Super Administrator\",\"timestamp\":\"2026-08-16T19:42:07.773Z\"}],\"messages\":[],\"cancelledBy\":null,\"cancelledAt\":null,\"cancelReason\":\"\",\"confirmedAt\":\"2026-08-16T19:42:07.773Z\",\"confirmedBy\":\"Super Administrator\"}',0,'2026-08-16 19:42:07','2026-08-16 19:42:07'),(12,'ORD-1786909327803-8614',1,'Test User 2','01700000000','Mirpur 10','Dhaka','','','Cash on Delivery',420.00,80.00,500.00,'Confirmed','2026-08-17T01:42:07.811Z','','{\"conversation\":[],\"history\":[{\"id\":1,\"action\":\"Order Placed\",\"detail\":\"Order placed via Cash on Delivery\",\"actor\":\"customer\",\"actorName\":\"Test User 2\",\"timestamp\":\"2026-08-16T19:42:07.000Z\"},{\"id\":1786909327811,\"action\":\"Status: Confirmed\",\"detail\":\"Order updated by Super Administrator (Auto delivery countdown: 6h)\",\"actor\":\"staff\",\"actorName\":\"Super Administrator\",\"timestamp\":\"2026-08-16T19:42:07.811Z\"}],\"messages\":[],\"cancelledBy\":null,\"cancelledAt\":null,\"cancelReason\":\"\",\"confirmedAt\":\"2026-08-16T19:42:07.811Z\",\"confirmedBy\":\"Super Administrator\"}',0,'2026-08-16 19:42:07','2026-08-16 19:42:07'),(15,'ORD-1786910405012-8898',23,'Customer','01700998877','House 5, Dhanmondi, Dhaka','','','','',840.00,70.00,910.00,'Confirmed','2026-08-17T00:00:05.046Z','','{\"conversation\":[{\"id\":1786910405028,\"text\":\"Please pack in eco-friendly carton\",\"message\":\"Please pack in eco-friendly carton\",\"sender\":\"customer\",\"senderName\":\"Notification Tester\",\"timestamp\":\"2026-08-16T20:00:05.028Z\"},{\"id\":1786910405037,\"text\":\"Sure! Your produce is packed with organic wrap.\",\"message\":\"Sure! Your produce is packed with organic wrap.\",\"sender\":\"staff\",\"senderName\":\"Super Administrator\",\"timestamp\":\"2026-08-16T20:00:05.037Z\"}],\"history\":[{\"id\":1,\"action\":\"Order Placed\",\"detail\":\"Order placed via Cash on Delivery\",\"actor\":\"customer\",\"actorName\":\"Customer\",\"timestamp\":\"2026-08-16T20:00:05.000Z\"},{\"id\":1786910405046,\"action\":\"Status: Confirmed\",\"detail\":\"Order updated by Super Administrator (Auto delivery countdown: 4h)\",\"actor\":\"staff\",\"actorName\":\"Super Administrator\",\"timestamp\":\"2026-08-16T20:00:05.046Z\"}],\"messages\":[{\"id\":1786910405028,\"text\":\"Please pack in eco-friendly carton\",\"message\":\"Please pack in eco-friendly carton\",\"sender\":\"customer\",\"senderName\":\"Notification Tester\",\"timestamp\":\"2026-08-16T20:00:05.028Z\"},{\"id\":1786910405037,\"text\":\"Sure! Your produce is packed with organic wrap.\",\"message\":\"Sure! Your produce is packed with organic wrap.\",\"sender\":\"staff\",\"senderName\":\"Super Administrator\",\"timestamp\":\"2026-08-16T20:00:05.037Z\"}],\"cancelledBy\":null,\"cancelledAt\":null,\"cancelReason\":\"\",\"confirmedAt\":\"2026-08-16T20:00:05.046Z\",\"confirmedBy\":\"Super Administrator\"}',0,'2026-08-16 20:00:05','2026-08-16 20:00:05');
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `products` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `farm` varchar(200) NOT NULL,
  `price` decimal(10,2) unsigned NOT NULL,
  `unit` varchar(60) NOT NULL,
  `category` varchar(120) NOT NULL,
  `icon` varchar(60) NOT NULL DEFAULT 'leaf',
  `tag` varchar(100) NOT NULL DEFAULT '',
  `lot` varchar(60) NOT NULL DEFAULT '',
  `discount` decimal(5,2) unsigned NOT NULL DEFAULT 0.00,
  `description` longtext DEFAULT NULL,
  `images` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`images`)),
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `products_category_active_index` (`category`,`active`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (4,'Sundarban Raw Organic Honey','Sundarban Forest API Co-op',950.00,'500g jar','Honey & Sweeteners','droplet','','',0.00,'','[]',1,'2026-08-16 19:05:51','2026-08-16 19:05:51'),(5,'Cold Pressed Pure Mustard Oil','Natore Organic Agro',380.00,'1 Litre','Oils & Ghee','sun','','',0.00,'','[]',1,'2026-08-16 19:05:51','2026-08-16 19:05:51'),(6,'Organic Premium Nazirshail Rice','Dinajpur Heritage Farms',420.00,'5kg pack','Rice & Grains','box','','',0.00,'','[]',1,'2026-08-16 19:05:51','2026-08-16 19:05:51'),(8,'Sundarban Raw Organic Honey','Sundarban Forest API Co-op',950.00,'500g jar','Honey & Sweeteners','droplet','','',10.00,'100% pure unfiltered raw wild honey collected directly from Sundarban mangrove forest.','[]',1,'2026-08-16 19:06:25','2026-08-16 19:06:25'),(9,'Cold Pressed Pure Mustard Oil','Natore Organic Agro',380.00,'1 Litre','Oils & Ghee','sun','','',5.00,'Traditional wood-pressed (Ghani-bhanga) pure mustard oil with pungent natural aroma.','[]',1,'2026-08-16 19:06:25','2026-08-16 19:06:25'),(10,'Organic Premium Nazirshail Rice','Dinajpur Heritage Farms',420.00,'5kg pack','Rice & Grains','box','','',0.00,'Aromatic unpolished long-grain organic Nazirshail rice with high fiber content.','[]',1,'2026-08-16 19:06:25','2026-08-16 19:06:25'),(15,'Organic Premium Nazirshail Rice','Dinajpur Heritage Farms',420.00,'5kg pack','Rice & Grains','box','','',0.00,'Aromatic unpolished long-grain organic Nazirshail rice with high fiber content.','[]',1,'2026-08-16 19:14:29','2026-08-16 19:14:29'),(25,'Organic Product','',0.00,'kg','General','leaf','','',0.00,'','[]',1,'2026-08-16 20:05:54','2026-08-16 20:05:54');
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `recycle_bin`
--

DROP TABLE IF EXISTS `recycle_bin`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `recycle_bin` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `type` varchar(40) NOT NULL,
  `original_id` bigint(20) unsigned NOT NULL,
  `title` varchar(300) NOT NULL DEFAULT '',
  `subtitle` varchar(500) NOT NULL DEFAULT '',
  `data` longtext DEFAULT NULL,
  `deleted_by` varchar(120) NOT NULL DEFAULT 'System',
  `deleted_by_email` varchar(255) NOT NULL DEFAULT '',
  `deleted_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `expires_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `recycle_bin_type_index` (`type`),
  KEY `recycle_bin_deleted_at_index` (`deleted_at`)
) ENGINE=InnoDB AUTO_INCREMENT=46 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `recycle_bin`
--

LOCK TABLES `recycle_bin` WRITE;
/*!40000 ALTER TABLE `recycle_bin` DISABLE KEYS */;
INSERT INTO `recycle_bin` VALUES (14,'user',16,'Audit Customer','customer_1786908197412@example.com (customer)','{\"id\":16,\"name\":\"Audit Customer\",\"email\":\"customer_1786908197412@example.com\",\"phone\":\"\",\"avatar\":\"\",\"designation\":\"\",\"bio\":\"\",\"address\":\"\",\"city\":\"\",\"zip\":\"\",\"notes\":\"\",\"role\":\"customer\",\"active\":true,\"passwordHash\":\"386a5453c5317c3a4122873d79c95906:6e63e45624ab1e00d4118d83a7e9f35cb91bb1ccf5dd475c04b153b3cb3423bf4ec1151827b7dd2b414ba5ae7724f7158f7eeb2a54df5ea9375a210d1348a240\",\"createdAt\":\"2026-08-16T19:23:17.000Z\"}','Super Administrator','mdhourira6712@gmail.com','2026-08-16 19:23:17','2026-09-15 19:23:17'),(15,'category',4,'vbbcv','Product Category','{\"id\":4,\"name\":\"vbbcv\",\"icon\":\"leaf\",\"image\":\"\",\"createdAt\":\"2026-08-16T19:17:49.000Z\"}','Super Administrator','mdhourira6712@gmail.com','2026-08-16 19:24:19','2026-09-15 19:24:19'),(16,'category',6,'vbcbv','Product Category','{\"id\":6,\"name\":\"vbcbv\",\"icon\":\"leaf\",\"image\":\"\",\"createdAt\":\"2026-08-16T19:17:53.000Z\"}','Super Administrator','mdhourira6712@gmail.com','2026-08-16 19:24:47','2026-09-15 19:24:47'),(17,'product',1,'Fresh Organic Mango','৳480 · Fruits','{\"id\":1,\"name\":\"Fresh Organic Mango\",\"farm\":\"Rajshahi Orchard\",\"price\":480,\"unit\":\"kg\",\"cat\":\"Fruits\",\"category\":\"Fruits\",\"icon\":\"leaf\",\"tag\":\"\",\"lot\":\"\",\"discount\":0,\"description\":\"\",\"images\":[],\"active\":true,\"createdAt\":\"2026-08-16T18:54:15.000Z\"}','Super Administrator','mdhourira6712@gmail.com','2026-08-16 19:25:26','2026-09-15 19:25:26'),(18,'product',14,'Cold Pressed Pure Mustard Oil','৳380 · Oils & Ghee','{\"id\":14,\"name\":\"Cold Pressed Pure Mustard Oil\",\"farm\":\"Natore Organic Agro\",\"price\":380,\"unit\":\"1 Litre\",\"cat\":\"Oils & Ghee\",\"category\":\"Oils & Ghee\",\"icon\":\"sun\",\"tag\":\"\",\"lot\":\"\",\"discount\":5,\"description\":\"Traditional wood-pressed (Ghani-bhanga) pure mustard oil with pungent natural aroma.\",\"images\":[],\"active\":true,\"createdAt\":\"2026-08-16T19:14:28.000Z\"}','Super Administrator','mdhourira6712@gmail.com','2026-08-16 19:26:37','2026-09-15 19:26:37'),(19,'product',13,'Sundarban Raw Organic Honey','৳950 · Honey & Sweeteners','{\"id\":13,\"name\":\"Sundarban Raw Organic Honey\",\"farm\":\"Sundarban Forest API Co-op\",\"price\":950,\"unit\":\"500g jar\",\"cat\":\"Honey & Sweeteners\",\"category\":\"Honey & Sweeteners\",\"icon\":\"droplet\",\"tag\":\"\",\"lot\":\"\",\"discount\":10,\"description\":\"100% pure unfiltered raw wild honey collected directly from Sundarban mangrove forest.\",\"images\":[],\"active\":true,\"createdAt\":\"2026-08-16T19:14:28.000Z\"}','Super Administrator','mdhourira6712@gmail.com','2026-08-16 19:27:27','2026-09-15 19:27:27'),(20,'user',7,'Rahim Ahmed','customer_audit_1786907185455@gmail.com (customer)','{\"id\":7,\"name\":\"Rahim Ahmed\",\"email\":\"customer_audit_1786907185455@gmail.com\",\"phone\":\"\",\"avatar\":\"\",\"designation\":\"\",\"bio\":\"\",\"address\":\"\",\"city\":\"\",\"zip\":\"\",\"notes\":\"\",\"role\":\"customer\",\"active\":true,\"passwordHash\":\"3ed36e2e460769a4a080aa56a3b62efe:8c503f40f0a23e980104a8ef546a0176fa820cd30a8f6df917997b3fab7eb96c2b513921404d4e9fc2f92464cfdfb5a8077dcda0bd3d39b5baf41475ddb67eca\",\"createdAt\":\"2026-08-16T19:06:25.000Z\"}','Super Administrator','mdhourira6712@gmail.com','2026-08-16 19:28:01','2026-09-15 19:28:01'),(21,'user',15,'Moderator Kabir','auditor_staff_1786908190317@enmar.bd (moderator)','{\"id\":15,\"name\":\"Moderator Kabir\",\"email\":\"auditor_staff_1786908190317@enmar.bd\",\"phone\":\"\",\"avatar\":\"\",\"designation\":\"\",\"bio\":\"\",\"address\":\"\",\"city\":\"\",\"zip\":\"\",\"notes\":\"\",\"role\":\"moderator\",\"active\":true,\"passwordHash\":\"3915f9fecaf9ad7442f5ea3f42e62b20:2b284b08471c6f87c947642d3379a9f9a0561692537e0fb0160c8efaf69158f883fedf53c6721a22fb823b0b22d84a28f3037ad33bc8b5614a00223831784592\",\"createdAt\":\"2026-08-16T19:23:10.000Z\"}','Super Administrator','mdhourira6712@gmail.com','2026-08-16 19:29:06','2026-09-15 19:29:06'),(22,'user',12,'Jamal Store Manager','manager_1786907669030@enmar.bd (manager)','{\"id\":12,\"name\":\"Jamal Store Manager\",\"email\":\"manager_1786907669030@enmar.bd\",\"phone\":\"\",\"avatar\":\"\",\"designation\":\"\",\"bio\":\"\",\"address\":\"\",\"city\":\"\",\"zip\":\"\",\"notes\":\"\",\"role\":\"manager\",\"active\":true,\"passwordHash\":\"d1e5951588887734e88ce55b1fe37df6:92286fdab00ca4a798767e4071ab7ec98fb9ca39d4ce451af50ddebcace7a48d64b5e872a8f8b099e9d64d1a9debe374c3393bd70cf0843f23e0d07c72212eef\",\"createdAt\":\"2026-08-16T19:14:29.000Z\"}','Super Administrator','mdhourira6712@gmail.com','2026-08-16 19:29:08','2026-09-15 19:29:08'),(23,'user',11,'Moderator Kabir','auditor_staff_1786907665495@enmar.bd (moderator)','{\"id\":11,\"name\":\"Moderator Kabir\",\"email\":\"auditor_staff_1786907665495@enmar.bd\",\"phone\":\"\",\"avatar\":\"\",\"designation\":\"\",\"bio\":\"\",\"address\":\"\",\"city\":\"\",\"zip\":\"\",\"notes\":\"\",\"role\":\"moderator\",\"active\":true,\"passwordHash\":\"d5398345321f2613d068916bd7338928:fc0517dd9dfd9296e379b136920dbe80868ce90c8fb28060b559b71e497db03fbe8cfb961b15c2c61ab01f171eafa953aa954ddb2e323a635bb36c5359d361ed\",\"createdAt\":\"2026-08-16T19:14:25.000Z\"}','Super Administrator','mdhourira6712@gmail.com','2026-08-16 19:29:11','2026-09-15 19:29:11'),(24,'user',10,'Moderator Kabir','auditor_staff_1786907613104@enmar.bd (moderator)','{\"id\":10,\"name\":\"Moderator Kabir\",\"email\":\"auditor_staff_1786907613104@enmar.bd\",\"phone\":\"\",\"avatar\":\"\",\"designation\":\"\",\"bio\":\"\",\"address\":\"\",\"city\":\"\",\"zip\":\"\",\"notes\":\"\",\"role\":\"moderator\",\"active\":true,\"passwordHash\":\"f2bc5579a5f5dc3f4fa304cae0caa4c4:c7f5523013f93e9e364390dd97bd288a233d2b6004b9d753129ada62290fce40b32d38987679e8efaa4ea694eaa939cb6bc2227cf2d7afe407b41dfc3dab7c47\",\"createdAt\":\"2026-08-16T19:13:33.000Z\"}','Super Administrator','mdhourira6712@gmail.com','2026-08-16 19:29:14','2026-09-15 19:29:14'),(25,'user',9,'Moderator Kabir','auditor_staff_1786907544125@enmar.bd (moderator)','{\"id\":9,\"name\":\"Moderator Kabir\",\"email\":\"auditor_staff_1786907544125@enmar.bd\",\"phone\":\"\",\"avatar\":\"\",\"designation\":\"\",\"bio\":\"\",\"address\":\"\",\"city\":\"\",\"zip\":\"\",\"notes\":\"\",\"role\":\"moderator\",\"active\":true,\"passwordHash\":\"6f4f120f63f53ec55b0a227cf7409f61:4118c145570e6dc72cb817af0702a198eee98c49dbc104a7978a8180d2798623285077ea167fea3cd09b86063ccbf2638c9d935ba7886fddab4ee829eab953f5\",\"createdAt\":\"2026-08-16T19:12:24.000Z\"}','Super Administrator','mdhourira6712@gmail.com','2026-08-16 19:29:18','2026-09-15 19:29:18'),(26,'user',4,'Jamal Store Manager','manager_1786907151586@enmar.bd (manager)','{\"id\":4,\"name\":\"Jamal Store Manager\",\"email\":\"manager_1786907151586@enmar.bd\",\"phone\":\"\",\"avatar\":\"\",\"designation\":\"\",\"bio\":\"\",\"address\":\"\",\"city\":\"\",\"zip\":\"\",\"notes\":\"\",\"role\":\"manager\",\"active\":true,\"passwordHash\":\"4fe9bfdda39a2a09407cd82740881872:aefb876c7eb4e5daff417c1dd4ac322b8ba329c7462dc6fe3cc1e406ff3bc1f9013a443f45b4aa41d042b29e09a25fe48875ad8ab17e443e9c9dd16946f4b121\",\"createdAt\":\"2026-08-16T19:05:51.000Z\"}','Super Administrator','mdhourira6712@gmail.com','2026-08-16 19:29:21','2026-09-15 19:29:21'),(29,'user',18,'Audit Customer','customer_1786908879633@example.com (customer)','{\"id\":18,\"name\":\"Audit Customer\",\"email\":\"customer_1786908879633@example.com\",\"phone\":\"\",\"avatar\":\"\",\"designation\":\"\",\"bio\":\"\",\"address\":\"\",\"city\":\"\",\"zip\":\"\",\"notes\":\"\",\"role\":\"customer\",\"active\":true,\"passwordHash\":\"e33cf52c3859a61cdcc6793793abc04c:2fb01baef9dc0875ce3051bbdc0987040929f1e1dcb3267298d1966a075d1e67a29d5c7ddb2a91380ac179b6c102144aaef20a8b530bc21053c695860236fa52\",\"createdAt\":\"2026-08-16T19:34:39.000Z\"}','Super Administrator','mdhourira6712@gmail.com','2026-08-16 19:34:40','2026-09-15 19:34:40'),(33,'user',19,'Audit Customer','customer_1786909331871@example.com (customer)','{\"id\":19,\"name\":\"Audit Customer\",\"email\":\"customer_1786909331871@example.com\",\"phone\":\"\",\"avatar\":\"\",\"designation\":\"\",\"bio\":\"\",\"address\":\"\",\"city\":\"\",\"zip\":\"\",\"notes\":\"\",\"role\":\"customer\",\"active\":true,\"passwordHash\":\"d0382e9d0f85a85e8d36cc6e5a32c667:b85b28c3aca4547802068d54780a330121be5b0b45210d98f18e321b00c63850d0f369663b933783a8711498fa1c150bd806da64ac5ff7dbd538e9b7ad24e6de\",\"createdAt\":\"2026-08-16T19:42:11.000Z\"}','Super Administrator','mdhourira6712@gmail.com','2026-08-16 19:42:12','2026-09-15 19:42:12'),(36,'user',20,'Audit Customer','customer_1786909841706@example.com (customer)','{\"id\":20,\"name\":\"Audit Customer\",\"email\":\"customer_1786909841706@example.com\",\"phone\":\"\",\"avatar\":\"\",\"designation\":\"\",\"bio\":\"\",\"address\":\"\",\"city\":\"\",\"zip\":\"\",\"notes\":\"\",\"role\":\"customer\",\"active\":true,\"passwordHash\":\"808d90836151116d22e329bd56d76019:9f8d9a25c613c9bba323da97ee05f01c962fc934fc42c36e6748898ecdc4b8d3d37cbf817a53b4eeca911c69d41fec68ab87dec4b73edc8926008b98684f1128\",\"createdAt\":\"2026-08-16T19:50:41.000Z\"}','Super Administrator','mdhourira6712@gmail.com','2026-08-16 19:50:42','2026-09-15 19:50:42'),(39,'user',24,'Audit Customer','customer_1786910415140@example.com (customer)','{\"id\":24,\"name\":\"Audit Customer\",\"email\":\"customer_1786910415140@example.com\",\"phone\":\"\",\"avatar\":\"\",\"designation\":\"\",\"bio\":\"\",\"address\":\"\",\"city\":\"\",\"zip\":\"\",\"notes\":\"\",\"role\":\"customer\",\"active\":true,\"passwordHash\":\"0603c8072366416702b2ed9f00abd080:64f1635a4dc549fcb13806ef63905d1435eaf97117743f5d20665b70f9dc392bfec09d4058b899b55fcb20fe60853ee27a841d3bf357ea3708a172b5b82f7903\",\"createdAt\":\"2026-08-16T20:00:15.000Z\"}','Super Administrator','mdhourira6712@gmail.com','2026-08-16 20:00:15','2026-09-15 20:00:15'),(42,'user',25,'Audit Customer','customer_1786910887807@example.com (customer)','{\"id\":25,\"name\":\"Audit Customer\",\"email\":\"customer_1786910887807@example.com\",\"phone\":\"\",\"avatar\":\"\",\"designation\":\"\",\"bio\":\"\",\"address\":\"\",\"city\":\"\",\"zip\":\"\",\"notes\":\"\",\"role\":\"customer\",\"active\":true,\"passwordHash\":\"1cbbb627293345f08a476bbbcc9cefbe:2a125e5a280701d400da32320fbff1a7ec9f30c4b710d492851b3dff6a093b20cabf74b3b6ac5ea59c415f51d10d2d05ba3b30dbf5bdd3d1d53e634d4f8cdaf0\",\"createdAt\":\"2026-08-16T20:08:07.000Z\"}','Super Administrator','mdhourira6712@gmail.com','2026-08-16 20:08:08','2026-09-15 20:08:08'),(45,'user',26,'Audit Customer','customer_1786911345182@example.com (customer)','{\"id\":26,\"name\":\"Audit Customer\",\"email\":\"customer_1786911345182@example.com\",\"phone\":\"\",\"avatar\":\"\",\"designation\":\"\",\"bio\":\"\",\"address\":\"\",\"city\":\"\",\"zip\":\"\",\"notes\":\"\",\"role\":\"customer\",\"active\":true,\"passwordHash\":\"94330f273c54509e63c29d85a3eed02d:bd89b07c05cde6d81dc2e743211a96c45225fc65d05c4ab02a6949e5204b95e075434c9b30b68dc5633c4a96bf414abe8de4d5bd92938706fb62064cb4a2e60b\",\"createdAt\":\"2026-08-16T20:15:45.000Z\"}','Super Administrator','mdhourira6712@gmail.com','2026-08-16 20:15:45','2026-09-15 20:15:45');
/*!40000 ALTER TABLE `recycle_bin` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reviews`
--

DROP TABLE IF EXISTS `reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `reviews` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `product_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `author_name` varchar(120) NOT NULL,
  `author_email` varchar(255) NOT NULL DEFAULT '',
  `rating` tinyint(3) unsigned NOT NULL,
  `comment` text NOT NULL,
  `images` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`images`)),
  `hidden` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `reviews_product_hidden_index` (`product_id`,`hidden`),
  KEY `reviews_user_fk` (`user_id`),
  CONSTRAINT `reviews_product_fk` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `reviews_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reviews`
--

LOCK TABLES `reviews` WRITE;
/*!40000 ALTER TABLE `reviews` DISABLE KEYS */;
INSERT INTO `reviews` VALUES (2,4,5,'Verified Customer','',5,'Authentic wild Sundarban honey. Thick consistency and remarkable taste! Highly recommend.','[]',0,'2026-08-16 19:05:51','2026-08-16 19:05:51'),(3,8,NULL,'Verified Customer','',5,'Authentic wild Sundarban honey. Thick consistency and remarkable taste! Highly recommend.','[]',0,'2026-08-16 19:06:25','2026-08-16 19:06:25'),(6,15,17,'Verified Customer','',5,'Absolutely fresh and authentic product! Outstanding packaging and speedy delivery.','[]',0,'2026-08-16 19:34:34','2026-08-16 19:34:34'),(8,15,23,'Verified Customer','',5,'Crisp, sweet organic produce!','[]',0,'2026-08-16 20:00:05','2026-08-16 20:00:05');
/*!40000 ALTER TABLE `reviews` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `store_settings`
--

DROP TABLE IF EXISTS `store_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `store_settings` (
  `setting_key` varchar(100) NOT NULL,
  `setting_val` longtext NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `store_settings`
--

LOCK TABLES `store_settings` WRITE;
/*!40000 ALTER TABLE `store_settings` DISABLE KEYS */;
INSERT INTO `store_settings` VALUES ('adminBrandName','ENMAR Admin','2026-08-16 20:15:45'),('adminLogo','','2026-08-16 20:15:45'),('apiConfigs','{\"sms\":{\"provider\":\"alpha\",\"baseUrl\":\"https://api.sms.net.bd/sendsms\",\"apiKey\":\"\",\"senderId\":\"\",\"enabled\":true},\"email\":{\"provider\":\"gmail\",\"host\":\"smtp.gmail.com\",\"port\":465,\"secure\":true,\"user\":\"\",\"pass\":\"\",\"fromName\":\"ENMAR Official\",\"fromEmail\":\"\"}}','2026-08-16 18:54:16'),('brandLogo','data:image/png;base64,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','2026-08-16 19:30:59'),('brandName','ENMAR','2026-08-16 20:15:45'),('cartEmptyMessage','Your harvest basket is empty. Explore our farm-fresh catalog!','2026-08-16 19:49:35'),('categorySectionTitle','Featured Harvest Categories','2026-08-16 19:49:35'),('communityEmptyMessage','No community comments yet. Be the first to share your thoughts!','2026-08-16 19:49:36'),('communityPlaceholder','Share your experience with our organic harvest…','2026-08-16 19:49:36'),('communityPromptGuest','Sign in to join the conversation and share your feedback.','2026-08-16 19:49:36'),('communitySectionPill','Community Voices','2026-08-16 19:49:36'),('communitySectionSubtitle','Real feedback from healthy families enjoying ENMAR produce','2026-08-16 19:49:36'),('communitySectionTitle','What Our Customers Say','2026-08-16 19:49:36'),('contactAddress','House 12, Road 4, Dhanmondi, Dhaka - 1205, Bangladesh','2026-08-16 19:49:35'),('contactEmail','info@enmar.bd','2026-08-16 19:49:35'),('contactFacebook','https://facebook.com/enmar.bd','2026-08-16 19:49:35'),('contactPhone','+880 1614 113082','2026-08-16 19:49:35'),('contactWhatsapp','https://wa.me/8801614113082','2026-08-16 19:49:35'),('defaultCommentReply','Thank you for your valuable feedback! We are committed to delivering the best organic harvest.','2026-08-16 19:49:36'),('defaultDeliveryEstimate','4 hours','2026-08-16 19:41:51'),('defaultOrderMessage','Thank you for shopping with ENMAR. Fresh organic harvest on the way!','2026-08-16 19:49:35'),('defaultShippingFee','70','2026-08-16 19:49:35'),('deliveryCountdownHours','4','2026-08-16 19:42:07'),('favicon','','2026-08-16 19:30:59'),('footerContactInfo','Customer Support: Sat–Thu, 9:00 AM – 10:00 PM\nHelpline: +880 1614 113082\nEmail: hello@enmar.bd','2026-08-16 19:49:35'),('footerFarmInfo','We partner with over 40+ certified organic farmers across Savar, Gazipur, Rajshahi, and Bogura to deliver pesticide-free, chemically untampered vegetables, fruits, and dairy.','2026-08-16 19:49:35'),('footerShippingInfo','We deliver within 4 to 24 hours of fresh morning harvest.\nFree shipping on orders over ৳1500.\nDelivery available across all areas of Dhaka and major cities in Bangladesh.','2026-08-16 19:49:35'),('footerTagline','Pure, organic, farm-fresh harvest delivered directly to your home.','2026-08-16 19:49:35'),('freeDeliveryThreshold','1500','2026-08-16 19:49:35'),('messengerUrl','https://m.me/enmar.bd','2026-08-16 19:49:35'),('myOrdersEmptyMessage','You haven\'t placed any orders yet.','2026-08-16 19:49:36'),('myOrdersPageTitle','My Orders & Deliveries','2026-08-16 19:49:36'),('newsletterBody','Subscribe to get weekly seasonal crop updates, exclusive member discounts, and farm stories directly to your inbox.','2026-08-16 19:49:35'),('newsletterHeading','Stay Updated with Fresh Harvest','2026-08-16 19:49:35'),('openHours','8:00 AM - 10:00 PM','2026-08-16 19:49:35'),('orderSuccessHeading','Order Placed Successfully!','2026-08-16 19:49:35'),('orderSuccessMessage','Your order has been received. Our team will verify and deliver fresh organic produce to your doorstep.','2026-08-16 19:49:35'),('pageAboutUs','Welcome to ENMAR — Bangladesh\'s trusted farm-to-table organic grocery platform. Founded with a vision to connect health-conscious families with ethical organic farmers, we eliminate intermediaries to guarantee maximum freshness, fair farmer compensation, and pure nutritional value.','2026-08-16 19:49:35'),('pageCancellation','You can cancel any pending order directly from your \"My Orders\" dashboard before the order is marked Confirmed or Out for Delivery.','2026-08-16 19:49:35'),('pageCompanyInfo','ENMAR Agro-Commerce Bangladesh Ltd.\nTrade License: TRAD/DSCC/019283/2024\nBSTI & Organic Certification Partner\nDedicated to ecological agriculture and sustainable food security in Bangladesh.','2026-08-16 19:49:35'),('pageContactUs','Have questions or need assistance? Contact our team at:\n• Office: House 12, Road 4, Dhanmondi, Dhaka\n• Phone: +880 1614 113082\n• Email: info@enmar.bd\n• Hours: 8:00 AM - 10:00 PM daily','2026-08-16 19:49:35'),('pageFaq','Q: How do you ensure products are 100% organic?\nA: We inspect partner farms regularly and test soil/produce for zero synthetic chemicals.\n\nQ: What if an item arrives damaged?\nA: Our Happy Return policy guarantees instant replacement or full credit.','2026-08-16 19:49:35'),('pageHappyReturn','If you are unsatisfied with the quality or freshness of any item upon delivery, return it to the delivery agent instantly with zero return fees.','2026-08-16 19:49:35'),('pageHowToOrder','1. Browse fresh categories or search your desired organic items.\n2. Add produce to your harvest basket.\n3. Proceed to checkout and enter your delivery address.\n4. Select Cash on Delivery and confirm your order.\n5. Track live delivery countdown from your order history.','2026-08-16 19:49:35'),('pageOrderTracking','Track your package in real-time from the \"My Orders\" dashboard. Once confirmed by our team, a live countdown timer displays the exact remaining delivery time.','2026-08-16 19:49:35'),('pagePaymentInfo','We currently accept Cash on Delivery (COD) across Dhaka. Digital payment options (bKash & Nagad) are being integrated and will launch soon.','2026-08-16 19:49:35'),('pagePreOrder','Seasonal items such as Rajshahi Mangoes, Sundarban Raw Honey, and Winter Specialty Vegetables can be pre-ordered ahead of harvest season.','2026-08-16 19:49:35'),('pagePrivacyPolicy','Your privacy is paramount to us. ENMAR collects customer contact details solely for order fulfillment, delivery logistics, and essential account security notifications. We never sell or share customer data with third parties.','2026-08-16 19:49:35'),('pageRefundPolicy','Approved refunds are processed within 24–48 hours to the customer\'s preferred payment method or store credit.','2026-08-16 19:49:35'),('pageSupportCenter','Need help with your account, order tracking, or returns? Our customer support agents are ready to assist you via WhatsApp, live order chat, or phone helpline.','2026-08-16 19:49:35'),('pageSupportShipping','Express delivery within 4 hours inside Dhaka city. Standard delivery within 24 hours for suburban areas. All items are packed in eco-friendly protective crates.','2026-08-16 19:49:35'),('pageTerms','1. Orders placed on ENMAR are subject to product availability and harvest quality.\n2. Prices are displayed in Bangladeshi Taka (BDT) including applicable taxes.\n3. Cash on Delivery is available for all eligible delivery zones.\n4. Customers can cancel pending orders before warehouse dispatch.','2026-08-16 19:49:35'),('productsSectionTitle','Farm Fresh Products','2026-08-16 19:49:35'),('recentSectionBadge','Fresh In','2026-08-16 19:49:35'),('recentSectionCardBadge','New','2026-08-16 19:49:36'),('recentSectionDaysLimit','7','2026-08-16 19:49:36'),('recentSectionEnabled','true','2026-08-16 19:49:35'),('recentSectionExploreLink','#products','2026-08-16 19:49:36'),('recentSectionExploreText','View All Harvest','2026-08-16 19:49:35'),('recentSectionMaxProducts','8','2026-08-16 19:49:36'),('recentSectionRatingText','Verified Organic','2026-08-16 19:49:36'),('recentSectionScrollSpeed','3.8','2026-08-16 19:49:36'),('recentSectionSubtitle','Direct from this morning\'s harvest from our partner farms','2026-08-16 19:49:35'),('recentSectionTitle','Recently Added Harvest','2026-08-16 19:49:35'),('regGuideEnabled','true','2026-08-16 19:49:36'),('regGuideSteps','1. Click \"Sign in / Register\" in the top bar.\n2. Enter your email and click \"Send OTP\".\n3. Enter the 6-digit OTP code received in your inbox.\n4. Set your secure password and click \"Create Account\".','2026-08-16 19:49:36'),('regGuideSubtitle','New to our shop? Follow these simple steps to create your customer account:','2026-08-16 19:49:36'),('regGuideTitle','How to Register / Create Account','2026-08-16 19:49:36'),('searchPlaceholder','Search fresh harvest by name, farm variety, category…','2026-08-16 19:49:35'),('shippingFlat','70','2026-08-16 19:23:10'),('shippingFreeThreshold','1500','2026-08-16 19:05:51'),('shopHarvestButtonText','Shop This Week\'s Harvest','2026-08-16 19:49:36'),('tagline','Farm fresh organic harvest verified at 1786909837086','2026-08-16 19:50:37'),('themeAccent','#7e8019','2026-08-16 19:31:35'),('themeName','Custom','2026-08-16 19:31:35'),('themePrimary','#14421a','2026-08-16 19:31:35');
/*!40000 ALTER TABLE `store_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `subscribers`
--

DROP TABLE IF EXISTS `subscribers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `subscribers` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `subscribed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `subscribers_email_unique` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subscribers`
--

LOCK TABLES `subscribers` WRITE;
/*!40000 ALTER TABLE `subscribers` DISABLE KEYS */;
INSERT INTO `subscribers` VALUES (1,'sub_1786906472800@example.com','2026-08-16 18:54:32'),(2,'organic_lover_dhaka@gmail.com','2026-08-16 19:05:51'),(5,'sub_1786907673073@example.com','2026-08-16 19:14:33'),(6,'tanvir_customer_1786908868308@gmail.com','2026-08-16 19:34:34'),(8,'newsletter_reader_1786908986736@organicbd.com','2026-08-16 19:36:26'),(9,'sub.1786910367499@example.com','2026-08-16 19:59:27'),(10,'sub.1786910405071@example.com','2026-08-16 20:00:05'),(11,'dd@gmail.com','2026-08-16 20:08:44');
/*!40000 ALTER TABLE `subscribers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_sessions`
--

DROP TABLE IF EXISTS `user_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_sessions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `token_hash` char(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `sessions_token_hash_unique` (`token_hash`),
  KEY `sessions_expiry_index` (`expires_at`),
  KEY `sessions_user_fk` (`user_id`),
  CONSTRAINT `sessions_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=60 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_sessions`
--

LOCK TABLES `user_sessions` WRITE;
/*!40000 ALTER TABLE `user_sessions` DISABLE KEYS */;
INSERT INTO `user_sessions` VALUES (1,1,'80cfb9849a23ef168ba680c731bd0ce3ada8991f808b36b2a91d5d563e5dd076','2026-08-24 00:53:37','2026-08-16 18:53:37'),(2,1,'82a251307486c7ea92451ead5464ffd8097d88620cd110964b7939aad4f8cdba','2026-08-24 00:54:15','2026-08-16 18:54:15'),(4,1,'d0b1202fb91516e1962c79b627dd16d89962837b73da0a3df5ade1cde9697c29','2026-08-24 00:54:32','2026-08-16 18:54:32'),(6,1,'a97d4da57d534fa76d1845a71c2908c28e933266a7eb17a24954143571774af1','2026-08-24 00:55:19','2026-08-16 18:55:19'),(7,1,'64ab8ee703573ddc76bc360c5ef54070df1b7870b43ff966e02e26b3e9b6c340','2026-08-24 01:05:51','2026-08-16 19:05:51'),(8,5,'c6f822bd1696628406eae9c491b30d73a19e65fca134c0548fe1a83e8637af90','2026-08-24 01:05:51','2026-08-16 19:05:51'),(9,1,'01115201ffb993470dd73c3b4bacc856f48984b22a44fe0bffe7f415dc2424d2','2026-08-24 01:06:25','2026-08-16 19:06:25'),(11,1,'7c0b156aeaacfc40bcfce0aad37f23a96c48d5c974b3954dcad4b92f55115087','2026-08-24 01:06:30','2026-08-16 19:06:30'),(13,1,'59befb4e15ecf82358d931e175f34c9ed0b785aaffbe14697d761a8421eaa3ce','2026-08-24 01:07:17','2026-08-16 19:07:17'),(14,1,'908ee0bd6c6778fc0dacd4edfc668a59d81220134953f6e1a073677586b26458','2026-08-24 01:12:24','2026-08-16 19:12:24'),(15,1,'8e64ad19c04da3084ec183e41d79f80faf824810d24e0665b897a43d323ec9b0','2026-08-24 01:13:33','2026-08-16 19:13:33'),(16,1,'2eaba9df29d1828239b2685411ecff66edd13a62fa7efc4785949bee511dc046','2026-08-24 01:13:39','2026-08-16 19:13:39'),(17,1,'e231b67447a2a9d278242415a17ab3cefd5157e8ddfea80340b2f55f364efd84','2026-08-24 01:14:25','2026-08-16 19:14:25'),(18,1,'6d911b76da88ada752f6d1c92f32c5784df8ffa120da694055fbcc1a686886a1','2026-08-24 01:14:28','2026-08-16 19:14:28'),(20,1,'3c325a910d5bf9ede3d8acb4c89c4463d877bfd6fd0e20d32016a6817bf10277','2026-08-24 01:14:32','2026-08-16 19:14:32'),(22,1,'60eda5ed83d9d10cffc25ec29786ef7f26407b3a4dc75483610087afa2d6b2c9','2026-08-24 01:16:13','2026-08-16 19:16:13'),(23,1,'467789e733ee7b2fa77fa8aac8df12c069bf06bd70bea99c527b6956f9d9ba1a','2026-08-24 01:21:50','2026-08-16 19:21:50'),(24,1,'4516db1d82242a0a368c22c60f8645a97b8cc307bda441e5aabe413514fec1a5','2026-08-24 01:21:58','2026-08-16 19:21:58'),(25,1,'539f2434a4349c601e9d043c4b132c424b4cd956b7006fcbc5ce223638bba34e','2026-08-24 01:23:02','2026-08-16 19:23:02'),(26,1,'6bb7fccc60fd94fb7fb085d2705d204556ac6e6235be292258cfecda71c68024','2026-08-24 01:23:10','2026-08-16 19:23:10'),(27,1,'0764f601c03868ddb49e51c34c3e88d47c73f79ad0da1e8688c694d166b79a5e','2026-08-24 01:23:17','2026-08-16 19:23:17'),(29,1,'4ac4e8c7909c10d71160bce0265262c397623ba3a4d6db78fcfc784172240099','2026-08-24 01:23:56','2026-08-16 19:23:56'),(30,6,'731098b4bdc44e27da1fb2b6056698d65e7900e814c3dc407f41024889d6c783','2026-08-24 01:30:24','2026-08-16 19:30:24'),(31,17,'44017aa7215877505d5be0c40b45cbbfff9bb32b498468af86754f0ee9dd508e','2026-08-24 01:34:31','2026-08-16 19:34:31'),(32,17,'86f522d2aef592a763d2b6154e7fa8f4f6b3657d03362c97caf11ed6731faaa5','2026-08-24 01:34:31','2026-08-16 19:34:31'),(34,1,'0fb1364cf5af7cc1f6e11d92442a70758e6f191fbabd9f5d9ce96e25da0e851c','2026-08-24 01:34:39','2026-08-16 19:34:39'),(36,6,'2e0fa84955e8514af39c04332b09531874a15d431e966582ec4f35ea5b32a475','2026-08-24 01:36:26','2026-08-16 19:36:26'),(37,1,'4b1fdb5e13142f260e752b5c41ecc6dcb5f4afecf97dc22edb0b6eea9985c5de','2026-08-24 01:36:26','2026-08-16 19:36:26'),(38,1,'7475be30eb4a27bc76ed17dbfdbe5b0d7b19a24e280ad3b0f0bf3b20699e4b0d','2026-08-24 01:41:51','2026-08-16 19:41:51'),(39,1,'2d57534b6fb558dd0d9c2a3d1b6806059df5fe2b98ca79e9025411c694c95546','2026-08-24 01:42:07','2026-08-16 19:42:07'),(40,1,'e400d49adb349708f878a4930cde80a8cb18302a757c5b536ea075412fb460c9','2026-08-24 01:42:11','2026-08-16 19:42:11'),(42,6,'1788128b2b97bb427f8cc24241e045d1bf1045d8433f19ccbd55ee40df31cf55','2026-08-24 01:43:46','2026-08-16 19:43:46'),(43,1,'1786c6102caa13f1cf78303f251a23e3b7ddc62e4c3c92d202767648a8638aa4','2026-08-24 01:46:59','2026-08-16 19:46:59'),(44,1,'2773eb53abb7dbca0f8706b618d1bfdc8996d9a3f24aba1e3d6fa29b685688fe','2026-08-24 01:50:37','2026-08-16 19:50:37'),(45,1,'ed1561ce0223d3753bc7f5d1c852eaffafd66243e800eb66e31c8c58eaf8d8e6','2026-08-24 01:50:41','2026-08-16 19:50:41'),(47,1,'6aab5f3bd3a3a0a78a1a1f512258d24f1bc02707524318d1fe6b0d22154c4f67','2026-08-24 01:52:32','2026-08-16 19:52:32'),(48,1,'ec1a13a21baa98767c5bda3aa87464d31c0efe435bcd27431d30cd5140c79e01','2026-08-24 01:59:25','2026-08-16 19:59:25'),(49,21,'d4eab827d3567bd4481c44f6627d9a331e1dbe125aeff81a157f69b0986473c5','2026-08-24 01:59:27','2026-08-16 19:59:27'),(50,22,'70b2bc38c667faa687164fbb28d638d8d977c099a22dec6fa1de11fa468af611','2026-08-24 01:59:40','2026-08-16 19:59:40'),(51,1,'6f5c72d3df25b97fdb81e0b908d6113996d9789e48df2d6cb668ffd12b4b5ada','2026-08-24 02:00:03','2026-08-16 20:00:03'),(52,23,'364b73fb5b0743c255a47f6ec0acb58123595de02e71284bc0797e59035cdb71','2026-08-24 02:00:05','2026-08-16 20:00:05'),(53,1,'dc6ececadd35db8c478372a72ef7f9a65eba9485c47158b3e5612bb59fd65838','2026-08-24 02:00:15','2026-08-16 20:00:15'),(55,1,'0a8b6c31485557e7226a46b89d63b865371d1aab981599af5d160c558c59600d','2026-08-24 02:05:06','2026-08-16 20:05:06'),(56,1,'68d4350bc7cdfb8132377edff61fb03200b06952b9cafb2b5ce798550ec57909','2026-08-24 02:08:07','2026-08-16 20:08:07'),(58,1,'aa671e2474426177de9ee53e408322a2d873e8297d21e87ecc526e27da5c0e61','2026-08-24 02:15:45','2026-08-16 20:15:45');
/*!40000 ALTER TABLE `user_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(30) NOT NULL DEFAULT '',
  `password_hash` varchar(255) NOT NULL,
  `role` enum('customer','moderator','manager','admin','superadmin') NOT NULL DEFAULT 'customer',
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `avatar` varchar(500) NOT NULL DEFAULT '',
  `designation` varchar(120) NOT NULL DEFAULT '',
  `bio` text DEFAULT NULL,
  `address` varchar(500) NOT NULL DEFAULT '',
  `city` varchar(120) NOT NULL DEFAULT '',
  `zip` varchar(30) NOT NULL DEFAULT '',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`),
  KEY `users_role_active_index` (`role`,`active`)
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Super Administrator','mdhourira6712@gmail.com','','d008a786070d38f8fe76bc705f25d5a2:9c8628830b90ea17322791cc5fa7524457bc1b58ff4e433acd0ae75818c1fb6e15763f293bf71afabb226cabd1f8906a3693e385e96deeeb6f32654c9e734d15','superadmin',1,'','','','','','','','2026-08-16 18:49:21','2026-08-16 18:52:50'),(5,'Rahim Ahmed','customer_audit_1786907151660@gmail.com','','e6ab3cee1285ad96f13dea26186a440d:11c957138c71353d80afce88f9c6cdf4ddb9282c3975704d49d362a7403aba59a5d97761b858d0fd9174a3f89af883d915b6c8a1880e3088c8c7778606b11264','customer',1,'','','','','','','','2026-08-16 19:05:51','2026-08-16 19:05:51'),(6,'Jamal Store Manager','manager_1786907185397@enmar.bd','','0e49eb073337becbadcca56e8ed06a5c:e0d1bddbac174d31d75ed48b64a2db1e4f3a2f329613b98841a6f35ba9d67379fc780bb78baba559eb4f30a5f21de7630695b32fb378d435b1fe7a6ce3615814','admin',1,'','','','','','','','2026-08-16 19:06:25','2026-08-16 19:29:36'),(17,'Tanvir Hasan (Verified Buyer)','tanvir_customer_1786908868308@gmail.com','01899887766','383cac1a2eb153c6663935cb104152a3:c08b41e551f8a341244b8887850e1db88eb68d046469662912c8736e002909e2018da29165ec52f244d7f9a082c406d118010f671956be0f02fd9bb32030f2b6','customer',1,'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150','','Passionate about organic vegetables and eco-living.','Flat 4B, Green Lake Apartments, Dhanmondi 27','Dhaka','','','2026-08-16 19:34:31','2026-08-16 19:34:34'),(21,'Notification Tester','notif.tester.1786910365532@example.com','01700998877','26e6af6217dceaac51e470524e36a041:82dcc4ab1dca94a61cede572b50770fb12b8506a479ec648e669e555b6611917da0c60cc4a34ea9bed05ce20d0644bc84c762b372abfd8519a3821d8e03d92c3','customer',1,'','','','','','','','2026-08-16 19:59:27','2026-08-16 19:59:27'),(22,'Customer 1','user.1786910378035@example.com','01711223344','9db36cd65e71b564e777bce7b4be5667:812715cce8e3c06e4866464332d68bfb6f2dc8ebcefb0a7a56e32679ee7ba16038ad40f6baea77617fcc1dbef2887e4e9071a45d2963cb0fc40fa0d31bb83428','customer',1,'','','','','','','','2026-08-16 19:59:40','2026-08-16 19:59:40'),(23,'Notification Tester','notif.tester.1786910403066@example.com','01700998877','2c07aeb31efaaf39b263b14dc10705f3:626f79bd6539fd2d0ad6991704701f9c42df2428c48e62f5e154ba09ff7531df6bc96cb8626cf8e95f2e1dc9c524db2108305d34bff3d7ec4150a71627ca6f22','customer',1,'','','','','','','','2026-08-16 20:00:05','2026-08-16 20:00:05');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-17  2:27:51
