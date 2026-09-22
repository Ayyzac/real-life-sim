# Roadmap

Setiap fase berakhir dengan sesuatu yang **benar-benar bisa dicoba di browser** oleh user, bukan cuma "kode sudah ditulis". Claude Code: centang kotak di bawah saat selesai, dan jangan mulai fase berikutnya sebelum fase sebelumnya bisa didemokan.

## Fase 0 — Fondasi & pipeline deploy
Tujuan: buktikan dulu jalur "kode → live di internet, gratis" beres, sebelum membangun game apapun.
- [ ] Scaffold proyek: Vite + React + TypeScript + Phaser 3 terpasang, saling terhubung minimal (satu halaman React yang me-render satu canvas Phaser kosong)
- [ ] Struktur folder awal sesuai `docs/ARCHITECTURE.md` §8
- [ ] Repo git diinisialisasi, `.gitignore` benar (jangan commit `node_modules`)
- [ ] GitHub Actions workflow: build otomatis + deploy ke GitHub Pages tiap push ke `main`
- [ ] **Checkpoint:** user bisa membuka satu link publik dan melihat halaman kosong/placeholder yang jalan

## Fase 1 — Loop hidup inti (tanpa dunia visual dulu)
Tujuan: buktikan simulation core-nya hidup dan seru, lewat UI sederhana dulu (mirip BitLife berbasis menu) — sebelum repot dengan dunia 2D.
- [ ] `Character`, `WorldState`, `Clock` di simulation core (lihat `docs/ARCHITECTURE.md` §2, §4)
- [ ] Pembuatan karakter baru (form sederhana React)
- [ ] Dashboard status (uang, kesehatan, energi, mood, umur)
- [ ] Tombol "Lanjut Hari" / "Lanjut Minggu" yang benar-benar menjalankan `Clock.advanceDay()`
- [ ] Satu jalur karier dulu: kerja biasa (`careers/job.ts`) — gaji masuk, energi terkuras
- [ ] `EventEngine` dengan minimal 5–10 event kehidupan acak (sakit ringan, ajakan teman, bonus kerja, dst.) sebagai bukti pola data-driven-nya jalan
- [ ] Kondisi kematian (usia tua / kesehatan 0) + layar Life Summary + tombol mulai karakter baru
- [ ] `SaveProvider` (localStorage) — refresh browser tidak menghilangkan progres
- [ ] Test Vitest untuk `Clock`, `EventEngine`, dan sistem kerja
- [ ] **Checkpoint:** user bisa main satu "kehidupan" penuh dari lahir sampai mati, lewat UI menu saja, dan progresnya tersimpan

## Fase 2 — Dunia yang dijelajahi (Phaser + aset Kenney)
Tujuan: tambahkan lapisan visual di atas loop yang sudah terbukti jalan di Fase 1.
- [ ] Import aset pixel art dari Kenney (lihat `docs/ASSETS.md`) — tileset kota kecil + sprite karakter
- [ ] Peta dasar: Rumah, Tempat Kerja, Gym, Rumah Sakit, satu lokasi sosial
- [ ] Kontrol jalan karakter di peta (putuskan skema kontrol saat implementasi, catat di `docs/ARCHITECTURE.md`)
- [ ] Masuk ke lokasi → membuka menu React yang sudah ada dari Fase 1 (job, dst.) — bukan sistem baru, cuma cara masuknya berubah
- [ ] **Checkpoint:** user bisa jalan-jalan di peta, masuk ke tempat kerja, dan itu memicu aksi yang sama seperti Fase 1

## Fase 3 — Jalur karier: Bisnis
- [ ] Data `businesses.ts` (beberapa jenis usaha sederhana)
- [ ] `careers/business.ts` — pendapatan/biaya per tick, 1–2 keputusan pemain (mis. investasi promosi)
- [ ] Event acak khusus bisnis
- [ ] Lokasi baru: tempat usaha pemain (kalau relevan secara visual)
- [ ] **Checkpoint:** user bisa memilih buka usaha alih-alih kerja biasa, dan melihat kasnya berubah tiap hari

## Fase 4 — Jalur karier: Olahraga
- [ ] Data `sports.ts` (beberapa cabang olahraga)
- [ ] `careers/sports.ts` — latihan menaikkan skill, pertandingan diselesaikan lewat perbandingan statistik + acak
- [ ] Lokasi latihan (gym/lapangan) jadi fungsional
- [ ] **Checkpoint:** user bisa memilih jalur atlet, berlatih, dan bertanding

## Fase 5 — Konten & polish
- [ ] Perbanyak event kehidupan, pekerjaan, jenis bisnis, cabang olahraga (semua tinggal nambah data, sesuai pola Fase 1–4)
- [ ] Balancing angka (uang, energi, peluang event) supaya terasa adil dan seru
- [ ] Perbaikan save/load (robust terhadap error, migrasi versi kalau perlu)
- [ ] Polish visual & suara (lihat `docs/ASSETS.md` untuk sumber SFX gratis)

## Di luar roadmap v1 (lihat `docs/GDD.md` §7 untuk daftar lengkap)
Jangan dikerjakan kecuali user secara eksplisit meminta dan mengubah dokumen ini dulu.
