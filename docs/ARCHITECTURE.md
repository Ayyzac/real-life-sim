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
- **Sejak Fase 6:** `WorldState.minuteOfDay` menyimpan jam di dalam hari. Jam hanya
  maju lewat aksi pemain (`doAction`, `startBlock`) di `src/core/day.ts`.
  `advanceDay()` = **tidur**: aturan harian yang lama berjalan utuh, lalu jam kembali
  ke 07:00. Waktu yang di-skip tidak menurunkan kebutuhan — itulah yang membuat
  autopilot tetap "hidup wajar" dan semua test keseimbangan seumur hidup tetap sah.
  Aturan mainnya di `GDD.md` §11.

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

### 2026-09-22 — Fase 2 (diputuskan di chat, sebelum implementasi)

Diambil di sesi chat 22 Sep 2026 dan ditulis ke sini **sebelum kode ditulis**,
supaya sesi berikutnya tidak perlu menebak. Anggap FINAL — jangan tanya ulang.

| Keputusan | Isi | Alasan |
|---|---|---|
| **Tampilan tetap 2D** | 2D pixel art top-down. **Bukan 3D.** | User sempat mengira kesepakatan awal adalah game 3D seperti Stardew Valley. Dicek ke dokumen: tidak. `GDD.md` menyebut 2D di empat tempat (§1, §2, §5) dan §7 menaruh "Grafis 3D" **di luar scope v1**; `ASSETS.md` memperingatkan memilih aset top-down 2D, "bukan isometrik/3D". Stardew Valley sendiri game 2D. User sudah diberi tahu dan **memilih tetap 2D**. **Kalau 3D disinggung lagi, tunjukkan fakta ini dulu sebelum mengerjakan apa pun.** |
| **Skema kontrol: klik-untuk-jalan** | Pemain mengklik tujuan, karakter berjalan sendiri ke sana. Bukan WASD. | Keputusan user. Ini menutup item "belum diputuskan" yang diminta `ROADMAP.md` Fase 2 untuk dicatat di sini. |
| Ukuran kota | **5 lokasi**: Rumah, Kerja, Gym, Kafe, Rumah Sakit. | Keputusan user. Kota kecil sesuai `GDD.md` §5; cukup untuk membuktikan loop peta tanpa membengkakkan pekerjaan. |
| Tab lokasi Fase 1 **tetap ada** | Tab lama bertahan sebagai jalan pintas di samping peta. | Keputusan user: peta jadi pilihan, bukan pajak. **Konsekuensi teknis wajib:** tab aktif harus dibaca dari `character.location`, bukan `useState` lokal seperti sekarang. Peta dan tab adalah dua pintu ke satu state yang sama — kalau tidak, keduanya bisa menampilkan lokasi berbeda. |
| Keramaian: **kota ramai** | Banyak NPC berjalan + mobil lewat, **murni hiasan**: tidak berinteraksi, tidak menyentuh state simulasi. | Keputusan user, diambil **setelah** diperingatkan soal risiko performa. Tidak melanggar `CLAUDE.md` aturan 3 karena ini animasi render, bukan perubahan state. **Kewajiban:** FPS harus diukur sungguhan di browser dengan jumlah penuh dan angkanya dilaporkan apa adanya. Kalau tidak sanggup 60fps, sampaikan angkanya dan tanya — jangan diam-diam menguranginya. |
| Sprite pemain | **Satu sprite** dulu. | Keputusan user. Pilihan tampilan sprite saat pembuatan karakter (`GDD.md` §3.2) tetap jadi utang yang dibayar nanti. |
| Ukuran peta & kamera | Grid **25×14 tile @16px = 400×224**, di-zoom 2× jadi **800×448**. **Tanpa kamera bergerak.** | Pas satu layar di kanvas yang sudah ada. Peta 5 lokasi tidak butuh kamera; menambahkannya nanti murah. |
| Peta sebagai **data** | `src/data/town.ts`: grid tile, daftar pintu (posisi tile → `LocationId` yang sudah ada), tile yang bisa dilewati, jumlah NPC & mobil. | `CLAUDE.md` aturan 2 — konten adalah data, bukan kode. Mengubah tata letak kota = mengedit data, bukan menulis logika baru. |
| Pencarian jalan: **BFS, bukan A\*** | `src/world/pathfinding.ts`, TypeScript murni **tanpa impor Phaser**, bisa dites headless. | Grid cuma ~350 kotak dan semua langkah berbiaya sama, jadi BFS sudah optimal dan setengah kodenya A\*. Tanpa pathfinding, klik-untuk-jalan akan menyangkut di balik gedung — bug yang langsung terlihat user. |
| Scene baru | `src/world/scenes/TownScene.ts` menggantikan `BootScene.ts` (placeholder Fase 0 dibuang). Pemain muncul di pintu `character.location` saat dimuat. | |
| Peta naik jadi tampilan utama | Di `src/ui/App.tsx`, kanvas keluar dari `<details>`. | Peta adalah isi Fase 2; menyembunyikannya di balik disclosure membuat fase ini tak terasa. |
| `enterLocation` **ditolak saat ada event menunggu** | Intent baru `{ type: 'enterLocation'; locationId }` di `src/core/store.ts` harus diblokir selama `pendingEvent` ada. Dipatok test. | Lihat Fase 1 Demo B: minggu bisa terhenti di tengah. Kalau peta tetap bisa dipakai saat dialog event terbuka, "minggu yang terhenti" bisa dilangkahi. |

**Tidak dikerjakan di Fase 2** (sengaja, jangan diselundupkan masuk): interior
gedung, pilihan tampilan sprite, kamera bergerak, peta lebih besar, NPC yang
bisa diajak bicara.

#### Aset Fase 2 — sudah diverifikasi, jangan riset ulang

**Kenney "RPG Urban Pack"** — https://kenney.nl/assets/rpg-urban-pack

| Hal | Isi |
|---|---|
| Kategori | 2D (bukan isometrik, bukan 3D) |
| Ukuran tile | 16×16 |
| Jumlah file | 480 |
| Lisensi | **CC0** — bebas dipakai, termasuk komersial, tanpa atribusi wajib |
| Tag | `city`, `urban`, `character`, `pixel` |
| Isi | Kota modern top-down: jalan, zebra cross, gedung, mobil, pohon, sprite orang beberapa arah |

Dipilih karena persis "kota modern" di `GDD.md` §1 dan sudah disebut namanya di
`ASSETS.md`. **Unduhan (zip ±1-2 MB) butuh izin user lebih dulu**; tujuannya
`public/assets/town/` (Vite menyalin apa adanya, tidak ikut di-bundle), berkas
LICENSE dari paket ikut disimpan, dan sumbernya dicatat di `docs/ASSETS.md`.
Ini satu-satunya unduhan di fase ini.

