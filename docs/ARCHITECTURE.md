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

### 2026-09-22 — Fase 1 Demo A

| Keputusan | Isi | Alasan |
|---|---|---|
| Satu klik = **satu minggu** | Tombol utama "Advance Week"; "Advance Day" tetap ada untuk momen penting. `Clock` internal tetap berbasis hari sesuai §2. | Keputusan user. Satu kehidupan ≈ 2.970 klik (~3 jam). Perhitungan yang mendasarinya: 1 klik = 1 hari berarti **20.805 klik** per kehidupan — tidak akan pernah diselesaikan siapa pun. |
| Fokus **menetap** | Karakter punya satu `focusId` yang bertahan sampai pemain menggantinya, bukan dipilih ulang tiap tick. | Dengan ~3.000 klik, memaksa memilih ulang tiap minggu itu menyiksa. Efeknya per hari, jadi `advanceDay` dan `advanceWeek` sama-sama konsisten. |
| Tanpa library state | React `useSyncExternalStore` membaca `GameStore`. Tidak ada Zustand/Redux/Jotai. | Bawaan React sudah persis untuk kasus ini. Satu dependency lebih sedikit. |
| RNG implementasi sendiri | `src/core/rng.ts`, mulberry32, ±15 baris. Bukan `seedrandom`. | §6 memang membolehkan. State-nya satu uint32 sehingga ikut tersimpan di save — muat ulang melanjutkan urutan acak yang sama persis. |
| `GameStore` + `GameIntent` sebagai batas antar-lapisan | UI tidak pernah memanggil engine langsung; ia mengirim intent dan mendengar lewat `subscribe` (dibangun di atas `bus.ts`). | Menegakkan `CLAUDE.md` aturan 5 secara konkret. Fase 2 (Phaser) memakai pintu yang sama. |
| `WorldState` **immutable** | Setiap fungsi di `clock.ts` mengembalikan objek baru, tidak pernah memutasi. | Wajib agar `useSyncExternalStore` bisa mendeteksi perubahan lewat identitas, sekaligus menjaga state tetap serializable. |
| Auto-save per **aksi pemain**, bukan per hari simulasi | §7 menulis "setiap `advanceDay()`"; satu klik minggu = 7 hari tapi tetap 1 penulisan. | Sama maksudnya, 7× lebih sedikit penulisan ke localStorage. |
| UI menampilkan angka **per minggu** | Data tetap ditulis per hari di `balance.ts`/`focuses.ts`; UI mengalikan 7. | Pemain beraksi per minggu. Menampilkan "-5/hari" padahal tombolnya mingguan itu menyesatkan. |
| Skala atribut 10× lebih lambat dari stat | Stat (energi/mood) bergerak dalam hitungan minggu; atribut (Intelligence dsb.) dalam hitungan tahun. | Tanpa ini, tangga karier habis dipanjat dalam **9 minggu** — terbukti lewat simulasi 2.600 minggu. Sekarang jadi Software Developer butuh ~4 tahun. |
| Utang diperbolehkan | Uang boleh minus; aktivitas berbayar tidak diblokir. Ditandai `ponytail:` di `clock.ts`. | Penyederhanaan sadar untuk Demo A. Aturan keterjangkauan yang benar masuk balancing Fase 5. |

**Temuan balancing dari simulasi seumur hidup (jangan dilupakan):**
- Angka awal membuat kesehatan macet di ~0 seumur hidup (spiral kelelahan). Sudah diperbaiki lewat `balance.ts` saja, tanpa menyentuh mesin — bukti pola "konten = data" bekerja.
- **Celah yang belum ditutup:** uang menumpuk sampai ~$900rb seumur hidup karena belum ada yang bisa dibeli. Penyerap uang baru datang di Fase 3 (bisnis) dan Fase 5. Jangan tambal dengan menaikkan biaya hidup — itu cuma menghukum awal permainan.
- Promosi butuh atribut yang terus naik, bukan sekadar lama bekerja. Pemain yang berhenti belajar tidak akan naik level. Ini disengaja (GDD §4.1), tapi perlu dijelaskan ke pemain suatu saat.

### 2026-09-22 — Fase 1 Demo B

