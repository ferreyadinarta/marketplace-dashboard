# Setup — Dashboard Marketplace

Pembukuan terpadu Shopee, TikTok Shop, Tokopedia. Next.js + Prisma + Postgres (Neon). Semua gratis.

## Arsitektur singkat

- **Master data**: Toko, Product (+ HPP), Grup pembukuan, Mapping SKU.
- **Adapter marketplace** (`src/lib/adapters/`): ubah response API tiap marketplace → bentuk seragam. Response API berbeda-beda cukup disesuaikan di adapter; schema DB & UI tidak berubah.
- **Sync** (`src/lib/sync.ts`): tarik order dari adapter → normalisasi → simpan ke DB. Idempotent (tidak dobel).
- **Dashboard / Pembukuan / Rekonsiliasi**: baca DB, hitung profit (omzet − fee − HPP), export Excel.

## Sandbox vs Production

Dikendalikan variabel `MARKETPLACE_ENV`:

| Mode | Endpoint API | Database |
|------|-------------|----------|
| `sandbox` | endpoint test tiap marketplace | branch Neon `sandbox` |
| `production` | endpoint asli | branch Neon `production` |

Testing tidak pernah menyentuh toko/dana asli.

## Langkah setup (sekali)

1. **Buat database Neon (gratis)** — https://neon.tech
   - Buat project baru.
   - Buat 2 branch: `production` (default) dan `sandbox`.
   - Salin connection string tiap branch (pilih format "Prisma").

2. **Isi `.env` lokal** (mode sandbox):
   ```
   MARKETPLACE_ENV="sandbox"
   DATABASE_URL="<connection string branch sandbox>"
   ```

3. **Buat tabel + data contoh**:
   ```bash
   npm install
   npm run db:migrate -- --name init   # buat tabel di Neon
   npm run db:seed                      # isi data contoh (opsional, buat lihat tampilan)
   npm run dev
   ```
   Buka http://localhost:3000

4. **Deploy ke Vercel**:
   - Import repo ini di Vercel.
   - Set Environment Variables:
     - `MARKETPLACE_ENV = production`
     - `DATABASE_URL = <connection string branch production>`
   - Build command sudah otomatis jalankan `prisma migrate deploy` (buat tabel di branch production).

## Menghubungkan marketplace (setelah akun API approve)

1. Buka halaman **Master Toko** → isi API Key/Secret/Shop ID tiap toko.
2. Aktifkan adapter di `src/lib/adapters/{shopee,tiktok,tokopedia}.ts` (isi `fetchOrders`/`fetchPayouts`).
3. Jalankan sync (lihat `syncStore()` di `src/lib/sync.ts`).
4. SKU baru muncul di **Mapping SKU** → petakan ke product internal → otomatis masuk pembukuan.

## Perintah berguna

| Perintah | Fungsi |
|----------|--------|
| `npm run dev` | jalankan lokal |
| `npm run db:migrate` | buat/ubah tabel |
| `npm run db:seed` | isi data contoh |
| `npm run db:reset` | hapus semua + isi ulang data contoh |
| `npm run db:studio` | buka GUI database |