### 2026-09-22 — Fase 2 (hasil implementasi)

Yang berubah, dan yang digigit di jalan. Entri di atas adalah keputusannya;
ini adalah apa yang sebenarnya terjadi saat dikerjakan.

| Keputusan | Isi | Alasan |
|---|---|---|
| `GameStore` **diserahkan** ke Phaser, bukan di-impor | `createPhaserGame(parent, store)`; `TownScene` menerimanya lewat constructor. | Kalau scene mengimpor `gameStore` dari `src/ui/useGame.ts`, lapisan dunia jadi bergantung pada lapisan UI. Sekarang arah ketergantungannya tetap satu arah, dan scene tetap memakai pintu yang sama dengan React: `dispatch` + `subscribe`. |
| Gedung & properti sebagai **objek data**, hanya lantai sebagai gambar ASCII | `GROUND` adalah 14 baris berisi 25 huruf; gedung, pohon, dan mobil adalah daftar objek. | Menggambar gedung sebagai ASCII berarti satu huruf per warna dinding per baris jendela — tidak terbaca dan gampang salah. Bentuk gedung selalu persegi, jadi lebih jujur ditulis sebagai `{x, y, width, height}`. |
| Grid bisa-dilewati **dihitung**, tidak disimpan | `buildWalkable()` menurunkannya dari lantai + gedung + properti setiap kali dipanggil. | Kalau disimpan terpisah, ia akan melenceng dari petanya diam-diam — persis jenis bug yang tidak menimbulkan error. |
| Pintu **bisa dilewati**, sisanya tidak | Sampai di petak pintu = membuka menu lokasi. | Pemain berjalan sampai ke pintu, bukan berhenti di depannya lalu menebak-nebak. Petak pintu hanya bisa dicapai dari trotoar di bawahnya, jadi tidak mungkin terlewati tanpa sengaja. |
| RNG keramaian **terpisah** dari RNG simulasi | `createCrowd` diberi `createRng(0x7ac0).next` sendiri. | Kalau hiasan menarik dari RNG simulasi, jumlah NPC akan menggeser urutan undian event — dan `WorldState.rng` ikut tersimpan di save, jadi efeknya permanen. Hiasan tidak boleh mengubah permainan. |
| Gedung beton diberi **tint** | `TownBuilding.tint`, dipakai Kerja (biru) dan Rumah Sakit (mint). | Dinding beton di paket Kenney warnanya sama persis dengan trotoar. Tanpa tint, dua gedung itu terbaca sebagai pelataran kosong, bukan bangunan. |
| `BootScene.ts` dihapus | Placeholder Fase 0 diganti `TownScene.ts`. | Tugasnya (membuktikan kanvas Phaser hidup) sudah selesai dan sekarang dibuktikan oleh peta sungguhan. |
| Tab lokasi tidak lagi punya state sendiri | `LocationMenu` membaca `character.location`; mengklik tab mengirim `enterLocation`. | Ini yang membuat peta dan tab jadi dua pintu ke satu state. Sudah diuji dua arah di browser: klik gedung → tab ikut pindah; klik tab → karakter berjalan di peta. |

**Dua jebakan Phaser yang benar-benar menggigit** (keduanya gagal tanpa pesan
error apa pun — catat di sini supaya sesi berikutnya tidak membuangnya lagi):

| Jebakan | Gejala | Penyelesaian |
|---|---|---|
| `Phaser.Input.Events.POINTER_DOWN` bernilai `undefined` di build ini | `this.input.on(undefined, ...)` mendaftarkan listener yang **tidak pernah dipanggil**, dan tidak ada error sama sekali. Peta tampak normal, klik tidak melakukan apa-apa. | Pakai nama event literal: `'pointerdown'`, `'shutdown'`, `'destroy'`. |
| Phaser menyimpan (cache) posisi kanvas | `pointer.x/y` meleset sampai ~500 px, bahkan memberi baris negatif di atas peta. Phaser hanya membaca ulang posisi kanvas saat jendela di-resize, padahal kanvas ini duduk di bawah panel React yang tingginya berubah setiap dialog event muncul. | `toCanvasPoint()` di `TownScene` mengukur sendiri dari DOM (`getBoundingClientRect`) setiap klik. **Jangan** kembali memakai `pointer.worldX`. |

**Performa keramaian — angka sungguhan, bukan perkiraan.** Diukur di browser
dengan jumlah penuh (24 NPC + 8 mobil, `CROWD` di `src/data/town.ts`):

| Ukuran | Hasil |
|---|--:|
| Frame per detik | **165 fps** (mentok di refresh rate monitor, bukan di gamenya) |
| Frame terlama dari 660 frame | **7,3 ms** (anggaran 60 fps = 16,7 ms) |

Keramaian tidak mendekati batas. Kalau suatu saat perlu lebih ramai,
`CROWD.people` dan `CROWD.cars` tinggal dinaikkan — tapi ukur ulang, jangan
menebak.

**Ukuran bundel sesudah Fase 2:** 1,45 MB (400 KB gzip). Hampir tidak berubah
dari Fase 0 — tilesheet-nya cuma 18 KB dan disajikan sebagai berkas statis,
tidak ikut di-bundle.

### 2026-09-22 — Fase 3 (jalur karier bisnis)

Aturan mainnya ada di `docs/GDD.md` §4.2. Yang di sini adalah keputusan teknis
dan **angka hasil simulasi**, bukan tebakan.

| Keputusan | Isi | Alasan |
|---|---|---|
| `CareerState` dapat varian ketiga | `{ type: 'business'; businessId; daysOpen; level }` | Bentuknya sengaja dibuat sekeluarga dengan varian `job`, jadi mesin harian dan UI menanganinya dengan pola yang sama. |
| `SCHEMA_VERSION` **tetap 2** | Menambah varian ke union tidak mengubah save lama: karakter lama tetap `none` atau `job`. | Menaikkan versi akan membuang save pemain tanpa perlu. Aturan "ubah bentuk save = naikkan angkanya" berlaku untuk perubahan yang merusak, bukan penambahan. |
| Share "ditelantarkan" ada di **data per usaha**, bukan satu angka global | `BusinessDefinition.neglectedShare`: warung 0,55 · toko online 0,65 · bengkel 0,25. | Inilah yang membuat ketiganya terasa berbeda. Dengan satu angka global, ketiga usaha cuma versi besar-kecil dari benda yang sama. |
| Tingkat usaha dibatasi 3 | `BALANCE.business.upgradeCost` punya 4 entri; `upgradeCost()` mengembalikan `null` di puncak. | Tanpa batas, pemain bertabungan besar bisa membeli pemasukan tak terbatas. Dipatok test. |
| `takeJob` **menolak** pemilik usaha | Guard di `store.ts`, plus penjelasan di UI papan lowongan. | Tanpa ini, mengambil pekerjaan menghapus usaha **berikut modal yang sudah dibayar**, tanpa error dan tanpa peringatan. |
| Peringatan rugi di dashboard | Muncul saat laba mingguan usaha negatif. | User memilih **tanpa bangkrut otomatis**. Peringatan ini yang memastikan kerugian tidak terjadi diam-diam — sejalan dengan prinsip "kematian selalu didahului tanda" di Fase 1. Ditambahkan atas inisiatif Claude; boleh dicoret kalau user tidak mau. |
| Event bisnis murni data | 4 entri baru di `events.ts` dengan `eligibility: hasBusiness`. | Mesin event tidak disentuh sama sekali — bukti pola "konten = data" masih bekerja tiga fase kemudian. |