| Keputusan | Isi | Alasan |
|---|---|---|
| **Minggu bisa terhenti** | Event yang butuh keputusan menghentikan minggu di hari itu. Sisa hari disimpan di `WorldState.pendingEvent.daysRemaining` dan dimainkan otomatis setelah pemain menjawab. | Keputusan user. Konsekuensi penting: kondisi "minggu setengah jalan" **wajib ikut tersimpan di save** — kalau tidak, tutup browser saat dialog terbuka akan menghanguskan sisa minggu. Ada test khusus untuk ini. |
| Satu undian per hari, bukan per event | `EventEngine` melempar dadu sekali per hari (`BALANCE.eventChancePerDay`), lalu memilih satu event secara berbobot. Ini **menyimpang** dari sketsa §3 yang memberi tiap event `probabilityPerDay` sendiri. | §3 menyebut dirinya "contoh bentuk, bukan final". Dengan ~3.600 minggu per kehidupan, membiarkan selusin event mengundi sendiri-sendiri akan menenggelamkan pemain. Sekarang kecepatan event diatur satu angka. |
| **Kematian selalu didahului tanda** | Tidak ada kematian mendadak. Kematian hanya terjadi saat kesehatan menyentuh 0. | Keputusan user. Dijaga tiga aturan yang saling mengunci — lihat tabel di bawah. |
| Umur harapan target 85-95 | `healthDecayPerDayPerYearOver: 0.04`. Pemain cermat mati di 86-88. | Keputusan user. **Dipatok sebagai test** di `test/core/longRun.test.ts` — siapa pun yang menggeser kurva tanpa sadar akan dapat test merah, bukan perubahan diam-diam. |
| `applyDailyRules` dipisah dari undian event | Aturan harian yang pasti (fokus, gaji, biaya, penuaan) terpisah dari lemparan dadu. | Awalnya menyatu, dan akibatnya aturan harian tidak bisa dites tepat — event acak mengubah angkanya. Sekarang keduanya bisa dites sendiri-sendiri. |
| `schemaVersion` naik ke **2** | Bentuk save berubah (`milestones`, `peakMoney`, `pendingEvent`, `deathCause`). Save lama dibuang, tidak dimigrasi. | Belum ada pemain selain user, jadi menulis logika migrasi sekarang adalah kode yang tidak dipakai siapa pun. Tempatnya sudah disiapkan di `LocalStorageSaveProvider.load()`. |

**Tiga aturan yang bersama-sama menjamin "kematian selalu didahului tanda":**

| Aturan | Angka | Kenapa ada |
|---|---|---|
| Lantai kelelahan | `exhaustionHealthFloor: 25` | Kelelahan **melemahkan, tidak membunuh**. Tanpa ini, pemain yang tidak pernah istirahat mati dalam 8 bulan — terlalu cepat untuk disebut "penurunan yang terlihat". |
| Lantai event | `eventHealthFloor: 1` | Satu event tidak boleh membunuh orang sehat. Ia boleh membawa ke ambang, penurunan harian yang menyelesaikan. |
| Pengecualian kritis | `criticalHealth: 15` | Di bawah garis ini event **boleh** menyelesaikan. **Tanpa ini karakter di bawah umur 45 benar-benar tidak bisa mati** — kelelahan berhenti di lantainya, penuaan belum mulai. Ditemukan lewat test, bukan lewat bermain. |

**Tangga kesulitan yang dihasilkan (hasil simulasi, bukan tebakan):**

| Gaya main | Umur mati |
|---|--:|
| Tidak pernah istirahat | 19-28 |
| Istirahat, tidak pernah berobat | ~50 |
| Istirahat + berobat | 86-88 |

Uang baru benar-benar penting di usia tua — itulah alasan menabung, dan sebagian jawaban atas celah "uang menumpuk tanpa guna".

**Invarian yang tidak dijaga tipe data:** `WorldState.clockDay` dan `character.ageInDays` **harus selalu sama**. Keduanya naik bersama di `applyDailyRules`, tapi tidak ada yang memaksanya. Saat melenceng, Life Summary mencetak tanggal ngawur tanpa error. Sudah dipatok test di `clock.test.ts`.

### Belum diputuskan (tanyakan user sebelum mengerjakan)

- **Linter/formatter** (ESLint, Prettier): sengaja belum dipasang, tidak diatur dokumen manapun.
- **Skema kontrol karakter** di peta (WASD vs klik-jalan): dijadwalkan Fase 2, lihat `docs/ROADMAP.md`.
- **Ukuran bundel:** build Fase 0 sudah 1,4 MB (388 KB gzip), hampir semuanya Phaser. Wajar, tapi kalau nanti terasa lambat dibuka, itu bahan polish Fase 5 — bukan masalah sekarang.
