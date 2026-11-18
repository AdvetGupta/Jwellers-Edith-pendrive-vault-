# Jwellers Edith

**Version 1.0.0**  
*by AD's Creation*

Professional offline-first Windows desktop jewellery shop management software.

---

## Features

- **Authentication** — Owner/Staff accounts with secure password hashing
- **Dashboard** — Real-time cards, sales trend chart, top products, payment methods
- **Customers** — Full CRM with membership levels, khata balance tracking
- **Products** — Inventory management with categories, metals, purity tracking
- **Billing** — GST & Non-GST invoices, mix of inventory and manual items
- **Khata / Ledger** — Customer credit/debit tracking, opening balances, payment recording
- **Payments** — Cash/UPI/Card/Other, bill allocation, partial payments
- **Communication** — WhatsApp deep links (`wa.me`) and SMS provider-ready stubs
- **Reports & Graphs** — Aggregated dashboard data, sales trends, top products
- **Staff Management** — Role-based permissions, granular access control
- **Settings** — Shop info, tax/GST details, invoice numbering, preferences
- **Backup & Restore** — Local backups with SHA-256 verification, safe restore
- **Data Export** — CSV export for customers and khata ledger
- **Activity Log** — Full audit trail with date/user/action filters
- **Demo Mode** — Pre-seeded database with realistic jewellery shop data

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Desktop Framework | Electron 43 |
| Database | SQLite via sql.js (WASM) |
| Frontend | Vanilla JavaScript (no framework) |
| Packaging | electron-builder / NSIS |
| Architecture | Service → Repository → Secure IPC → UI |

---

## Developer Setup

### Prerequisites

- Node.js 18+
- npm

### Install Dependencies

```bash
npm install
```

### Initialize Database

```bash
npm run db:init
```

### Seed Demo Data (Optional)

```bash
npm run db:seed
```

### Run Tests

```bash
npm test
```

### Run in Development Mode

```bash
npm start
```

---

## Building the Windows Installer

### Create Production Installer

```bash
npm run dist:win
```

The installer will be created in the `dist/` directory.

### Installer Output

| File | Description |
|------|-------------|
| `dist/Jwellers Edith Setup 1.0.0.exe` | Windows installer (NSIS) |
| `dist/win-unpacked/` | Unpacked application directory (for testing) |

### Creating a New Version

1. Update `version` in `package.json` (e.g., `1.1.0`)
2. Update `config/index.js` version if applicable
3. Run `npm run dist:win`
4. The new installer will be named with the updated version

---

## Data Safety

### User Data Location

User business data is stored separately from the application files:

| Data | Location |
|------|----------|
| Database | `%APPDATA%\data\jwellers_edith.db` |
| Backups | `%APPDATA%\.jwellers-edith\backups\` |
| Exports | `%APPDATA%\.jwellers-edith\exports\` |
| Logs | `%APPDATA%\.jwellers-edith\logs\` |

### Install / Uninstall Behavior

- **Install**: Application files go to `Program Files`; user data directory is created in `%APPDATA%`
- **Update**: Application files are replaced; user data is **never touched**
- **Uninstall**: Application files are removed; user business data is **preserved** (not deleted)

The installer (`scripts/installer.nsh`) explicitly preserves the database during uninstallation.

---

## Distribution

### GitHub Releases (Recommended)

1. Create a **PRIVATE** repository on GitHub
2. Push the code (ensure `.gitignore` excludes secrets, node_modules, and databases)
3. Go to your repository → **Releases** → **Create a new release**
4. Tag: `v1.0.0`, Title: `v1.0.0`
5. Attach `dist/Jwellers Edith Setup 1.0.0.exe`
6. Publish release

### Google Drive (Alternative)

1. Build the installer: `npm run dist:win`
2. Upload `dist/Jwellers Edith Setup 1.0.0.exe` to Google Drive
3. Share the download link with users

---

## Demo Accounts

| Role | Username | Password |
|------|----------|----------|
| Owner | `ad` | `000000` |
| Owner | `owner` | `owner123` |
| Staff | `staff` | `staff123` |

WhatsApp Shop Number: **9179783789**

---

## Architecture

```
UI (Renderer Process)
    ↓  (Secure IPC via preload.js)
IPC Handlers (Main Process)
    ↓
Services (Business Logic)
    ↓
Repositories (Data Access)
    ↓
SQLite Database
```

### Key Security Features

- `contextIsolation: true` — Renderer isolated from Node/Electron APIs
- `nodeIntegration: false` — No direct Node access from renderer
- Preload allowlist — Only explicitly listed IPC channels are accessible
- Permission enforcement — Backend rejects unauthorized operations
- Parameterized queries — SQL injection prevention
- Password hashing — SHA-256 (extensible to bcrypt/argon2)
- Audit logging — All business actions recorded

---

## Configuration

### WhatsApp

WhatsApp uses `wa.me` deep links — no external API credentials needed.  
Clicking "Share" opens WhatsApp Web/Desktop with a pre-filled message.

### SMS

SMS is provider-ready. No SMS provider is pre-configured.  
Messages are logged in the `communication_logs` table for later integration.

### Google Drive

Google Drive backup architecture is prepared but requires:
1. A Google Cloud Project with Drive API enabled
2. OAuth 2.0 credentials (Client ID + Client Secret)
3. Configuration in the app settings

---

## Backup & Restore

- Backups are full SQLite database copies with SHA-256 hash verification
- Restore replaces the current database with the backup file
- A safety confirmation dialog prevents accidental overwrite
- Never restore backups from unknown sources

---

## Database

24 tables supporting the complete business workflow.  
Schema versioning via `schema_migrations` table enables safe upgrades.  
See `database/ARCHITECTURE_REPORT.md` for full schema documentation.

---

## License

UNLICENSED — Proprietary software by AD's Creation.