**Hasil simulasi seumur hidup** (3 seed, dirata-rata; uang di akhir hidup).
Inilah yang dipakai untuk menyetel angkanya — bukan perkiraan:

| Cara main | Uang seumur hidup |
|---|--:|
| Kerja kantoran (clerk) | $348.000 |
| Warung, ditunggui | $469.000 |
| Programmer (pekerjaan bergaji tertinggi) | $1.374.000 |
| Toko online, sambil kuliah (pasif) | $1.093.000 |
| Toko online, ditunggui | $1.885.000 |
| Bengkel, ditunggui | $2.167.000 |
| **Warung, ditelantarkan sambil kuliah** | **−$450.000** |
| **Bengkel, ditelantarkan** | **−$968.000** |

Yang dibaca dari tabel itu:
- Usaha termahal harus jadi yang terbaik kalau ditunggui, kalau tidak tidak ada
  alasan membelinya. Percobaan pertama **gagal di titik ini** — bengkel kalah
  dari toko online meski modalnya dua kali lipat. Pemasukan bengkel dinaikkan
  128 → 150/hari, dan urutannya benar. Ini ditemukan lewat simulasi, bukan
  lewat membaca kode.
- Toko online yang ditelantarkan tetap menghasilkan banyak — itu memang
  "penghasilan pasif" yang dijanjikan, dan alasan utama memilih jalur bisnis.
- Bengkel yang ditelantarkan menghabiskan hampir sejuta seumur hidup. Itu
  disengaja dan diperingatkan di dashboard.
- **Umur harapan tidak bergeser**: 85-88 tahun di semua jalur. Kurva kematian
  Fase 1 tidak tersentuh.

Yang dipatok sebagai test (`test/core/longRun.test.ts`) adalah **urutannya**,
bukan angka persisnya, supaya menyetel balancing tidak langsung memerahkan test
tanpa alasan.

**Celah "uang menumpuk" belum tertutup.** Modal + investasi seluruhnya sekitar
$94.000 seumur hidup, melawan pemasukan jutaan. Bisnis memberi uang *tujuan*,
belum memberinya *batas*. Penyerap berikutnya ada di Fase 5.

### 2026-09-22 — Fase 4 (jalur karier olahraga + peta dua distrik)

Aturan mainnya ada di `docs/GDD.md` §4.3. Di sini keputusan teknisnya, angka
hasil simulasi, dan dua bug yang ditemukan sambil jalan.

| Keputusan | Isi | Alasan |
|---|---|---|
| **Peta jadi dua distrik** | Satu grid 50x14. Kamera menampilkan 25 kolom (satu layar) dan menggeser antar distrik lewat tombol panah di peta. Distrik: Downtown, Eastside. | **Permintaan user, 22 Sep 2026.** Ini mencabut keputusan Fase 2 "tanpa kamera bergerak, peta lebih besar tidak dikerjakan" — yang memang sudah menulis "menambah kamera nanti murah". Satu grid, bukan dua peta: pencarian jalan tidak perlu tahu apa-apa soal distrik, dan karakter tinggal berjalan menyeberang. |
| Geser kamera **dihitung sendiri**, bukan pakai `this.tweens` | `slideCamera()` menaikkan waktu berlalu dan meng-interpolasi `scrollX` sendiri. | Tween pada kamera menggesernya beberapa piksel lalu berhenti — jenis kegagalan diam yang sama dengan konstanta event Phaser yang `undefined` di Fase 2. Sepuluh baris sendiri selalu jalan. |
| Tombol distrik **di dalam scene Phaser**, dites sendiri | Posisinya dihitung dari kamera tiap frame; kliknya dicocokkan manual di `onPointerDown`. | Phaser `setInteractive` memakai posisi pointer yang sama yang dulu meleset 500 piksel. Satu jalur input yang sudah terbukti, untuk semuanya. |
| Pertandingan **di luar `applyDailyRules`** | `playDueMatch()` dipanggil dari `simulateOneDay` dengan RNG, setelah aturan harian. | Menjaga pemisahan yang dibuat di Fase 1: aturan harian = pasti dan bisa dites tepat, lemparan dadu = terpisah. Menaruh pertandingan di `applyDailyRules` akan merusak itu. |
| Hitungan pertandingan hanya maju di **hari latihan** | `daysSinceMatch` naik hanya saat fokus melatih. | Istirahat menunda pertandingan, bukan menghanguskannya. Lebih memaafkan, dan membuat latihan terasa berarti. |
| Sepak bola dinilai dari **Physical**, bukan Charisma | Charisma tetap jadi syarat masuk. | Versi pertama menilai sepak bola dari Charisma, padahal latihan tidak pernah menaikkan Charisma — jadi pemain **tidak akan pernah bisa jadi bagus**. Perangkap yang cuma kelihatan lewat simulasi. |
| Sponsor hanya mendatangi atlet **yang masih di puncak** | `eligibility` event `sponsorship_offer` dibatasi umur puncak + 4 tahun. | Tanpa itu, atlet umur 70 masih dapat tawaran sponsor, dan uangnya membiayai karier yang seharusnya sudah berakhir — diam-diam membuat "tidak pernah pensiun" jadi pilihan terbaik. |
| `SCHEMA_VERSION` **tetap 2** | Menambah varian ketiga ke union karier tidak merusak save lama. | Sama alasannya dengan Fase 3. |

**Bug lama yang akhirnya ketahuan: dua game Phaser hidup sekaligus.**

