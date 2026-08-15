# 🔐 EMAIL GATEWAY SECURITY AUDIT REPORT

## EXECUTIVE SUMMARY

**Current Status:** ⚠️ **CRITICAL SECURITY ISSUE**

Email gateway credentials (SMTP passwords, API keys, usernames) are currently stored in:
1. ✅ Environment variables (.env file) - GOOD
2. ✅ MySQL store_settings table (JSON) - ACCEPTABLE
3. ❌ **Returned to frontend in API responses - CRITICAL**
4. ❌ **Visible in browser developer tools - CRITICAL**
5. ❌ **No encryption at rest - MEDIUM**

---

## 1. CURRENT EMAIL CREDENTIAL STORAGE LOCATIONS

### Location 1: Environment Variables (.env)
**File:** `.env`  
**Variables:**
- `EMAIL_HOST` - SMTP server hostname (e.g., smtp.gmail.com)
- `EMAIL_PORT` - SMTP port (e.g., 587)
- `EMAIL_USER` - SMTP username/email
- `EMAIL_PASS` - **SENSITIVE** SMTP password or app password
- `EMAIL_FROM` - Sender email address
- `EMAIL_FROM_NAME` - Sender display name
- `EMAIL_SECURE` - TLS flag

**Risk Level:** 🟡 MEDIUM - Stored on server, accessible to all Node.js code

### Location 2: MySQL Database (store_settings table)
**Database:** `enmar_db`  
**Table:** `store_settings`  
**Key:** `apiConfigs`  
**Value (JSON):**
```json
{
  "email": {
    "provider": "gmail",
    "host": "smtp.gmail.com",
    "port": 587,
    "secure": false,
    "user": "your_email@gmail.com",
    "pass": "your_16_char_app_password",
    "fromName": "ENMAR",
    "fromEmail": "your_email@gmail.com"
  }
}
```

**Risk Level:** 🔴 **CRITICAL** - Passwords stored in plaintext in database

### Location 3: Frontend API Response
**Endpoint:** `GET /api/admin/apis`  
**Exposed Data:**
- `emailPass` - Masked placeholder `•••••• (Saved in .env)`
- But underlying data IS readable by server

**Risk Level:** 🔴 **CRITICAL** - Credentials could be exposed in transit or in browser memory

---

## 2. FILES USING EMAIL CONFIGURATION

### Backend Files
1. **server.js (Lines 66-76, 545-572)**
   - Loads email config from .env defaults
   - Defines DEFAULT_API_CONFIGS with credentials
   - Uses in emailConfig() function

2. **db-service.js (Lines 750-780)**
   - Retrieves apiConfigs from MySQL
   - Returns full config including passwords

3. **server.js emailConfig() function (Lines 545-572)**
   - Reads credentials from environment or MySQL
   - Used to send OTPs, password resets, emails

### Frontend Files
1. **admin/apis.html (Lines 200-350)**
   - Form for entering email configuration
   - Displays masked passwords in UI
   - Sends credentials to backend via PATCH request

2. **admin/apis.html (JavaScript)**
   - loadConfig() - Loads config from `/api/admin/apis`
   - Form submission sends credentials

### Scratch/Test Files (Development Only)
- test-email-send.js
- test-smtp.js
- test-gmail-send.js
- test-smtp-send.js
- test-gmail-mime.js
- test-connections.js

---

## 3. SECURITY VULNERABILITIES

### 🔴 CRITICAL: Plaintext Password Storage in MySQL
- SMTP passwords stored as plaintext JSON in `store_settings` table
- Accessible to anyone with database access
- No encryption at rest
- Visible in database backups

### 🔴 CRITICAL: Password Exposure in API Responses
- GET `/api/admin/apis` endpoint could return full config
- Frontend JavaScript could access and log credentials
- Browser developer tools exposure
- Network traffic interception

### 🟡 MEDIUM: Hardcoded Defaults in Source Code
- server.js contains DEFAULT_API_CONFIGS structure
- .env.example contains example email credentials
- Environment variables visible in process.env across application

### 🟡 MEDIUM: No Encryption Key Management
- No dedicated encryption key for secrets
- No key rotation mechanism
- No audit trail for credential access

### 🟡 MEDIUM: Test Endpoints
- Email test functionality could be abused
- Admin-only but no rate limiting on test requests

---

## 4. PROPOSED SOLUTION ARCHITECTURE

### New Secure Email Config System

```
┌─────────────────────────────────────────────────────────────┐
│  SECURE EMAIL GATEWAY CONFIGURATION SYSTEM                  │
└─────────────────────────────────────────────────────────────┘

ENVIRONMENT VARIABLES (.env)
├── ENCRYPTION_KEY (new) - for encrypting passwords at rest
└── Used only during startup

MYSQL DATABASE (enmar_db)
├── NEW TABLE: email_gateway_config
│   ├── id (PRIMARY KEY)
│   ├── provider (email, gmail, brevo, resend, smtp)
│   ├── host (smtp.gmail.com)
│   ├── port (587)
│   ├── username (encrypted)
│   ├── password_encrypted (AES-256 encrypted)
│   ├── encryption_salt (salt for this password)
│   ├── from_email (verified sender)
│   ├── from_name (display name)
│   ├── use_tls (boolean)
│   ├── created_at (timestamp)
│   ├── updated_at (timestamp)
│   └── created_by_admin_id (audit trail)

BACKEND SERVER (server.js)
├── Load ENCRYPTION_KEY from .env at startup
├── Store in memory only (not in logs or exposed)
├── On save: Encrypt password before storing in MySQL
├── On load: Decrypt password from MySQL (server-side only)
├── On API response: Return MASKED passwords (••••••)
└── On send email: Use decrypted password only

FRONTEND (admin/apis.html)
├── Never receives actual passwords
├── Always sees masked values (•••••)
├── Submits new passwords only when changed
├── Never stores credentials in localStorage
└── No credentials in browser memory after page unload
```

