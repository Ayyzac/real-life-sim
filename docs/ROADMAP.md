# Roadmap

Setiap fase berakhir dengan sesuatu yang **benar-benar bisa dicoba di browser** oleh user, bukan cuma "kode sudah ditulis". Claude Code: centang kotak di bawah saat selesai, dan jangan mulai fase berikutnya sebelum fase sebelumnya bisa didemokan.

## Fase 0 — Fondasi & pipeline deploy
Tujuan: buktikan dulu jalur "kode → live di internet, gratis" beres, sebelum membangun game apapun.
- [x] Scaffold proyek: Vite + React + TypeScript + Phaser 3 terpasang, saling terhubung minimal (satu halaman React yang me-render satu canvas Phaser kosong)
- [x] Struktur folder awal sesuai `docs/ARCHITECTURE.md` §8
- [x] Repo git diinisialisasi, `.gitignore` benar (jangan commit `node_modules`)
- [x] GitHub Actions workflow: build otomatis + deploy ke GitHub Pages tiap push ke `main`
- [x] **Checkpoint:** user bisa membuka satu link publik dan melihat halaman kosong/placeholder yang jalan

## Fase 1 — Loop hidup inti (tanpa dunia visual dulu)
Tujuan: buktikan simulation core-nya hidup dan seru, lewat UI sederhana dulu (mirip BitLife berbasis menu) — sebelum repot dengan dunia 2D.

**Dipecah dua demo** atas permintaan user (22 Sep 2026), supaya bisa dicoba lebih awal:
- **Demo A (selesai):** karakter, Clock, dashboard, fokus mingguan, kerja + gaji, save
- **Demo B (selesai):** `EventEngine`, kematian, Life Summary
- [x] `Character`, `WorldState`, `Clock` di simulation core (lihat `docs/ARCHITECTURE.md` §2, §4)
- [x] Pembuatan karakter baru (form sederhana React)
- [x] Dashboard status (uang, kesehatan, energi, mood, umur)
- [x] Tombol "Lanjut Hari" / "Lanjut Minggu" yang benar-benar menjalankan `Clock.advanceDay()`
- [x] Satu jalur karier dulu: kerja biasa (`careers/job.ts`) — gaji masuk, energi terkuras
- [x] `EventEngine` dengan minimal 5–10 event kehidupan acak (sakit ringan, ajakan teman, bonus kerja, dst.) sebagai bukti pola data-driven-nya jalan
- [x] Kondisi kematian (usia tua / kesehatan 0) + layar Life Summary + tombol mulai karakter baru
- [x] `SaveProvider` (localStorage) — refresh browser tidak menghilangkan progres
- [x] Test Vitest untuk `Clock`, `EventEngine`, dan sistem kerja — 115 test
- [x] **Checkpoint:** user bisa main satu "kehidupan" penuh dari lahir sampai mati, lewat UI menu saja, dan progresnya tersimpan

## Fase 2 — Dunia yang dijelajahi (Phaser + aset Kenney) — SELESAI
Tujuan: tambahkan lapisan visual di atas loop yang sudah terbukti jalan di Fase 1.
- [x] Import aset pixel art dari Kenney (lihat `docs/ASSETS.md`) — tileset kota kecil + sprite karakter
- [x] Peta dasar: Rumah, Tempat Kerja, Gym, Rumah Sakit, satu lokasi sosial (Kafe)
- [x] Kontrol jalan karakter di peta — **klik-untuk-jalan**, dicatat di `docs/ARCHITECTURE.md` §11
- [x] Masuk ke lokasi → membuka menu React yang sudah ada dari Fase 1 (job, dst.) — bukan sistem baru, cuma cara masuknya berubah
- [x] Kota ramai: NPC berjalan + lalu lintas, murni hiasan
- [x] Test: pencarian jalan, validitas peta, dan `enterLocation` diblokir saat ada event menunggu
- [x] **Checkpoint:** user bisa jalan-jalan di peta, masuk ke tempat kerja, dan itu memicu aksi yang sama seperti Fase 1

## Fase 3 — Jalur karier: Bisnis — SELESAI
- [x] Data `businesses.ts` (tiga jenis usaha: warung, toko online, bengkel)
- [x] `careers/business.ts` — pendapatan/biaya per hari, plus keputusan pemain (investasi promosi, tutup usaha)
- [x] Event acak khusus bisnis (4 entri, salah satunya butuh keputusan)
- [x] Lokasi baru: gedung "Business" ke-6 di peta, dengan tabnya sendiri
- [x] Peringatan di dashboard saat usaha merugi (pengganti bangkrut otomatis, sesuai pilihan user)
- [x] Balancing diperiksa lewat simulasi seumur hidup, hasilnya dipatok test
- [x] **Checkpoint:** user bisa memilih buka usaha alih-alih kerja biasa, dan melihat kasnya berubah tiap hari