`GameCanvas` membuat game, lalu React StrictMode meng-unmount dan me-mount lagi.
Scene memuat tilesheet, jadi game pertama **masih boot** saat unmount datang, dan
`destroy()` sebelum boot cuma menyalakan penanda untuk step loop yang belum
mulai — jadi penanda itu tidak pernah dibaca. Hasilnya dua kanvas bertumpuk di
DOM: **satu menggambar peta, satu lagi diam-diam menerima klik.** Di Fase 2 dan 3
ini tidak terlihat karena kedua scene menghitung hal yang sama. Di Fase 4 langsung
terlihat: tombol distrik menggeser kamera yang tidak ada di layar. Sekarang game
dibuat sekali dan pembongkarannya ditunda satu tick — remount StrictMode
membatalkannya, unmount sungguhan meneruskannya.

**Catatan pengukuran:** FPS tidak bisa diukur ulang di sesi ini karena jendela
browser tidak menggambar (`requestAnimationFrame` berhenti total saat halaman
dianggap tersembunyi). Angka Fase 2 — 165 fps, frame terburuk 7,3 ms — diambil
saat **dua** game Phaser berjalan sekaligus, jadi itu batas bawah yang aman.
Keramaian dinaikkan ke 40 orang + 14 mobil untuk mengisi peta dua kali lipat.
**Ukur ulang saat ada kesempatan**, jangan anggap sudah terbukti.

**Hasil simulasi seumur hidup** (3 seed, dirata-rata):

| Cara main | Uang di akhir | Rekor |
|---|--:|---|
| Kerja kantoran (clerk) | $285.000 | — |
| Lari, sampai mati | $377.000 | 301-170 |
| **Lari, pensiun umur 40** | **$523.000** | — |
| Basket, sampai mati | $526.000 | 182-162 |
| **Basket, pensiun umur 40** | **$581.000** | — |
| **Sepak bola, sampai mati** | **$741.000** | 118-126 |
| Sepak bola, pensiun umur 40 | $570.000 | — |

Yang dibaca dari tabel itu:
- Ketiga cabang mengalahkan kerja kantoran, tapi semuanya **di bawah** jalur
  bisnis ($1,9-2,2 juta) dan programmer ($1,37 juta). Itu wajar: karier atlet
  punya jendela ~15 tahun, bukan seumur hidup.
- Untuk lari dan basket, **pensiun lebih menguntungkan** daripada bertanding
  sampai tua — itulah gunanya penurunan usia, dan dipatok test.
- Sepak bola **masih** lebih untung diteruskan, karena hadiahnya sangat besar
  sehingga menang 30% pun tetap menutupi biaya hidup. Dibiarkan: itu watak
  "satu-satunya yang bikin orang kaya". Kalau nanti terasa salah, angkanya ada
  di `src/data/sports.ts`.
- Rekor kalah-menang jadi negatif kalau pemain bertanding sampai tua. Pemain
  yang berhenti di puncak menang ~70%.

Perjalanan menuju angka itu butuh tiga kali koreksi: hadiah kalah awalnya lebih
besar daripada biaya hidup (jadi tidak pernah ada alasan berhenti), lantai
penurunan usia terlalu murah hati (atlet umur 60 masih menang separuh), dan lari
serta basket tidak layak dipilih dibanding kerja kantoran.

### 2026-09-22 — Fase 5 (keputusan, ditulis sebelum kode)

Fase penutup. Semua di bawah ini dijawab user lewat pertanyaan satu per satu
pada 22 Sep 2026. Aturan mainnya ada di `docs/GDD.md` §9–§10; ini sisi
teknisnya dan alasan di baliknya.

| Keputusan | Isi | Alasan / konsekuensi |
|---|---|---|
| **Tiga penyerap uang sekaligus** | Barang permanen, taraf gaya hidup, dan keluarga. | User memilih ketiganya. Ini bukan polish melainkan tiga sistem baru — sudah disampaikan ke user sebelum dikerjakan. Ketiganya menyerap dengan cara berbeda (sekali bayar / terus-menerus / terus-menerus + sekali bayar) supaya pilihannya terasa berbeda. |
| **NPC punya hidup sendiri** | Menua, bekerja, menikah, punya anak, meninggal tanpa campur tangan pemain. | Permintaan eksplisit user. **Ini memindahkan sesuatu dari luar scope ke dalam scope** — `ROADMAP.md` mensyaratkan dokumen diubah dulu, dan itu sudah dilakukan di `GDD.md` §7. Sistem terbesar di seluruh proyek. |
| **Daftar orang dibatasi** | Yang hidup disimulasikan penuh; yang meninggal/pergi dipadatkan jadi satu baris kenangan. | **Wajib, bukan pilihan gaya.** Save hidup di localStorage dan dipatok test di bawah 100 KB. Tanpa pemadatan, 70 tahun kenalan menembus batas dan `save()` gagal **diam-diam** di tengah permainan — kelas bug terburuk di proyek ini. |
| `SCHEMA_VERSION` → **3, dengan migrasi** | Save versi 2 dibaca dan dilengkapi: keluarga kosong, belum punya barang, gaya hidup sederhana, sprite bawaan. | Pertama kalinya proyek ini menulis migrasi. Sampai Fase 4 save lama selalu dibuang, dengan alasan "belum ada pemain". Di fase penutup alasan itu habis: setelah ini orang benar-benar main, dan fitur terbanyak datang justru saat save paling rentan. |
| Penampilan karakter **murni tampilan** | 18 sprite dari tilesheet yang sudah ada. Tidak mempengaruhi aturan apa pun. | Menutup utang GDD §3.2 dengan kode paling sedikit. Mengikat aturan ke jenis kelamin akan menambah cabang di sistem yang sudah paling besar, dan tiap cabang butuh testnya sendiri. |
| Isi **dua kali lipat**, bukan sebanyak mungkin | ~45 event, ~10 pekerjaan, ~6 usaha, ~5 cabang olahraga. | Tiap entri baru menggeser keseimbangan. Dengan sistem keluarga yang juga baru, jumlah yang lebih besar tidak bisa dijamin masih masuk akal tanpa waktu penyetelan yang jauh lebih lama. |
| **Efek suara saja, tanpa musik** | Paket CC0, plus menu pengaturan dengan volume. | Musik yang sama selama berjam-jam menyiksa, dan `ASSETS.md` mencatat lisensi musik gratis lebih rumit daripada SFX. Menyalakan audio berarti **membereskan dulu** `audio: { noAudio: true }` yang dipasang di Fase 0 untuk menghindari error AudioContext saat React memuat ulang komponen. |
| Target kesulitan | Satu kehidupan cukup untuk **salah satu**: rumah bagus / keluarga besar / gaya hidup mewah. | Uang jadi bahan pilihan, bukan hitungan mundur. Ini angka yang dituju seluruh penyetelan Fase 5. |
| **ESLint/Prettier: tidak dipasang** | Item terakhir di daftar "Belum diputuskan" ditutup. | TypeScript ketat, 207 test, penjaga kemurnian core dan gerbang CI sudah menangkap yang penting; satu penulis kode berarti format tidak pernah bertengkar. |

