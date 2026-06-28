# PRD - Avtomoyka Boshqaruv Tizimi

## Original Problem Statement
Zamonaviy va professional Avtomoyka boshqaruv tizimi (Car Wash Management System) yaratish. 3 rolli foydalanuvchilar (Super Admin, Kassir, Hodim), mashinalarni ro'yxatga olish, to'lov qabul qilish, hisobotlar va Excel export.

## Tech Stack
- **Backend**: FastAPI + MongoDB (PostgreSQL o'rniga, template MongoDB bilan kelgan)
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Auth**: JWT cookie-based (custom, bcrypt password hashing)
- **Export**: openpyxl (Excel)

## Architecture
- `/app/backend/server.py` - Barcha API endpointlari (970 satr)
- `/app/frontend/src/pages/` - Sahifalar (LoginPage, Dashboard, OrdersPage, ServicesPage, UsersPage, ReportsPage)
- `/app/frontend/src/contexts/AuthContext.js` - JWT cookie auth
- `/app/frontend/src/components/Layout.js` - Sidebar bilan role-based navigation

## User Personas
1. **Super Admin** - Barcha modullarga to'liq kirish, foydalanuvchilar va xizmatlarni boshqarish
2. **Kassir** - To'lovlarni qabul qilish va hisobotlar
3. **Hodim** - Faqat o'ziga tegishli mashinalarni yuvish

## Core Requirements
- Multi-role authentication (JWT cookies)
- Mashina ro'yxatga olish (davlat raqami, marka, model, kuzov, rang, xizmat)
- 4 ta holat: navbatda → yuvilmoqda → tugallandi → tolandi
- 4 ta to'lov usuli: naqd, karta, click, payme
- Role-based access control
- Hisobotlar va Excel export
- Customer history by license plate
- Search functionality
- End-of-day closing

## Implemented Features (2026-02-28)
✅ JWT cookie authentication with bcrypt
✅ Brute-force protection (5 attempts/15 min lockout)
✅ Admin auto-seed va default services (8 ta xizmat)
✅ User Management (admin yaratadi/o'chiradi)
✅ Service Management (CRUD)
✅ Order lifecycle (create → wash → complete → pay)
✅ Payment processing (naqd/karta/click/payme)
✅ Role-based dashboard (admin/kassir/hodim har xil)
✅ Reports today + employee stats
✅ Excel export
✅ End-of-day closing
✅ Customer history endpoint
✅ Search orders endpoint

## Test Results
- Backend: 29/29 tests passed (100%)
- Frontend: Smoke + role-based access verified
- Critical issues: 0
- Minor issues: 3 (race conditions, code organization)

## P0/P1/P2 Backlog (Next Iterations)
### P0 (Critical for production):
- [ ] PDF export (hozircha faqat Excel)
- [ ] Customer history UI sahifa (backend mavjud)
- [ ] Search UI improvements (advanced filters)

### P1 (Important features):
- [ ] Weekly/Monthly/Date-range reports UI
- [ ] Closed day data immutability check
- [ ] Charts/graphs dashboard'da (recharts allaqachon o'rnatilgan)
- [ ] Notifications (yangi buyurtma kelganda)

### P2 (Nice to have):
- [ ] PostgreSQL ga ko'chirish (foydalanuvchi so'ragan)
- [ ] Mobile responsive improvements
- [ ] Print receipt funksiyasi
- [ ] SMS notification (Twilio)
- [ ] Server.py ni modullarga bo'lish (970 satr)
- [ ] Pagination /orders va /users uchun

## Test Credentials
- Admin: admin@avtomoyka.uz / Admin123!
- Kassir: kassir@avtomoyka.uz / Kassir123!
- Hodim: hodim@avtomoyka.uz / Hodim123!