## Fase 4 — Jalur karier: Olahraga — SELESAI
- [x] Data `sports.ts` (tiga cabang: lari, basket, sepak bola)
- [x] `careers/sports.ts` — latihan menaikkan skill, pertandingan diselesaikan lewat perbandingan statistik + acak
- [x] Lokasi latihan: gedung **Stadion**, di distrik kedua peta
- [x] Peta diperluas jadi **dua distrik** dengan tombol geser kiri/kanan (permintaan user)
- [x] Event acak khusus atlet (3 entri, salah satunya butuh keputusan)
- [x] Penurunan kemampuan karena usia, tanpa pensiun paksa
- [x] Balancing diperiksa lewat simulasi seumur hidup, hasilnya dipatok test
- [x] **Checkpoint:** user bisa memilih jalur atlet, berlatih, dan bertanding

## Fase 5 — Konten, kedalaman & polish (fase penutup)

Dipecah empat bagian atas permintaan user (22 Sep 2026) supaya tiap bagian bisa
dicoba, bukan menunggu semuanya selesai. Keputusan lengkap ada di
`docs/GDD.md` §9–§10 dan `docs/ARCHITECTURE.md` §11.

### A — Uang punya tujuan — SELESAI
- [x] `SCHEMA_VERSION` naik ke 3, **dengan migrasi** dari versi 2 (karakter yang sedang hidup lanjut, tidak dibuang)
- [x] Barang permanen yang bisa dibeli (`src/data/possessions.ts`) — 6 entri, rumah dan kendaraan saling menggantikan
- [x] Taraf gaya hidup yang bisa dinaik-turunkan (`src/data/lifestyles.ts`) — 4 taraf, `ordinary` persis seperti sebelumnya
- [x] Pilihan penampilan sprite saat pembuatan karakter — menutup utang GDD §3.2
- [x] **Checkpoint:** uang yang ditabung akhirnya bisa dibelanjakan

### B — Keluarga & hubungan — SELESAI
- [x] Orang di sekitar pemain: nama, peran, umur, pekerjaan, kedekatan 0-100
- [x] NPC punya hidup sendiri: menua, ganti pekerjaan, meninggal karena usia; pemain menikah dan punya anak
- [x] Orang yang meninggal/pergi dipadatkan jadi kenangan, supaya save tetap kecil
- [x] Menikah (sekali bayar) dan anak (harian) sebagai penyerap uang
- [x] Life Summary menyebut siapa yang masih ada dan siapa yang hilang
- [x] **Checkpoint:** pemain punya lingkungan sosial yang berubah sendiri seiring waktu

### C — Isi & keseimbangan — SELESAI
- [x] Isi jadi kira-kira dua kali lipat: **48 event** (dari 21), **11 pekerjaan** (dari 5), **6 usaha** (dari 3), **5 cabang olahraga** (dari 3)
- [x] Aturan utang: uang minus akhirnya punya akibat — menutup utang yang dicatat sejak Fase 1
- [x] Peringatan di dashboard saat uang minus
- [x] Penyetelan menyeluruh lewat simulasi seumur hidup, target di GDD §9.4
- [x] **Checkpoint:** satu kehidupan terasa tidak mengulang, dan uang terasa jadi pilihan

### D — Suara & penutup — SELESAI
- [x] Efek suara CC0 (tanpa musik) — 6 berkas, 73 KB, **tidak lewat Phaser** sehingga AudioContext Fase 0 tidak perlu disentuh sama sekali
- [x] Menu pengaturan: volume dan reset save — menutup utang GDD §8 butir 7
- [x] Save tahan error: berkas yang JSON-nya valid tapi isinya bukan save ditolak sebelum menyentuh aturan harian
- [ ] ~~Ukur ulang FPS~~ — **tidak bisa diukur di lingkungan sesi ini**, lihat `ARCHITECTURE.md` §11. Jangan percaya angka FPS apa pun sampai diukur di jendela yang benar-benar menggambar.
- [x] **Checkpoint:** game terasa utuh dari layar pertama sampai Life Summary

## Fase 6 — Hidup per jam

Diminta user 23 Sep 2026 setelah memainkan hasil Fase 5. Scope diubah dulu di
`docs/GDD.md` §7 dan §11, keputusan teknis di `docs/ARCHITECTURE.md` §11.

### A — Perbaikan & wajah — SELESAI
- [x] Mobil tidak lagi berjalan mundur
- [x] Karakter menghadap depan (kolom pose tilesheet dibetulkan), dan berjalan dengan dua langkah
- [x] Wajah beda-beda lewat palette swap (2.400 tampilan); potret di People dan Life Summary
- [x] Pembuat karakter: rakit badan + warna rambut/baju/kulit + Acak
- [x] Bug: fokus tersembunyi setelah tutup usaha/pensiun/berhenti kerja; log yang tidak dipotong; save dengan id tak dikenal; efek atribut di dialog event; Life Summary untuk usaha/atlet; kolega saat menganggur; konfirmasi berhenti kerja
- [x] Klik bagian mana pun dari gedung → jalan ke pintunya; gedung disorot saat kursor di atasnya
- [x] Laporan "apa yang berubah" setelah Lanjut Hari/Minggu
- [x] **Checkpoint:** kota terlihat benar dan orang bisa dibedakan dari wajahnya — 309 test