**Dikerjakan bertahap (A–D di `ROADMAP.md`)** atas permintaan user, supaya tiap
bagian bisa dicoba dan bukan menunggu semuanya selesai. Bagian A memuat
perubahan bentuk save, jadi migrasi ikut di situ — bukan ditunda ke akhir.

#### Fase 5B — keluarga & hubungan (hasil implementasi)

Sistem terbesar di proyek ini, dan satu-satunya yang membuat data save tumbuh
seiring waktu. Aturannya di `docs/GDD.md` §10.

| Keputusan | Isi | Alasan |
|---|---|---|
| `people` dan `memories` di **`WorldState`**, bukan `Character` | Orang-orang adalah dunia di sekitar karakter; `Character` tetap berisi statistiknya sendiri. | Life Summary membaca `WorldState`, dan `eventLog`/`milestones` sudah tinggal di sana. |
| Bagian pasti dipisah dari lemparan dadu | `relationshipsOneDay()` (menua, kedekatan luntur, biaya anak) dipanggil dari `applyDailyRules`; `rollRelationships()` (kematian, menjauh, kelahiran, kenalan baru) dipanggil dari `simulateOneDay` bersama RNG. | Pola yang sama dengan event Fase 1 dan pertandingan Fase 4: aturan harian harus bisa dites sampai ke angkanya, tanpa dadu mengubah hasilnya. |
| **Paling banyak satu kejadian sosial per hari** | `rollRelationships` mengembalikan satu hasil dan berhenti. | Tanpa ini, log berubah jadi dinding teks di kehidupan yang panjang. |
| Kedekatan naik untuk **semua orang sekaligus** saat bersosialisasi | Fokus `socialize` ditandai `socialises: true` di data. | Alternatifnya (memilih siapa yang ditemui) berarti UI per-orang dan RNG memilih target. Untuk satu angka per orang, menaikkan semuanya sudah cukup dan jauh lebih sedikit kode. |
| Keluarga tidak bisa "menjauh" | Hanya `friend` dan `colleague` yang hilang karena diabaikan. | Orang tua tidak hilang dari hidup Anda karena lupa menelepon. Anak juga tidak. |
| Batas menikah: umur 20 | Ditemukan saat menguji di browser: teman awal berumur 17 muncul sebagai calon pasangan. | Ditambahkan sebagai angka di `balance.ts`, bukan aturan di mesin. |
| `SCHEMA_VERSION` tetap **3** | Migrasi Fase 5A sudah mengisi `people: []` dan `memories: []` untuk save lama. | Karakter yang dimigrasi mulai mencatat orang dari sekarang; tahun-tahun yang sudah lewat memang tidak merekam siapa pun. |

**Hasil simulasi seumur hidup** (3 seed, pemain cermat). Ini yang dipakai untuk
menyetel angkanya:

| Cara main | Kenalan seumur hidup | Masih ada di akhir | Menikah | Anak | Ukuran save |
|---|--:|--:|:--:|--:|--:|
| Rajin bersosialisasi | 20-23 | 9-11 | ya, umur 28-29 | 3-4 | ~16 KB |
| Kerja terus | 42-48 | 0-5 | tidak pernah | 0 | ~18 KB |

Yang dibaca dari tabel itu:
- Konsekuensinya terbaca jelas tanpa perlu dijelaskan: pemain yang hanya bekerja
  **tidak pernah menikah dan kehilangan hampir semua orang**, lalu terus bertemu
  orang asing baru yang juga pergi. Itu muncul sendiri dari aturannya, bukan
  ditulis khusus.
- **Save 16-18 KB**, jauh di bawah batas 100 KB yang dipatok test — bukti
  pemadatan kenangan bekerja.
- Pasangan hampir selalu meninggal lebih dulu. Karena itu kalimat penutup Life
  Summary diubah: cukup punya anak, tidak harus pasangan yang masih hidup.
  "Menikah enam puluh tahun" tidak boleh terhapus hanya karena hidup lebih lama.

Dua angka diperbaiki setelah membaca simulasi pertama: peluang bertemu orang
baru diturunkan (99 kenalan seumur hidup terlalu ramai) dan kurva kematian NPC
dilunakkan (mereka mati di awal 70-an, terlalu muda).

#### Fase 5C — isi & keseimbangan (hasil implementasi)

Isi naik kira-kira dua kali lipat, semuanya lewat penambahan entri data — mesin
tidak disentuh sama sekali:

| Jenis | Sebelum | Sesudah |
|---|--:|--:|
| Event kehidupan | 21 | **48** |
| Pekerjaan | 5 | **11** |
| Jenis usaha | 3 | **6** |
| Cabang olahraga | 3 | **5** |

**Utang akhirnya punya akibat.** Fase 1 membiarkan uang minus tanpa konsekuensi
dan mencatatnya sebagai penyederhanaan yang harus dibereskan di balancing Fase 5.
Sekarang: saat saldo negatif, mood dan kesehatan terkikis tiap hari, dengan
**lantai kesehatan** supaya utang menekan tapi tidak membunuh sendirian — janji
yang sama dengan lantai kelelahan di §6. Ditambah peringatan di dashboard, karena
tenggelam pelan-pelan tanpa sinyal adalah kelas bug terburuk di proyek ini.

**Yang ditemukan lewat simulasi, bukan lewat membaca kode:**

| Temuan | Perbaikan |
|---|---|
| Dua usaha baru **kalah di segala hal** dari yang lebih murah — tidak ada alasan membelinya | Angka disetel ulang, dan aturan testnya diganti: "yang lebih mahal harus lebih baik di salah satu sisi", bukan "pemasukan harus naik berurutan". Pemasukan mentah jadi ukuran yang salah begitu tiap usaha beda ketahanannya saat ditinggal. |
| Anak seharga $16/hari membuat **semua jalur karier bangkrut** — $420.000 seumur hidup | Diturunkan ke $7/hari. Empat anak sampai umur 18 kini sekitar $184.000, seukuran rumah, sesuai target GDD §9.4 |
| Kolam event dicurigai jadi penyebab kebangkrutan | **Diukur, bukan ditebak**: seluruh kolam cuma −$75.000 seumur hidup. Bukan penyebabnya. Curiga tanpa mengukur akan membuat saya menyetel angka yang salah. |

**Angka seumur hidup sesudah penyetelan** (pemain cermat, menabung):

