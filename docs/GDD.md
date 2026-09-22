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

**Diputuskan user 22 Sep 2026 (Fase 5):** pemain memilih satu dari **18 sprite**
yang sudah ada di tilesheet kota. Penampilan **murni tampilan** — tidak
mempengaruhi satu aturan pun, termasuk keluarga: siapa pun bisa menikah dan
punya anak. Alasannya sengaja: tiap cabang aturan yang diikat ke jenis kelamin
menambah jalur yang harus diseimbangkan dan dites, dengan imbalan permainan
yang kecil.

## 4. Jalur karier

Di v1 semuanya **disederhanakan (abstraksi angka)** sesuai kesepakatan — kedalaman ditambah belakangan.

### 4.1 Kerja biasa (default, selalu tersedia)
Daftar pekerjaan generik data-driven (kasir, staf kantor, dst.), masing-masing dengan gaji, syarat skill minimum, dan jam kerja yang menguras energi. Naik jabatan lewat kombinasi lama bekerja + skill.

### 4.2 Bisnis (opsional, dipilih pemain)
- Pemain bisa membuka satu jenis usaha sederhana dari daftar data (misal: warung, toko online, bengkel kecil).
- v1: direpresentasikan sebagai angka **pendapatan per tick − biaya per tick**, dipengaruhi sedikit pilihan pemain (misal: "investasi promosi" menaikkan pendapatan tapi menguras kas). Event acak bisa mempengaruhi bisnis (pelanggan ramai, kompetitor baru, dst.).
- Tidak ada simulasi staf individual, rantai pasok, atau kompetitor AI kompleks di v1 — itu masuk daftar pengembangan lanjutan.

**Aturan yang sudah diputuskan user (22 Sep 2026). Jangan ditanya ulang.**

| Hal | Keputusan | Kenapa begitu |
|---|---|---|
| Cara menghasilkan | **Pasif, tapi butuh perhatian.** Usaha berdagang setiap hari apapun fokus pemain, tapi hanya sebagian pemasukannya yang masuk. Fokus "Mind the shop" memberi pemasukan penuh. | Inilah yang membedakan bisnis dari pekerjaan: uang jalan sendiri, tapi menelantarkannya ada harganya. |
| Biaya harian | **Selalu ditagih penuh**, ditunggui atau tidak. | Akibatnya usaha besar yang ditelantarkan **rugi**, bukan sekadar menghasilkan lebih sedikit. Ini risiko yang sengaja diambil pemain. |
| Modal awal | **Wajib punya uangnya.** Tidak bisa membuka usaha yang tidak terbayar. | Ini penyerap uang pertama di game, menjawab celah "uang menumpuk tanpa guna" tanpa menaikkan biaya hidup. |
| Satu slot karier | Punya usaha **dan** pekerjaan sekaligus tidak bisa. Harus melepas yang satu dulu, sebagai keputusan tersendiri. | Sesuai `ARCHITECTURE.md` §5. Kalau tidak dijaga, mengambil pekerjaan akan menghapus usaha berikut modal yang sudah dibayar. |
| Bangkrut | **Tidak ada bangkrut otomatis.** Usaha yang rugi terus jalan sampai pemain menutupnya sendiri. | Keputusan user. Risikonya (tabungan seumur hidup habis diam-diam) ditutup dengan **peringatan di dashboard** saat usaha merugi — bukan dengan menutup usaha tanpa izin pemain. |
| Menutup usaha | **Tidak ada uang kembali.** | Membuat keputusan membuka usaha punya bobot. Kalau terasa terlalu kejam, ini satu angka yang gampang diubah. |
| Tingkat usaha | Investasi promosi menaikkan pemasukan, **dibatasi 3 tingkat**. | Tanpa batas, "belanja uang untuk dapat uang lebih" jadi mesin uang tak terbatas begitu pemain punya tabungan. |

### 4.3 Olahraga (opsional, dipilih pemain)
- Pemain memilih satu cabang olahraga dari daftar data (misal: sepak bola, lari, basket).
- v1: karakter punya stat "kemampuan olahraga" yang naik lewat latihan (aksi di lokasi gym/lapangan). Pertandingan diselesaikan lewat **simulasi berbasis statistik** (bandingkan angka kemampuan vs lawan + sedikit acak), bukan game aksi real-time.
- Hasil pertandingan mempengaruhi uang (hadiah/gaji), mood, dan reputasi sederhana.

**Aturan yang sudah diputuskan user (22 Sep 2026). Jangan ditanya ulang.**

| Hal | Keputusan | Kenapa begitu |
|---|---|---|
| Kapan bertanding | **Otomatis.** Pertandingan datang sendiri setiap sekian **hari latihan**, hasilnya masuk log. Tidak ada tombol "bertanding". | Cocok dengan ritme "satu klik = satu minggu". Tombol yang bisa ditekan berkali-kali akan dipencet sampai menang. |
| Hari istirahat | Menunda pertandingan, **bukan menghanguskannya**. Hitungannya hanya maju di hari latihan. | Lebih memaafkan, dan tetap membuat latihan terasa berarti. |
| Penghasilan | **Hadiah pertandingan saja.** Tidak ada gaji. Menang besar, kalah hampir tidak dapat apa-apa. | Keputusan user. Inilah yang membuat olahraga terasa berbeda: kerja = stabil, bisnis = pasif, olahraga = berisiko. |
| Usia | **Kemampuan menurun setelah usia puncak (32), tanpa pensiun paksa.** Atlet tua makin sering kalah dan hadiahnya mengecil. | Keputusan user, sejalan dengan penolakan bangkrut otomatis di §4.2: keputusan berhenti tetap di tangan pemain. Karier atlet jadi punya jendela waktu yang nyata. |
| Reputasi | Naik saat menang, turun saat kalah, 0-100, dan **mengali besarnya hadiah**. | "Reputasi sederhana" yang diminta dokumen ini, tanpa sistem terpisah. |
| Lokasi | Gedung **Stadion** di distrik kedua peta. | Lihat catatan peta dua distrik di `ARCHITECTURE.md` §11. |
| Satu slot karier | Olahraga, kerja, dan bisnis tidak bisa dipegang bersamaan. | Sama seperti §4.2. |

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