### B — Jam, siang-malam, kebutuhan, tampilan baru — SELESAI
- [x] `SCHEMA_VERSION` 4 dengan migrasi (save lama bangun pukul 07:00)
- [x] Jam, nama hari, langit pagi→malam di peta, dan pita hari di bar atas
- [x] Lapar, Haus, Kebersihan
- [x] Aksi berdurasi (masak, minum, mandi, kopi, makan di luar, check-up, workout) dengan progress bar dan jam yang berjalan
- [x] Blok fokus 09–17, begadang s/d 02:00
- [x] Tata letak baru: bar status atas, peta + panel bertab (Here / People / Log); People bisa dibuka dari mana saja
- [x] **Checkpoint:** satu hari bisa dimainkan per jam, dan skip tetap aman — 335 test, semua test keseimbangan seumur hidup lolos tanpa disentuh

### C — Aturan kerja — SELESAI
- [x] Sabtu–Minggu libur kerja (dihitung hari istirahat), dibayar untuk hari yang dikerjakan
- [x] Bolos: catatan absen → teguran di 3 → dipecat di 5; catatan pudar ±1 per bulan; datang kotor = ½
- [x] Jam buka tempat, dengan alasan yang jelas saat tutup ("Closed · opens 07:00", "Closes at 22:00")
- [x] Keseimbangan disetel ulang lewat simulasi seumur hidup: umur mati tetap 86–88, uang pegawai kembali ±$490rb
- [x] **Checkpoint:** minggu terasa punya ritme kerja dan libur — 348 test

### D — Ruangan dalam gedung — SELESAI
- [x] Aset interior CC0 — Kenney Roguelike Indoors, 110 KB, diunduh atas izin user
- [x] Ruangan untuk 7 gedung yang ada (Mall menyusul di E); rumah 3 versi; usaha 6 tata letak + unit kosong
- [x] Furnitur yang bisa diklik untuk aksi, disorot dengan keterangan (durasi, harga, atau alasan tidak bisa)
- [x] Staf berlabel peran (barista, perawat, dokter, pelatih, resepsionis, pelatih tim, asisten)
- [x] Orang yang dikenal hadir menurut jadwal, dengan nama — juga tampil di tab Here dan di keterangan gedung di peta
- [x] **Checkpoint:** masuk kafe dan melihat siapa di dalam — 362 test

### E — Mall — SELESAI
- [x] Gedung Mall di Eastside, seberang Stadion, buka 10:00–22:00, dengan ruangannya sendiri
- [x] Food court, bubble tea, bioskop (2 jam), toko baju (ganti warna atasan, $60), toko barang (pindah dari tab Home)
- [x] Keluarga dan teman kadang ada di Mall (malam hari, akhir pekan)
- [x] **Checkpoint:** belanja dan hiburan punya tempatnya sendiri — 366 test

### F — Ngobrol & hubungan — SELESAI
- [x] Dialog tertulis: 35 pembuka (per peran, kedekatan, waktu, pekerjaan, anak kecil) × 3 jawaban (bercanda / tulus / bertanya), reaksi per gaya dan hasil
- [x] 6 sifat tersembunyi ("???"), terungkap setelah 2 jawaban yang pas
- [x] Pacaran → menikah (lamaran hanya untuk pacar); pacar yang lama diabaikan memutuskan hubungan, pasangan menikah tidak cerai
- [x] Ajak makan malam / nonton lewat telepon dari tab People (bisa ditolak: belum dekat, atau sedang kerja)
- [x] Sapa orang asing di jalan → peluang jadi kenalan dengan wajah yang sama, maks 3 sapaan sehari
- [x] **Checkpoint:** hubungan terasa seperti mengenal orang, bukan angka — 387 test

## Fase 7 — Kota hidup

Diminta user 23 Sep 2026 setelah memainkan hasil Fase 6. Scope diubah dulu di
`docs/GDD.md` §7 dan §12, keputusan teknis di `docs/ARCHITECTURE.md` §11.

- [x] **A** — Rumah kosong (keluarga datang hanya kalau diundang) + membership gym — 393 test
- [x] **B** — Jam berjalan sendiri: pause, 1×/2×/4×, berhenti menunggu pukul 09:00 — 402 test
- [x] **C** — Supermarket + tas (inventory), diskon harian — 410 test
- [x] **D** — Hujan: jalan sepi, payung (prakiraan menyusul di app HP, 7E) — 416 test
- [x] **E** — HP: kontak, undang ke rumah, berita, diskon, cuaca, taksi, pesan antar — 426 test
- [x] **F** — Bank, saham, crypto — 436 test
- [x] **G** — Laptop: lamar kerja, email, kerja lepas (4 mini-game) — 445 test
- [x] **H** — Casino + slot online — 452 test
- [x] **I** — Obrolan pohon dialog per topik — 456 test
- [ ] **J** — Media sosial

## Di luar roadmap v1 (lihat `docs/GDD.md` §7 untuk daftar lengkap)
Jangan dikerjakan kecuali user secara eksplisit meminta dan mengubah dokumen ini dulu.