| Karier | Puncak uang |
|---|--:|
| Pegawai kantoran | ~$180.000 |
| Pemilik restoran | ~$500.000 |
| Dokter bedah | ~$1.500.000 |

Melawan penyerapnya — flat $90.000, rumah $260.000, perahu $150.000, keluarga
~$184.000, hidup nyaman ~$400.000 seumur hidup, hidup mewah ~$1,5 juta — target
GDD §9.4 tercapai untuk penghasilan biasa: **satu kehidupan pegawai kantoran
cukup untuk salah satu**, tidak semuanya. Penghasilan yang jauh lebih besar
memang bisa membeli lebih banyak, dan itu memang gunanya memilih karier.

**Catatan jujur soal metode.** Dua kali saya hampir menyetel angka game
berdasarkan hasil simulasi yang salah, karena **skripnya** yang keliru, bukan
gamenya: sekali aturan "bersosialisasi kalau ada yang renggang" menyala hampir
tiap minggu sehingga pemainnya tidak pernah bekerja, sekali lagi anomali di
skrip belanja yang belum terpecahkan. Yang menyelamatkan keduanya adalah
menelusuri satu kehidupan langkah demi langkah sampai angkanya masuk akal,
bukan mempercayai tabel ringkasan. **Kalau hasil simulasi mengejutkan, curigai
skripnya dulu.**

#### Fase 5D — suara & penutup (hasil implementasi)

| Keputusan | Isi | Alasan |
|---|---|---|
| Suara **tidak lewat Phaser** | `src/ui/sound.ts` memakai elemen `Audio` biasa. | Rencana semula adalah membereskan `audio: { noAudio: true }` dari Fase 0. Ternyata tidak perlu: suara ini tidak ada hubungannya dengan peta, dan memakai `Audio` biasa **menghindari** seluruh masalah AudioContext alih-alih memperbaikinya. Lebih sedikit kode, satu kelas bug lebih sedikit. |
| Suara dipilih dari **perbandingan state**, bukan dipanggil per tempat | `soundFor(before, after)` menebak apa yang baru terjadi; `App` memanggilnya sekali. | Kalau tiap komponen memanggil `play()` sendiri, setiap jenis kejadian baru butuh seseorang ingat menambah satu baris. Dengan cara ini, event baru berbunyi tanpa disentuh. Satu bunyi per perubahan, dengan urutan prioritas: kematian di atas segalanya. |
| Hanya **6 berkas** dari 100 | 73 KB, diganti nama sesuai perannya. | Menyimpan seluruh paket berarti ratusan KB yang tidak pernah dibunyikan. Daftar lengkapnya di `ASSETS.md`. |
| Volume disimpan di **kunci localStorage sendiri**, bukan di save | `real-life-sim:volume`. | Volume milik perangkat, bukan milik karakter: harus bertahan saat mulai hidup baru, dan tidak boleh ikut di dalam save atau memaksa `SCHEMA_VERSION` naik. |
| Penjaga bentuk save | `looksLikeASave()` menolak berkas yang JSON-nya valid tapi isinya bukan save. | JSON yang valid bukan berarti save yang valid. Tanpa ini, tulisan setengah jadi atau hasil edit tangan lolos ke aturan harian dan crash di `stats` yang tidak ada. Sudah diuji dengan tujuh bentuk sampah. |

**FPS tetap belum terukur.** Percobaan pengukuran di sesi ini menghasilkan
`document.hidden: true` dan **nol frame dalam 4,5 detik** — jendela browsernya
memang tidak menggambar. Angka apa pun yang dilaporkan dari keadaan seperti itu
akan mengarang. Yang diketahui: angka Fase 2 (165 fps, frame terburuk 7,3 ms)
diambil saat **dua** game Phaser berjalan sekaligus, jadi itu batas bawah yang
aman — tapi sejak itu keramaian dinaikkan ke 40 orang + 14 mobil dan peta jadi
dua kali lebih besar. **Belum terbukti. Ukur di jendela yang benar-benar
menggambar sebelum mempercayainya.**

### 2026-09-23 — Fase 6 (keputusan, ditulis sebelum kode)

User memainkan hasil Fase 5 dan meminta tujuh hal: nama & ngobrol dengan NPC,
wajah di People, ruangan dalam gedung, mall, indikator lapar/haus, mobil yang
terbalik, serta jam + durasi aksi + pagi→malam. Aturan mainnya ada di
`GDD.md` §11; di sini sisi teknis dan alasannya. Diputuskan lewat enam putaran
tanya-jawab. **FINAL — jangan tanya ulang.**

| Keputusan | Isi | Alasan / konsekuensi |
|---|---|---|
| **Model waktu hybrid** | `WorldState.minuteOfDay`. Aksi pemain memajukan jam; `advanceDay` = tidur; `advanceWeek` tetap ada. | Mencabut "satu klik = satu minggu" sebagai *satu-satunya* cara main (Fase 1 Demo A). Hitungan ~3.000 klik per kehidupan tetap berlaku untuk pemain yang memilih skip. |
| **`applyDailyRules` tidak diubah efek fokusnya** | Blok 09–17 hanya memajukan jam dan kebutuhan; statistik fokus tetap diterapkan saat tidur. | Semua test keseimbangan seumur hidup (umur mati, urutan karier) tetap sah tanpa disetel ulang. |
| **Waktu yang di-skip tidak menurunkan kebutuhan** | Kebutuhan hanya bergerak di `passTime`. Setiap pagi kembali ke nilai bangun tetap. | Autopilot = hidup wajar tanpa aturan tambahan. Tanpa ini, 3.000 minggu autopilot harus mensimulasikan makan — kode besar untuk hal yang tidak dilihat siapa pun. |
| **Penalti kebutuhan tidak menyentuh kesehatan** | Hanya mood & energi. | Kematian tetap hanya lewat aturan harian, jadi `passTime` tidak perlu `checkDeath`, dan "kematian selalu didahului tanda" (Fase 1) utuh. |
| **Satu daftar `doneToday`** | `WorldState.doneToday: string[]`, dikosongkan saat tidur. Dipakai aksi `oncePerDay`, ngobrol per orang, hitungan sapaan. | Satu mekanisme generik, bukan satu field per aksi. Tanpa batas harian, check-up dokter berulang-ulang membuat karakter abadi. |
| **Siapa di mana = hash, bukan RNG** | `whoIsHere()` menghitung dari (id orang, hari, jam). | RNG simulasi tersimpan di save; tampilan tidak boleh menggeser urutan event (alasan yang sama dengan RNG keramaian di Fase 2). |
| **Wajah = palette swap** | 6 badan dasar × warna rambut/baju/kulit. `look` satu angka; `lookOf(person)` = `person.look ?? hash(id)`. | Tilesheet ternyata **6 orang × 3 frame**, bukan 18 orang. Palette swap memberi ratusan wajah tanpa unduhan, dan peta serta potret selalu sama. |
| **Dialog = data tertulis** | `src/data/dialogue.ts`, dipilih lewat hash. | `CLAUDE.md` melarang LLM saat runtime. Ditulis Claude saat development — itu yang dibolehkan. |
| **Ruangan = satu scene generik** | `InteriorScene` membaca `src/data/interiors.ts`. Masuk/keluar ruangan = state tampilan, tidak disimpan. | Konten = data (`CLAUDE.md` aturan 2): 8 gedung + 3 versi rumah + 6 usaha adalah entri data, bukan 17 scene. |
| **Aset interior** | Kenney "Roguelike Indoors" (CC0, 16×16, seri yang sama). **Unduh hanya setelah izin user.** | Tilesheet kota tidak punya meja, kursi, kasur, atau konter — dicek visual. |
| **Tanpa React ErrorBoundary** | Save dengan id data yang tidak dikenal diperbaiki di `migrate()`. | ErrorBoundary butuh class component, yang dilarang `CLAUDE.md`. Memperbaiki akarnya lebih baik daripada menangkap crash-nya. |
| **`SCHEMA_VERSION` → 4, dengan migrasi** | Di Fase 6B: `minuteOfDay`, `needs`, `doneToday`. | Save yang sedang berjalan tetap lanjut, sama seperti migrasi 2→3. |
| **Akhir pekan libur mengubah keseimbangan** | Gaji hari kerja ×7/5; hari libur = efek Istirahat. | Gaji mingguan sama, tapi energi di akhir pekan berbeda → umur harapan bisa bergeser. **Disetel ulang lewat simulasi**; kalau target umur 86–88 harus bergeser, tanya user dulu. |