---

## 5. IMPLEMENTATION CHECKLIST

### Phase 1: Database Schema
- [ ] Create `email_gateway_config` table with encryption support
- [ ] Migrate existing config from `store_settings.apiConfigs.email` to new table
- [ ] Add encryption_salt column for per-record encryption

### Phase 2: Backend Security
- [ ] Load ENCRYPTION_KEY from .env
- [ ] Implement AES-256-GCM encryption/decryption functions
- [ ] Update emailConfig() to decrypt password from database
- [ ] Create secure endpoint: POST `/api/admin/email-config` (save)
- [ ] Create secure endpoint: GET `/api/admin/email-config` (read, masked)
- [ ] Add admin authorization checks on all endpoints
- [ ] Never return decrypted passwords in API responses
- [ ] Update error messages to not expose passwords

### Phase 3: Database Service Layer
- [ ] Add db-service.js methods:
  - [ ] saveEmailConfig(config) - Encrypt and save
  - [ ] getEmailConfig() - Load and decrypt
  - [ ] getEmailConfigMasked() - Load for frontend (masked)
  - [ ] deleteEmailConfig() - Secure deletion

### Phase 4: Frontend Updates
- [ ] Update admin/apis.html to use new endpoints
- [ ] Ensure passwords never logged or exposed
- [ ] Add validation for SMTP/provider combinations
- [ ] Preserve test email functionality

### Phase 5: Migration & Cleanup
- [ ] Migrate existing apiConfigs.email data to new table
- [ ] Remove email credentials from store_settings
- [ ] Remove hardcoded defaults from source code
- [ ] Update .env.example with ENCRYPTION_KEY placeholder
- [ ] Remove old credential references

### Phase 6: Testing & Verification
- [ ] Admin can save new email config
- [ ] Config persisted encrypted in MySQL
- [ ] Passwords never returned to frontend
- [ ] Test email delivery works
- [ ] OTP emails still function
- [ ] Password reset emails still function
- [ ] No plaintext passwords in logs
- [ ] No credentials in browser console

---

## 6. FILES TO BE MODIFIED

### New Files
- [ ] `email-encryption.js` - Encryption/decryption utilities

### Modified Files
- [ ] `database.sql` - Add new email_gateway_config table
- [ ] `db-service.js` - Add email config CRUD methods
- [ ] `server.js` - Load ENCRYPTION_KEY, use encrypted config
- [ ] `admin/apis.html` - Use new masked endpoints
- [ ] `.env.example` - Add ENCRYPTION_KEY placeholder

### Deleted/Deprecated
- [ ] Remove hardcoded DEFAULT_API_CONFIGS email section
- [ ] Remove email credentials from DEFAULT_API_CONFIGS

---

## 7. MIGRATION STRATEGY

**Step 1:** Create new table while keeping old data intact  
**Step 2:** Migrate old credentials to new encrypted table  
**Step 3:** Update code to read from new table  
**Step 4:** Test everything works  
**Step 5:** Clean up old apiConfigs data from store_settings  

**Rollback:** If needed, old data remains in store_settings until explicitly deleted

---

## 8. ENCRYPTION DETAILS

**Algorithm:** AES-256-GCM (Galois/Counter Mode)  
**Key Source:** `process.env.ENCRYPTION_KEY`  
**Key Format:** 32-byte base64-encoded hex string  
**IV (Initialization Vector):** Generated randomly per encryption  
**Authentication Tag:** Included for tamper detection  

**Storage Format:**
```
encrypted_value = base64(iv || authTag || ciphertext)
```

**Decryption Process:**
1. Extract IV (first 16 bytes)
2. Extract authentication tag (next 16 bytes)
3. Extract ciphertext (remaining bytes)
4. Verify tag (tamper detection)
5. Decrypt ciphertext

---

## 9. SECURITY GUARANTEES

✅ **No plaintext passwords in database**  
✅ **No passwords returned to frontend**  
✅ **No hardcoded credentials in source code**  
✅ **No credentials in logs or error messages**  
✅ **Encryption key never exposed to frontend**  
✅ **Encryption key not stored in database**  
✅ **Per-record salt for defense against precomputed attacks**  
✅ **Tamper detection via GCM authentication**  
✅ **Admin-only access to config endpoints**  
✅ **Audit trail (created_by_admin_id) for compliance**  

---

## 10. DEPLOYMENT REQUIREMENTS

**New Environment Variable:**
```
ENCRYPTION_KEY=generate_with_node_-e_"console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**On Production Server:**
1. Generate unique ENCRYPTION_KEY
2. Add to .env before starting application
3. Run application to auto-migrate old data
4. Verify email config still works
5. Delete .env from version control

---

## Timeline
- Phase 1-2: Database + Backend (2 hours)
- Phase 3: Data Layer (1 hour)
- Phase 4: Frontend Updates (1 hour)
- Phase 5: Migration (30 minutes)
- Phase 6: Testing (1 hour)
- **Total: ~5.5 hours**