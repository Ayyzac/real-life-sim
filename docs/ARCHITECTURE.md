# Arsitektur Teknis

Dokumen ini menjabarkan `CLAUDE.md` §"Aturan arsitektur inti" menjadi struktur konkret. Kalau ada keputusan teknis yang belum tercakup di sini, Claude Code **harus berhenti dan bertanya ke user**, lalu menambahkan jawabannya ke dokumen ini.

## 1. Tiga lapisan, dipisah ketat

```
┌─────────────────────────────┐     ┌──────────────────────────────┐
│   React UI (src/ui/)         │     │   Phaser Scene (src/world/)   │
│   dashboard, menu lokasi,    │     │   peta 2D, sprite karakter,   │
│   layar event, life summary  │     │   pergerakan, animasi         │
└──────────────▲───────────────┘     └───────────────▲────────────────┘
               │  baca state via selector      │  baca state via selector
               │  kirim "intent" (aksi pemain) │  kirim "intent" (mis. masuk lokasi)
               ▼                                ▼
        ┌─────────────────────────────────────────────┐
        │        Event/Message Bus (src/core/bus.ts)    │
        └───────────────────▲───────────────────────────┘
                            │
        ┌───────────────────┴───────────────────────────┐
        │   Simulation Core (src/core/)                   │
        │   TypeScript murni. TIDAK import React/Phaser.   │
        │   Character, WorldState, Economy, EventEngine,  │
        │   JobSystem, BusinessSystem, SportsSystem, Clock │
        └───────────────────▲───────────────────────────┘
                            │
                    ┌───────┴────────┐
                    │  SaveProvider   │  → localStorage
                    └─────────────────┘
```

**Aturan keras:** `src/core/**` tidak boleh punya baris `import` apapun dari `react`, `react-dom`, atau `phaser`. Ini yang membuat seluruh logika game bisa dites dengan Vitest tanpa membuka browser sama sekali. Kalau suatu saat Claude Code merasa "lebih gampang" melanggar aturan ini, itu tandanya modelnya perlu dipikir ulang, bukan alasan untuk melanggar.

## 2. Sistem waktu (Clock)

- Satu modul `Clock` di simulation core: menyimpan `currentDay` (integer, hari ke berapa sejak game dimulai).
- Umur karakter dihitung dari `currentDay ÷ 365` (bulat ke bawah) + umur awal.
- Method `advanceDay()` dan `advanceWeek()` (memanggil `advanceDay()` 7 kali) — **hanya dipanggil dari UI saat pemain menekan tombol**, tidak pernah otomatis.
- Setiap `advanceDay()`: jalankan efek harian (gaji/biaya jika relevan hari itu, regenerasi energi, dll), lalu jalankan `EventEngine.roll()` untuk cek event acak.

## 3. Konten sebagai data

Pola yang dipakai: setiap "jenis konten" (pekerjaan, event kehidupan, jenis bisnis, cabang olahraga) adalah array objek di file `src/data/*.json` atau `*.ts`, dengan bentuk kurang lebih:

```ts
// src/data/events.ts (contoh bentuk, bukan final — didetailkan saat implementasi)
interface LifeEvent {
  id: string;
  title: string;
  eligibility: (character: Character) => boolean; // siapa yang bisa kena event ini
  probabilityPerDay: number; // basis peluang, bisa dimodifikasi oleh faktor (usia, kesehatan, dst)
  effects: EventEffect[]; // efek terstruktur, bukan teks bebas — lihat §4
}
```

Satu "engine" generik (`EventEngine`) membaca semua entri dan menjalankannya — menambah event baru = menambah entri data baru, idealnya tanpa menyentuh `EventEngine` itu sendiri.

## 4. State shape (sketsa awal, akan berkembang)

```ts
interface Character {
  id: string;
  name: string;
  ageInDays: number;
  stats: { money: number; health: number; energy: number; mood: number };
  attributes: { intelligence: number; physical: number; charisma: number };
  career: CareerState; // job biasa, atau business, atau sports — lihat §5
  location: LocationId; // di mana karakter berada di peta saat ini
}

interface WorldState {
  clockDay: number;
  character: Character;
  eventLog: EventLogEntry[]; // riwayat singkat untuk ditampilkan & untuk Life Summary
}
```

Interface pasti akan berubah seiring implementasi — yang penting bentuknya **serializable ke JSON** (tidak ada fungsi/class instance di dalam state) supaya gampang di-save.

## 5. Sistem karier (job / business / sports)

Tiga jalur karier direpresentasikan sebagai satu union type `CareerState`, supaya cuma ada satu slot karier aktif per karakter (v1 tidak mendukung dua karier sekaligus, biar simpel):

```ts
type CareerState =
  | { type: 'job'; jobId: string; tenureDays: number }
  | { type: 'business'; businessTypeId: string; capital: number }
  | { type: 'sports'; sportId: string; skillLevel: number };
```

Masing-masing punya modul sendiri (`src/core/careers/job.ts`, `business.ts`, `sports.ts`) dengan fungsi `tick(character, careerState) → effects`, dipanggil dari `Clock.advanceDay()`.

## 6. RNG deterministik

Satu instance RNG seeded (pakai library kecil seperti `seedrandom` atau implementasi sendiri) disimpan di simulation core, di-inject ke `EventEngine` dan sistem karier — **jangan panggil `Math.random()` langsung di tempat lain**. Ini membuat bug bisa direproduksi (catat seed-nya) dan test jadi stabil.

## 7. Save system