**Dikerjakan bertahap (A–F di `ROADMAP.md`)** supaya tiap bagian bisa dicoba.

#### Fase 6A — perbaikan & wajah (hasil implementasi)

| Keputusan | Isi | Alasan |
|---|---|---|
| Palette swap dibatasi **pita baris** | Warna hanya diganti di dalam rentang baris per bagian (`src/data/looks.ts`). | Paket Kenney memakai ulang warna: rambut badan 0 sewarna sepatunya, baju badan 2 sewarna rambut badan 0. Mengganti warna tanpa batas baris ikut mewarnai sepatu. Dipatok test. |
| `look` opsional, `appearanceRow` tetap ada | `characterLook()` jatuh ke baris lama untuk save sebelum Fase 6. | Save tidak perlu naik versi hanya untuk kosmetik. |
| Tekstur tampilan dibuat saat dipakai | `lookTexture()` membuat satu kanvas 4×3 frame per tampilan, sekali. | Kerumunan 40 orang = paling banyak 40 kanvas kecil; tidak ada gunanya menyiapkan 2.400. |
| `repaint()` murni, tanpa Phaser | Dites di Vitest; bagian Phaser di `lookTexture.ts` terpisah. | Phaser tidak bisa dimuat di lingkungan test. |
| Koin "teman atau kolega" tetap dilempar walau menganggur | Hasilnya saja yang dipaksa "teman". | Melewatkan lemparan akan menggeser urutan RNG dan mengubah semua simulasi seumur hidup yang dipatok test. |
| Laporan perubahan = perbandingan state | `changesBetween(before, after)` di `src/ui/changes.ts`, pola yang sama dengan `soundFor`. | Aturan baru ikut terlaporkan tanpa ada yang harus ingat menambahkannya. |

**Tiga bug yang ditemukan saat menelusuri, bukan dilaporkan user:** fokus
"Mind the shop"/"Train"/"Work" tetap berjalan tersembunyi setelah karier
dilepas (energi terkuras tanpa hasil); aksi di `store.ts` menambah log tanpa
memotongnya; dan save yang menyebut id data tak dikenal membuat halaman kosong
tanpa tombol reset. Ketiganya sekarang dipatok test.

#### Fase 6B — jam, kebutuhan, tampilan baru (hasil implementasi)

| Keputusan | Isi | Alasan |
|---|---|---|
| **Treat sekali sehari, kebutuhan selalu** | Efek mood/energi/kesehatan/atribut sebuah aksi hanya dihitung pertama kali per hari (`doneToday`); lapar/haus/kebersihan selalu terisi. | Satu aturan umum menggantikan penanda "sekali sehari" per aksi. Tanpa ini sepuluh kopi = sepuluh kali energi, dan check-up harian membuat karakter abadi. Dipatok test: semua treat sekaligus dalam sehari tidak melebihi fokus terbaik untuk tiap angka. |
| Waktu berlalu dulu, hasil belakangan | `performAction` memajukan jam dulu, baru mengisi kebutuhan. | Kenyang di akhir makan, bukan di awal. |
| Efek fokus tetap saat tidur | `startBlock` hanya memajukan jam dan memindahkan karakter; statistik fokus diterapkan `applyDailyRules`. | `applyDailyRules` tidak disentuh, jadi semua simulasi seumur hidup tetap sama persis. Petunjuk di layar menjelaskan "counts when you sleep". |
| 02:00 = tidur otomatis di `store` | Aksi yang berakhir tepat 02:00 langsung disusul `advanceDay`. | `day.ts` tidak boleh mengimpor `clock.ts` (clock sudah mengimpor day). |
| Animasi = menahan intent, bukan timer simulasi | `runTimed()` di `src/ui/progress.ts` menampilkan bar lalu mengirim intent **sekali**. 15 menit ≈ 0,5 dtk, 1 jam ≈ 1 dtk, maks 3 dtk; nol kalau pengguna memilih kurangi gerak. | `CLAUDE.md` aturan 3: waktu tetap hanya maju karena klik pemain. |
| Langit peta dan pita hari dari satu file | `src/world/sky.ts`: `SKY` untuk lapisan di peta, `SKY_BAND` untuk pita di HUD. | Dua tampilan jam yang sama tidak boleh berbeda warna. |
| Jam melompat = karakter sudah di sana | Kalau lokasi berubah bersamaan dengan jam (blok kerja), karakter dipindah langsung, tidak berjalan. | Tanpa ini karakter berjalan ke kantor pukul 17:00, setelah kerjanya selesai. |
| Aksen jadi kuning lampu jalan | `--accent: #ffc861`, sama dengan sorot gedung di peta. | Aksen hijau lama adalah warna bawaan yang generik; kuning = "sekarang" dan "bisa diklik", di peta maupun di panel. |

