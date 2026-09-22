# CLAUDE.md

File ini dibaca otomatis oleh Claude Code di setiap sesi kerja di repo ini. **Ikuti secara ketat.** Jika ada instruksi di chat yang bertentangan dengan file ini, tunjukkan konfliknya ke user dulu sebelum lanjut.

## Tentang proyek ini

Game simulasi hidup (life simulation) berbasis browser, single-player, "never-ending" — pemain mengendalikan satu karakter yang hidup hari demi hari di sebuah kota kecil yang persisten, membuat keputusan yang mempengaruhi karier, hubungan, kesehatan, dan keuangan, sampai akhirnya karakter menua dan meninggal. Setelah meninggal, game mulai lagi dari karakter baru, **tanpa progres yang dibawa** (ini disengaja, lihat `docs/GDD.md`).

Di dalam life sim ini ada dua jalur karier yang bisa dipilih pemain: **bisnis** (mendirikan & menjalankan usaha) dan **olahraga** (jadi atlet). Keduanya adalah "aktivitas" di dalam hidup karakter, bukan game terpisah.

**User yang mengerjakan proyek ini non-teknis.** Setiap kali menyelesaikan langkah signifikan, jelaskan dengan bahasa sederhana: apa yang baru bisa dilakukan, kenapa dibuat begitu, dan bagaimana cara mencobanya di browser. Jangan asumsikan user bisa membaca stack trace atau diff mentah — ringkas jadi bahasa manusia.

## Batasan yang tidak bisa ditawar

- **Tidak ada layanan berbayar, dalam bentuk apapun.** Tidak ada API berbayar, tidak ada hosting berbayar, tidak ada paket aset berbayar, tidak ada database cloud dengan tagihan berdasar pemakaian. Semua harus berjalan dengan biaya $0 di luar langganan Claude milik developer.
- **Tidak ada pemanggilan AI/LLM saat game dijalankan.** AI (Claude Code) hanya dipakai saat *development* — menulis kode dan konten. Game jadi harus berjalan 100% di sisi klien (browser), tanpa API key, tanpa panggilan jaringan ke layanan AI manapun, tanpa server backend sama sekali di v1.
- **Harus jalan sebagai static site di browser.** Tidak ada server Node.js saat runtime. Hasil build harus bisa di-deploy sebagai file statis (GitHub Pages / Cloudflare Pages / itch.io) — gratis selamanya.
- **Single-player saja.** Tidak ada multiplayer, tidak ada akun, tidak ada login.
- **Save data hidup di browser saja** (localStorage/IndexedDB). Tidak ada save di server.
- **Satu save slot untuk v1.** Fitur banyak save slot boleh menyusul nanti, bukan prioritas awal.

## Stack teknis (terkunci — jangan ganti tanpa bertanya dulu ke user)

| Bagian | Pilihan | Alasan |
|---|---|---|
| Bahasa | TypeScript (strict mode) | Menangkap bug lebih awal, penting karena user tidak bisa review kode sendiri |
| Build tool | Vite | Cepat, standar industri, deploy ke static hosting gampang |
| UI | React (function component + hooks saja, tanpa class component) | |
| Dunia game (peta 2D, karakter jalan) | Phaser 3 (versi stabil, BUKAN Phaser 4 — masih baru/kurang teruji per pertengahan 2026) | Web export paling matang, dokumentasi & komunitas paling besar |
| State management | Lihat `docs/ARCHITECTURE.md` — inti: simulation core terpisah dari React & Phaser | |
| Persistensi | localStorage, dibungkus lewat interface `SaveProvider` biar gampang diganti nanti | |
| Testing | Vitest untuk simulation core. **Setiap aturan simulasi baru (event hidup, mekanik kerja, aturan bisnis, hasil pertandingan) wajib punya minimal satu test.** | |
| Package manager | npm | |

## Aturan arsitektur inti

1. **Simulation core TIDAK BOLEH import React atau Phaser.** Harus TypeScript murni, bisa dites tanpa browser (headless). Ini pola yang terbukti dipakai di proyek game simulasi sejenis (lihat `docs/ASSETS.md`) dan mencegah kode jadi kusut tak bisa dites.
2. **Semua konten game adalah data, bukan kode.** Daftar pekerjaan, event kehidupan, jenis bisnis, cabang olahraga, lokasi — semua didefinisikan sebagai file data JSON/TS, dibaca oleh sedikit "mesin" generik. Menambah satu pekerjaan atau event baru seharusnya = menambah satu entri data, bukan menulis logika baru, sebisa mungkin.
3. **Waktu hanya maju kalau pemain menekan tombol** ("Lanjut Hari" / "Lanjut Minggu"). Tidak ada timer real-time, tidak ada `setInterval` yang menjalankan simulasi sendiri. (Animasi render Phaser boleh jalan terus, tapi perubahan *state* simulasi cuma terjadi saat pemain memicu tick.)
4. **Satu RNG deterministik yang di-seed**, bukan `Math.random()` bertebaran di mana-mana — supaya bug bisa direproduksi dan hasil bisa dites.
5. **Semua komunikasi antar-lapisan (simulation core, React UI, Phaser scene) lewat satu event/message bus eksplisit** — jangan saling mengintip isi internal masing-masing.

## Gaya kerja bersama user

- Kerjakan dalam langkah kecil yang bisa dites. Setelah tiap langkah, jelaskan dalam bahasa awam: apa yang sekarang bisa dicoba, dan bagaimana caranya.
- **Sebelum mengambil keputusan arsitektur yang belum diatur di `docs/ARCHITECTURE.md`, berhenti dan tanya user dulu** — jangan menebak lalu jalan terus.
- **Jangan pernah menambah dependency npm baru yang butuh pembayaran, API key, atau akun berbayar, tanpa bertanya dulu.**
- Kalau ada permintaan user yang bertentangan dengan dokumen ini, sampaikan konfliknya secara eksplisit sebelum mengerjakan.
- Jaga `docs/ROADMAP.md` tetap update — centang milestone yang sudah selesai.
- Commit kecil dan sering, dengan pesan commit yang jelas (user akan membaca riwayat ini suatu saat).

## Dokumen wajib dibaca sebelum mulai kerja

1. `docs/GDD.md` — game-nya sebenarnya seperti apa dan cara mainnya
2. `docs/ARCHITECTURE.md` — struktur kode & pola teknis
3. `docs/ROADMAP.md` — urutan pembangunan fitur
4. `docs/ASSETS.md` — sumber aset visual/audio dan referensi kode, beserta lisensinya