- `SaveProvider` interface: `save(state: WorldState): void`, `load(): WorldState | null`, `clear(): void`.
- Implementasi v1: `LocalStorageSaveProvider`, serialize `WorldState` ke JSON.
- Simpan juga `schemaVersion` di dalam save data, supaya kalau struktur berubah nanti, ada tempat untuk logika migrasi (tidak perlu dibangun sekarang, cukup disiapkan tempatnya).
- Auto-save di setiap `advanceDay()` (state kecil, localStorage cukup cepat untuk ini).

## 8. Struktur folder yang diusulkan

```
src/
  core/                  # simulation core — TS murni, TIDAK import react/phaser
    Clock.ts
    Character.ts
    EventEngine.ts
    careers/
      job.ts
      business.ts
      sports.ts
    save/
      SaveProvider.ts
      LocalStorageSaveProvider.ts
    bus.ts               # event bus penghubung ke UI & world
  data/                  # semua konten sebagai data
    jobs.ts
    events.ts
    businesses.ts
    sports.ts
    locations.ts
  ui/                    # React — dashboard, menu, layar event, life summary
  world/                 # Phaser — scene peta, sprite, kontrol jalan
  main.tsx               # entry point, merangkai core + ui + world
test/
  core/                  # test Vitest, mengikuti struktur src/core/
```

## 9. Strategi testing

- Setiap fungsi di `src/core/` yang mengandung logika (bukan cuma tipe data) butuh test Vitest.
- Minimal: test untuk `Clock.advanceDay()`, `EventEngine.roll()` (pakai RNG seeded supaya hasilnya predictable di test), dan tiap sistem karier.
- Tidak perlu test end-to-end/browser di v1 kecuali proyek sudah stabil dan user memintanya.

## 10. Deployment (target: gratis selamanya)

- `npm run build` (Vite) menghasilkan folder `dist/` statis.
- Deploy ke **GitHub Pages** lewat GitHub Actions (workflow build otomatis tiap push ke `main`), atau alternatif Cloudflare Pages — keduanya gratis tanpa batas untuk proyek personal seperti ini.
- **Milestone paling awal (lihat `docs/ROADMAP.md` Fase 0): pastikan pipeline deploy ini jalan duluan**, bahkan sebelum ada game logic — supaya kita tahu "cara mainnya" (link publik) sudah beres dari awal.

## 11. Keputusan tercatat

Ditulis di sini supaya keputusan tidak hilang atau berubah-ubah antar sesi kerja
(lihat §3 dan `CLAUDE.md`). Tambahkan entri baru ke bawah, jangan menghapus yang lama.

### 2026-09-22 — Fase 0

| Keputusan | Isi | Alasan |
|---|---|---|
| Nama repo & URL live | `Ayyzac/real-life-sim` → https://ayyzac.github.io/real-life-sim/ | Repo harus **publik**: GitHub Pages di repo private butuh GitHub Pro berbayar, melanggar batasan $0 di `CLAUDE.md`. |
| `base` di `vite.config.ts` | `'/real-life-sim/'` | Wajib sama persis dengan nama repo. Kalau tidak, GitHub Pages menyajikan HTML-nya tapi semua aset 404 dan halaman tampil kosong. **Kalau nama repo diganti, nilai ini harus ikut diganti.** |
| Bahasa teks dalam game | **Inggris** untuk semua teks yang dilihat pemain. Dokumen desain, komentar diskusi dengan user, dan penjelasan tetap Bahasa Indonesia. | Keputusan user, 22 Sep 2026. Belum ada sistem i18n — teks masih ditulis langsung di komponen. Kalau nanti butuh dua bahasa, itu keputusan terpisah. |
| Versi Phaser | Dikunci `^3.90.0` | `npm install phaser` sekarang memberi **Phaser 4.2.1**, yang dilarang `CLAUDE.md`. Jangan jalankan `npm update phaser` tanpa memeriksa ini. |
| Versi lain saat Fase 0 | Vite 8, React 19, TypeScript 7 (strict), Vitest 5, Node 24 | Node 24 dipakai di CI agar sama dengan mesin developer. |
| Penegakan aturan core | `scripts/check-core-purity.mjs`, dijalankan lokal (`npm run check:core-purity`) dan di CI | §1 menyebut "aturan keras" tapi tidak ada yang menegakkannya. Skrip ini menggagalkan build kalau ada file di `src/core/**` yang mengimpor `react`, `react-dom`, atau `phaser`. Sudah diuji: sengaja dilanggar → exit code 1. |
| Gerbang mutu CI | `typecheck` → `test` → `check:core-purity` → `build`, berurutan sebelum deploy | Kode rusak tidak boleh sampai ke link publik. |
| Animasi di `BootScene` | Boleh, hanya render | `CLAUDE.md` aturan 3 melarang *state simulasi* maju sendiri, bukan animasi. Tidak ada `setInterval` yang menyentuh state. |

### Belum diputuskan (tanyakan user sebelum mengerjakan)

- **Linter/formatter** (ESLint, Prettier): sengaja belum dipasang, tidak diatur dokumen manapun.
- **Skema kontrol karakter** di peta (WASD vs klik-jalan): dijadwalkan Fase 2, lihat `docs/ROADMAP.md`.
- **Ukuran bundel:** build Fase 0 sudah 1,4 MB (388 KB gzip), hampir semuanya Phaser. Wajar, tapi kalau nanti terasa lambat dibuka, itu bahan polish Fase 5 — bukan masalah sekarang.