**Perubahan scope, 22 Sep 2026 (Fase 5).** Satu hal dipindahkan dari daftar ini
ke DALAM scope atas permintaan eksplisit user: **NPC yang punya hidup sendiri**
(menua, bekerja, menikah, punya anak, meninggal tanpa campur tangan pemain).
`ROADMAP.md` menetapkan bahwa hal di luar roadmap hanya boleh dikerjakan kalau
user meminta secara eksplisit **dan dokumennya diubah dulu** — ini catatan
perubahan itu. Rinciannya di §10.

Yang **tetap** di luar scope: multiplayer, LLM saat main, aplikasi terpisah,
monetisasi, save cloud, grafis 3D, meta-progression lintas kehidupan, banyak
save slot, dan simulasi bisnis/olahraga yang dalam.

## 8. Daftar layar UI (v1)

1. Layar utama / dashboard karakter (selalu terlihat sebagian, mis. bar status di atas)
2. Peta dunia (Phaser canvas, karakter berjalan)
3. Menu lokasi (muncul saat masuk lokasi — kerja, latihan, belanja, dst.)
4. Layar event (kotak dialog/notifikasi saat event acak terjadi, dengan pilihan bila relevan)
5. Layar kematian / Life Summary
6. Layar pembuatan karakter baru
7. Menu pengaturan sederhana (volume, reset save)

## 9. Barang, gaya hidup, dan uang (Fase 5)

Sampai Fase 4 uang menumpuk tanpa guna — pemain cermat mati dengan ratusan ribu
sampai jutaan di rekening. Tiga penyerap ditambahkan sekaligus (keputusan user,
22 Sep 2026). Ketiganya bekerja dengan cara yang berbeda supaya pilihan terasa
berbeda.

### 9.1 Barang permanen
Sekali beli, efeknya seumur hidup karakter. Contoh: rumah yang lebih baik
membuat Istirahat memulihkan lebih banyak energi; kendaraan mengurangi energi
yang terbuang tiap hari. Harganya besar, jadi benar-benar menyerap tabungan.
Didefinisikan sebagai data, satu entri per barang.

### 9.2 Gaya hidup
Satu taraf hidup yang dipilih pemain (sederhana → mewah). Makin tinggi, biaya
hidup harian makin besar tapi mood dan kesehatan ikut terangkat. Menyerap
terus-menerus, bukan sekali bayar. Bisa diturunkan lagi kalau uang menipis.

### 9.3 Keluarga
Lihat §10. Menikah butuh biaya besar sekali bayar; tiap tanggungan menambah
biaya harian dan menaikkan mood.

### 9.4 Target keseimbangan
**Satu kehidupan cukup untuk salah satu, bukan semuanya**: rumah bagus ATAU
keluarga besar ATAU gaya hidup mewah. Uang jadi bahan pilihan, bukan hitungan
mundur, dan tiap kehidupan berikutnya bisa terasa berbeda dari yang sebelumnya.
Pemain ceroboh tetap bisa jatuh miskin.

## 10. Keluarga & hubungan (Fase 5)

`§1` selalu menyebut pemain mengurus "kesehatan, **hubungan**, dan keuangan",
tapi hubungan tidak pernah dibuat sampai fase penutup ini.

### 10.1 Orang di sekitar pemain
Orang muncul lewat event: keluarga asal, teman, rekan kerja, pasangan. Tiap
orang punya nama, peran, dan satu angka **kedekatan** 0–100 yang naik kalau
pemain meluangkan waktu dan turun kalau diabaikan.

### 10.2 Mereka punya hidup sendiri
Keputusan user, 22 Sep 2026 — ini bagian yang dipindahkan ke dalam scope
(lihat §7). NPC **menua, bekerja, menikah, punya anak, dan meninggal** tanpa
campur tangan pemain. Dunia bergerak walau pemain tidak menyentuhnya.

### 10.3 Batas data — wajib, bukan pilihan
Save hidup di localStorage dan ada test yang menjaganya tetap kecil. Karena itu:

- Orang yang **masih hidup dan dikenal** disimulasikan penuh.
- Orang yang **meninggal atau menghilang** dipadatkan jadi satu baris kenangan:
  nama, peran, dan apa yang terjadi. Muncul di Life Summary, tidak disimulasikan
  lagi.

Tanpa aturan ini, 70 tahun kenalan akan menembus batas penyimpanan dan game
gagal menyimpan diam-diam di tengah permainan.

### 10.4 Yang tetap tidak dibuat
Pohon keluarga lintas generasi yang bisa ditelusuri, percakapan bebas, dan NPC
yang bisa diajak bicara di peta. Hubungan tetap berupa angka dan event, bukan
dialog.