#### Fase 6C — akhir pekan, bolos, jam buka (hasil implementasi)

| Keputusan | Isi | Alasan |
|---|---|---|
| Akhir pekan dihitung di `applyDailyRules` | Fokus kerja di hari ke-5/6 memakai efek Istirahat dan tidak dibayar; masa kerja tetap bertambah. | Satu tempat untuk semua aturan harian, jadi hari yang di-skip dan hari yang dimainkan sama persis. |
| Hari bolos = hari "kosong" | Tidak dibayar, tidak menambah masa kerja, **dan tidak memberi efek Istirahat**. | Kalau bolos dihitung istirahat, bolos jadi cara murah untuk memulihkan energi. |
| Catatan absen di varian `job` | `strikes?: number`, opsional — save lama tidak perlu migrasi. Pudar `1/30` per hari. | Ikut hilang bersama pekerjaannya; tidak ada field yang tertinggal saat berganti karier. |
| `withLogEntry`/`withMilestone` pindah ke `src/core/log.ts` | Dipakai `clock.ts`, `store.ts`, dan `day.ts`. | `day.ts` butuh menulis log (teguran, dipecat), tapi `clock.ts` sudah mengimpor `day.ts`. |
| Jam buka di data lokasi | `opens`/`closes` di `src/data/locations.ts`; `closedReason()` di `day.ts`. | Konten = data. |
| **Gaji: dibayar per hari kerja** | Faktor ×7/5 yang direncanakan dibuang. | Diukur (3 kehidupan, pegawai kantoran, pemain cermat): sebelum akhir pekan puncak ~$450rb; ×7/5 → ~$945rb; tanpa faktor → ~$490rb. Umur mati 86–88 di ketiganya. User memilih kembali ke ~$450rb (target GDD §9.4). |

**Pergeseran yang disengaja:** pemain yang "kerja terus tanpa istirahat" dulu
mati di umur 25–31; sekarang ~50, karena akhir pekan selalu jadi hari
istirahat. Tangga kesulitan di entri Fase 1 Demo B ("Tidak pernah istirahat:
19-28") tidak berlaku lagi untuk pegawai — yang masih berlaku untuk fokus
tanpa akhir pekan (belajar, latihan). Test "kerja saja mati 15+ tahun lebih
cepat" tetap lolos.

#### Fase 6D — ruangan dalam gedung (hasil implementasi)

| Keputusan | Isi | Alasan |
|---|---|---|
| Satu grid untuk semua ruangan | 14×8 petak: 2 baris dinding, 6 baris lantai, pintu keluar di (7,7). Zoom 3,5× memenuhi kanvas 800×448. | Satu `InteriorScene` membaca data; ruangan baru = entri data. |
| Masuk = tiba di pintu | `TownScene.onArrived` memulai `InteriorScene` kecuali tempatnya tutup (pesan singkat di atas kepala). Klik tab dari dalam ruangan langsung pindah ruangan. | Pintu dan tab tetap dua pintu ke satu state. |
| Aksi lewat `WorldHooks.perform` | `createPhaserGame(parent, store, hooks)`; `GameCanvas` mengisi `perform` dengan `runTimed`. | Klik furnitur harus sama persis dengan tombol di panel, termasuk bar waktunya. Dunia tetap tidak mengimpor lapisan UI. |
| `canvasPoint()` di `src/world/pointer.ts` | Dipakai kedua scene. | Jebakan posisi kanvas Phaser 2 berlaku untuk scene mana pun. |
| TownScene membersihkan state di `create()` | `path`, `playerLook`, dst. direset. | Phaser memakai objek scene yang sama setiap kali dimulai ulang; tanpa ini sprite pemain muncul dengan tekstur yang salah setelah keluar ruangan. |
| Label & sorot di atas langit malam | Kedalaman di atas lapisan malam. | Nama gedung harus tetap terbaca di malam hari. |
| Jadwal orang = hash | `whereIs()` di `src/core/schedule.ts`; hormati jam buka. | Lihat keputusan Fase 6 di atas: tampilan tidak boleh menggeser RNG simulasi. |

#### Fase 6E — Mall (hasil implementasi)

| Keputusan | Isi | Alasan |
|---|---|---|
| Mall = `LocationId` ke-8 | Gedung di (35,9) 8×4, pintu (38,12). Tidak mengubah bentuk save. | Menambah nilai ke union tidak merusak save lama. |
| Baju baru = aksi biasa + ganti tampilan | Intent `buyClothes {top}` menjalankan aksi `buy_clothes` (30 menit, $60, mood sekali sehari) lalu mengganti warna atasan di `character.look`. Aksi ini ditandai `custom` sehingga tidak ikut daftar tombol. | Jam, harga, jam buka, dan "tidak cukup uang" semuanya memakai aturan yang sudah dites, tanpa jalur kedua. |
| Toko barang pindah dari Home | Tombol beli ada di Mall; Home tinggal daftar milik. `buyPossession` di store **tidak** memeriksa lokasi. | Pintu satu-satunya ke tombol itu ada di Mall; menambah pemeriksaan lokasi di store akan merusak test lama tanpa menambah keamanan bagi pemain. |

**Test tata letak menangkap empat kesalahan sebelum dilihat mata:** satu titik
pengunjung di rumah besar tertutup kursi, dan tiga di ruang usaha tertutup
konter, rak, dan meja. Test-nya memeriksa setiap titik pengunjung dan setiap
furnitur beraksi bisa dicapai dari pintu.

**Catatan pengukuran:** animasi jam memakai `requestAnimationFrame`. Di pane
browser sesi ini yang sering tidak menggambar, jam di layar melompat langsung
ke waktu akhir; state-nya tetap benar (diuji lewat DOM). FPS tetap belum
diukur.

### Belum diputuskan (tanyakan user sebelum mengerjakan)

- ~~**Linter/formatter** (ESLint, Prettier)~~ — **sudah diputuskan: tidak dipasang** (user, 22 Sep 2026). TypeScript mode ketat, 207 test, penjaga kemurnian core dan gerbang CI sudah menangkap yang penting, dan cuma ada satu penulis kode sehingga format tidak pernah bertengkar. Memasangnya berarti dependency dev baru dan pembersihan peringatan, untuk manfaat kecil.
- ~~**Skema kontrol karakter** di peta (WASD vs klik-jalan)~~ — **sudah diputuskan**: klik-untuk-jalan. Lihat entri Fase 2 di atas.
- **Ukuran bundel:** build Fase 0 sudah 1,4 MB (388 KB gzip), hampir semuanya Phaser. Wajar, tapi kalau nanti terasa lambat dibuka, itu bahan polish Fase 5 — bukan masalah sekarang.
