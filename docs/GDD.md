# Game Design Document (GDD)

Dokumen ini adalah sumber kebenaran untuk aturan main. Kalau Claude Code ragu bagaimana suatu mekanik seharusnya berperilaku, jawabannya harus ada di sini — kalau belum ada, **tanya user dulu**, lalu tambahkan jawabannya ke dokumen ini supaya keputusan itu tidak hilang/berubah-ubah di sesi berikutnya.

## 1. High concept

Simulasi hidup kota modern, sudut pandang top-down 2D pixel art, di mana pemain menjalani satu karakter dari dewasa muda sampai meninggal, bebas memilih jalur karier (kerja biasa, bisnis, atau olahraga), sambil mengurus kesehatan, hubungan, dan keuangan. Saat karakter meninggal, permainan berakhir untuk karakter itu dan pemain mulai lagi dari karakter baru yang sepenuhnya independen. "Never-ending"-nya bukan satu karakter abadi, tapi kota dan sistemnya yang terus bisa dimainkan ulang tanpa akhir.

## 2. Loop inti (satu siklus "hari"/"minggu")

1. Pemain melihat dashboard status karakter (uang, energi, mood, kesehatan, umur, pekerjaan saat ini).
2. Pemain **berjalan di peta 2D** ke satu atau lebih lokasi (rumah, kantor/tempat kerja, gym, rumah sakit, dst.) dan melakukan aksi di sana (lewat menu yang muncul saat masuk lokasi).
3. Pemain menekan **"Lanjut Hari"** (atau "Lanjut Minggu" untuk mempercepat) → waktu maju satu tick.
4. Sistem menjalankan: perubahan stat otomatis (gaji masuk, biaya hidup keluar, energi berkurang, dst.), lalu mengecek apakah ada **event acak** yang terpicu (sakit, promosi, ajakan teman, dst.), lalu menampilkan hasilnya ke pemain.
5. Kembali ke langkah 1. Berulang sampai karakter meninggal (usia tua, sakit parah, atau kecelakaan — lihat §6).

Waktu **tidak pernah maju sendiri** tanpa pemain menekan tombol (lihat `CLAUDE.md`).

## 3. Karakter

### 3.1 Statistik inti
- **Uang** (kas yang dipegang karakter)
- **Kesehatan** (0–100)
- **Energi** (0–100, terkuras oleh aktivitas & pekerjaan, pulih dengan istirahat/tidur)
- **Mood/kebahagiaan** (0–100)
- **Umur** (dalam tahun, dari titik mulai — misal 18 tahun — sampai meninggal)
- **Skill/atribut** sederhana untuk v1: sejumlah kecil angka (misal *Kecerdasan*, *Fisik*, *Karisma*) yang naik dari aktivitas tertentu (belajar, olahraga, sosialisasi) dan mempengaruhi peluang di jalur karier

### 3.2 Pembuatan karakter (character creation)
Sederhana untuk v1: nama, jenis kelamin/penampilan sprite, dan 1–2 pilihan latar belakang awal (mempengaruhi stat awal, bukan menulis cerita panjang). Tidak perlu wizard rumit.

## 4. Jalur karier

Di v1 semuanya **disederhanakan (abstraksi angka)** sesuai kesepakatan — kedalaman ditambah belakangan.

### 4.1 Kerja biasa (default, selalu tersedia)
Daftar pekerjaan generik data-driven (kasir, staf kantor, dst.), masing-masing dengan gaji, syarat skill minimum, dan jam kerja yang menguras energi. Naik jabatan lewat kombinasi lama bekerja + skill.

### 4.2 Bisnis (opsional, dipilih pemain)
- Pemain bisa membuka satu jenis usaha sederhana dari daftar data (misal: warung, toko online, bengkel kecil).
- v1: direpresentasikan sebagai angka **pendapatan per tick − biaya per tick**, dipengaruhi sedikit pilihan pemain (misal: "investasi promosi" menaikkan pendapatan tapi menguras kas). Event acak bisa mempengaruhi bisnis (pelanggan ramai, kompetitor baru, dst.).
- Tidak ada simulasi staf individual, rantai pasok, atau kompetitor AI kompleks di v1 — itu masuk daftar pengembangan lanjutan.

### 4.3 Olahraga (opsional, dipilih pemain)
- Pemain memilih satu cabang olahraga dari daftar data (misal: sepak bola, lari, basket).
- v1: karakter punya stat "kemampuan olahraga" yang naik lewat latihan (aksi di lokasi gym/lapangan). Pertandingan diselesaikan lewat **simulasi berbasis statistik** (bandingkan angka kemampuan vs lawan + sedikit acak), bukan game aksi real-time.
- Hasil pertandingan mempengaruhi uang (hadiah/gaji), mood, dan reputasi sederhana.

## 5. Dunia yang dijelajahi

- Gaya visual: **pixel art top-down retro**, gaya Stardew Valley / paket "Tiny" ala Kenney.
- Peta kota kecil dengan lokasi tetap: Rumah, Tempat Kerja (berubah sesuai pekerjaan aktif), Gym/Lapangan, Rumah Sakit, satu-dua lokasi sosial (kafe/taman).
- Karakter dikendalikan jalan kaki (arah/WASD atau klik-jalan — putuskan saat implementasi, catat di `docs/ARCHITECTURE.md`).
- Masuk ke sebuah lokasi memicu **layar menu/UI** (dashboard React) untuk aksi di lokasi itu — dunia eksplorasi dan UI dashboard saling melengkapi, bukan dua game terpisah.

## 6. Kematian & fresh start

- Kematian dipicu oleh: usia tua (peluang meningkat drastis setelah usia tertentu, misal 70+), kesehatan mencapai 0 (dari sakit yang tidak diobati atau event kecelakaan langka), atau event tertentu bernuansa risiko (opsional, tetap realistis-kontemporer, tidak perlu terlalu gelap).
- Saat meninggal: layar **"Life Summary"** menampilkan ringkasan hidup karakter (umur akhir, karier, total kekayaan, momen penting) — beri rasa penutup yang memuaskan.
- Setelah itu, **fresh start total**: karakter baru dari nol, tidak ada stat/uang/unlock yang dibawa. Ini pilihan desain yang disengaja (lihat keputusan user), bukan bug atau kekurangan.

## 7. Ruang lingkup v1 — TIDAK termasuk (di luar scope, jangan dikerjakan tanpa diskusi ulang)

- Multiplayer / akun online
- Panggilan AI/LLM real-time saat game dimainkan
- Aplikasi mobile/desktop terpisah (fokus web browser dulu)
- Sistem pembayaran/monetisasi apapun
- Sinkronisasi save ke cloud
- Grafis 3D
- Meta-progression lintas kehidupan (achievement, warisan, dst.) — sudah diputuskan: reset total
- Banyak save slot sekaligus
- Simulasi bisnis/olahraga yang dalam (staf individual, kompetitor AI kompleks, pertandingan real-time) — ini arah pengembangan v2+, bukan v1

## 8. Daftar layar UI (v1)

1. Layar utama / dashboard karakter (selalu terlihat sebagian, mis. bar status di atas)
2. Peta dunia (Phaser canvas, karakter berjalan)
3. Menu lokasi (muncul saat masuk lokasi — kerja, latihan, belanja, dst.)
4. Layar event (kotak dialog/notifikasi saat event acak terjadi, dengan pilihan bila relevan)
5. Layar kematian / Life Summary
6. Layar pembuatan karakter baru
7. Menu pengaturan sederhana (volume, reset save)
