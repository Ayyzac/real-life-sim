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

**Sejak Fase 6 (keputusan user, 23 Sep 2026):** satu hari juga bisa dimainkan
**per jam** — makan, minum, mandi, ngobrol, belanja, masing-masing makan waktu.
"Lanjut Minggu" tetap ada sebagai autopilot. Rinciannya di §11.

## 3. Karakter

### 3.1 Statistik inti
- **Uang** (kas yang dipegang karakter)
- **Kesehatan** (0–100)
- **Energi** (0–100, terkuras oleh aktivitas & pekerjaan, pulih dengan istirahat/tidur)
- **Mood/kebahagiaan** (0–100)
- **Umur** (dalam tahun, dari titik mulai — misal 18 tahun — sampai meninggal)
- **Skill/atribut** sederhana untuk v1: sejumlah kecil angka (misal *Kecerdasan*, *Fisik*, *Karisma*) yang naik dari aktivitas tertentu (belajar, olahraga, sosialisasi) dan mempengaruhi peluang di jalur karier
- **Kebutuhan** (Fase 6): *Lapar*, *Haus*, *Kebersihan* (0–100). Hanya bergerak saat hari dimainkan per jam. Lihat §11.2.

### 3.2 Pembuatan karakter (character creation)
Sederhana untuk v1: nama, jenis kelamin/penampilan sprite, dan 1–2 pilihan latar belakang awal (mempengaruhi stat awal, bukan menulis cerita panjang). Tidak perlu wizard rumit.

**Diputuskan user 22 Sep 2026 (Fase 5):** pemain memilih satu dari **18 sprite**
yang sudah ada di tilesheet kota. Penampilan **murni tampilan** — tidak
mempengaruhi satu aturan pun, termasuk keluarga: siapa pun bisa menikah dan
punya anak. Alasannya sengaja: tiap cabang aturan yang diikat ke jenis kelamin
menambah jalur yang harus diseimbangkan dan dites, dengan imbalan permainan
yang kecil.

**Koreksi 23 Sep 2026 (Fase 6):** 18 sprite itu ternyata **6 orang × 3 frame**
(diam + dua langkah jalan), dicek piksel demi piksel. Pemain sekarang **merakit
sendiri**: pilih satu dari 6 badan, lalu warna rambut, baju, dan kulit, dengan
tombol Acak. Warna diganti lewat *palette swap*, jadi peta dan potret selalu
sama. Tetap murni tampilan.

## 4. Jalur karier

Di v1 semuanya **disederhanakan (abstraksi angka)** sesuai kesepakatan — kedalaman ditambah belakangan.

### 4.1 Kerja biasa (default, selalu tersedia)
Daftar pekerjaan generik data-driven (kasir, staf kantor, dst.), masing-masing dengan gaji, syarat skill minimum, dan jam kerja yang menguras energi. Naik jabatan lewat kombinasi lama bekerja + skill.

**Sejak Fase 6:** Sabtu–Minggu libur, dan bolos dimungkinkan dengan akibat (catatan absen → teguran → dipecat). Lihat §11.3.

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
- **Sejak Fase 6:** tiap gedung punya **ruangan dalam** yang bisa dimasuki, jam buka, dan orang di dalamnya. Ada gedung baru, **Mall**. Lihat §11.4–§11.5.

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

**Perubahan scope, 23 Sep 2026 (Fase 6).** Atas permintaan eksplisit user, dua
hal yang dulu sengaja dicoret kini masuk scope: **ruangan dalam gedung** (dicoret
di keputusan Fase 2) dan **NPC yang bisa diajak bicara** (dicoret di §10.4).
Percakapannya **ditulis sebelumnya sebagai data** oleh Claude saat development —
**bukan** AI saat game dijalankan, jadi larangan LLM di `CLAUDE.md` tetap utuh.
Rinciannya di §11.

**Perubahan scope, 23 Sep 2026 (Fase 7).** Atas permintaan eksplisit user:
**jam berjalan sendiri** (mencabut "waktu tidak pernah maju sendiri" di §2),
**belanja & tas** dan **waktu tempuh jalan kaki** (dicoret dari §11.8), plus HP,
laptop, bank, saham/crypto, casino/judol, hujan, dan media sosial. Semua tetap
berjalan di browser tanpa server dan tanpa AI saat main. Rinciannya di §12.

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
Pohon keluarga lintas generasi yang bisa ditelusuri, dan percakapan bebas
(mengetik sendiri).

~~NPC yang bisa diajak bicara di peta. Hubungan tetap berupa angka dan event,
bukan dialog.~~ — **dicabut 23 Sep 2026** atas permintaan user. Ngobrol dengan
pilihan jawaban tertulis kini ada; lihat §11.6.

## 11. Hidup per jam (Fase 6)

Semua keputusan di bagian ini diambil user lewat enam putaran tanya-jawab pada
**23 Sep 2026**. Anggap FINAL — jangan tanya ulang. Angka persisnya ada di
`src/data/balance.ts` dan boleh disetel; **aturannya** tidak.

### 11.1 Satu hari
- Bangun **07:00**. Pagi **07:00–09:00** bebas.
- **Blok fokus 09:00–17:00** berjalan lewat satu tombol ("Go to work" / "Start
  the day"), jam melompat ke 17:00 dengan animasi. **Istirahat tidak punya blok**:
  pemain yang beristirahat bebas seharian.
- Malam **17:00–24:00** bebas. Boleh **begadang sampai 02:00**, tapi tiap jam
  lewat tengah malam mengurangi energi besok. Pukul 02:00 karakter tertidur sendiri.
- Aksi tidak boleh melewati batas jendela waktunya (tidak bisa mulai makan 45
  menit pukul 08:50 sebelum kerja).
- **Tidur** = hari selesai. Aturan harian lama (gaji, biaya, penuaan, event)
  berjalan persis seperti sebelumnya, lalu hari berikutnya mulai 07:00.
- **Lanjut Minggu** = sisa hari ini + 6 hari **autopilot**. Autopilot tidak
  pernah bolos dan tidak pernah kelaparan.
- Animasi aksi **proporsional durasi, maksimal 3 detik** (15 menit ≈ 0,5 detik,
  1 jam ≈ 1 detik, blok 8 jam ≈ 3 detik). Perubahan state tetap terjadi sekali per
  klik; animasinya hanya tampilan (`CLAUDE.md` aturan 3).

### 11.2 Kebutuhan: Lapar, Haus, Kebersihan
- Skala 0–100. **Hanya turun saat jam benar-benar berjalan** (aksi atau blok
  fokus). Hari yang di-skip tidak menurunkan apa pun — autopilot = hidup wajar.
- Setiap pagi kembali ke nilai bangun yang tetap (lapar & haus sedang,
  kebersihan sedang): sarapan dan mandi selalu ada gunanya.
- Selama blok fokus, lapar dan haus turun **setengah laju** (makan siang di tempat).
- Di bawah 20: **mood dan energi** terkikis per jam. **Tidak pernah kesehatan**
  — tidak ada yang mati karena lupa makan, sehingga "kematian selalu didahului
  tanda" (`ARCHITECTURE.md` §11 Fase 1) tetap utuh.
- Tidur dalam keadaan lapar/haus di bawah 20 = besok mulai lebih lelah.
- **Makan & minum di rumah gratis** (sudah termasuk biaya hidup $22/hari), cuma
  makan waktu. Kafe dan mall bayar, tapi lebih cepat dan menaikkan mood.
- Kebersihan rendah: mood turun · ngobrol kurang efektif · menyapa orang asing
  lebih sering gagal · datang kerja dalam keadaan kotor = **½ catatan absen**
  (pasti, bukan acak).

### 11.3 Kerja: akhir pekan dan bolos
- **Sabtu–Minggu hanya kerja kantoran yang libur.** Usaha, atlet, belajar, gym,
  sosialisasi, dan berobat tetap berjalan — itu pilihan pemain sendiri.
- Hari libur pegawai dihitung sebagai **Istirahat** (tanpa gaji). Pegawai
  **dibayar untuk hari yang dikerjakan** — lima hari per minggu.
  *Diubah user 23 Sep 2026:* rencana awal menaikkan gaji hari kerja ×7/5 agar
  gaji mingguan sama. Diukur lewat simulasi, itu **menggandakan** uang pegawai
  seumur hidup (~$450rb → ~$945rb), karena dengan libur akhir pekan pemain
  cermat hampir tidak pernah butuh minggu istirahat lagi. User memilih
  mengembalikan total seumur hidup ke sekitar semula (target §9.4): gaji per
  minggu turun, tapi minggu kerja jadi lebih banyak.
- **Bolos boleh**: pukul 09:00 di hari kerja ada pilihan "Skip work". Siang jadi
  bebas, tapi hari itu tidak digaji dan dapat **1 catatan absen**. Catatan pudar
  sendiri seiring waktu. **3 catatan aktif = teguran** (peringatan di layar),
  **5 = dipecat**. Selalu ada peringatan sebelum dipecat.

### 11.4 Tempat dan ruangan
- **Semua 8 gedung punya ruangan dalam**: Rumah, Kafe, Rumah Sakit, Gym, Mall,
  Kantor, Usaha (tata letak berbeda per jenis usaha), Stadion.
- Ruangan **Rumah** berubah sesuai rumah yang dimiliki: kamar sewa → Flat →
  Rumah dengan taman.
- **Jam buka**: Kafe 07–22, Gym 06–22, Mall 10–22, Rumah Sakit 24 jam, Rumah
  selalu. Kantor, Usaha, Stadion diatur di data. Gedung tutup menampilkan
  "Closed · opens 07:00".
- Di dalam ruangan terlihat siapa yang ada (dengan nama) dan furnitur yang bisa
  diklik untuk melakukan aksi.
- Orang yang dikenal muncul di ruangan menurut jadwal yang pasti (bukan acak):
  pasangan dan anak di rumah, rekan kerja di kantor, teman di kafe/gym/mall pada
  malam hari, keluarga di mall/kafe akhir pekan.

### 11.5 Mall
Gedung baru di Eastside. Isinya:
- **Food court & minuman** — bayar, cepat, naik mood.
- **Toko barang** — membeli barang permanen (§9.1) pindah ke sini dari tab Rumah.
- **Toko baju** — ganti warna pakaian karakter (murni tampilan + sedikit mood).
- **Bioskop/arkade** — hiburan 2 jam, bayar, mood naik; bisa mengajak kenalan.

### 11.6 Orang: ngobrol, sifat, pacaran, orang asing
- **Ngobrol** = NPC membuka obrolan, pemain memilih 2–3 jawaban. Semua kalimat
  **ditulis sebelumnya sebagai data** (bahasa Inggris, sesuai aturan teks in-game).
- Tiap orang punya **sifat** (mis. jenaka, serius, sensitif). Jawaban yang cocok
  dengan sifatnya menaikkan kedekatan lebih banyak; yang salah naik sedikit atau
  turun. Sifat **tersembunyi** ("???") dan terungkap bertahap lewat obrolan.
- Ngobrol dengan orang yang sama paling banyak sekali sehari.
- **Romansa: teman → pacar → menikah.** Teman dekat bisa diajak kencan dan bisa
  menolak. Pacar bisa dilamar (biaya nikah tetap). Satu pacar/pasangan dalam satu
  waktu. **Pacar bisa putus** kalau lama diabaikan (ada peringatan dulu);
  **pasangan menikah tidak cerai**.
- **Ajak jalan lewat telepon** dari tab People: makan atau bioskop. Bisa
  menolak. Bayar untuk berdua, kedekatan naik lebih banyak dari ngobrol biasa.
- **Orang asing**: NPC di jalan bisa diklik dan disapa (10 menit). Peluang
  berhasil tergantung karisma dan kebersihan. Yang berhasil jadi kenalan baru
  dan **wajahnya jadi potretnya**. Paling banyak **3 sapaan per hari**.

### 11.7 Tampilan
- **Laptop/PC dulu** (dua kolom: peta + panel bertab), HP tetap bisa (bertumpuk).
- Bar status di atas: jam, hari, uang, dan enam bar (Kesehatan, Energi, Mood,
  Lapar, Haus, Kebersihan).
- Setelah Lanjut Hari/Minggu muncul laporan "apa yang berubah".

### 11.8 Sengaja tidak dibuat
Waktu tempuh jalan kaki antar tempat · isi kulkas/belanja bahan · kenalan
bernama berkeliaran di jalan (mereka ada di dalam ruangan) · mode per jam tanpa
skip · AI saat main · cerai · NPC saling menikah · musik latar.

## 12. Kota hidup (Fase 7)

Diputuskan user lewat empat putaran tanya-jawab pada **23 Sep 2026**. Anggap
FINAL — jangan tanya ulang. Angka persisnya di `src/data/balance.ts` dan data
terkait; **aturannya** tidak.

| Hal | Aturan |
|---|---|
| Jam | Berjalan sendiri: **1 jam game = 1 menit nyata** di kecepatan 1×. Pause dan 1×/2×/4×. Berhenti otomatis saat dialog, HP, laptop, mini-game, atau casino terbuka, dan saat tab browser ditinggal. Tidur dan Lanjut Minggu tetap ada. Jalan kaki jadi makan waktu. |
| Pukul 09:00 | Jam berhenti, muncul "Berangkat kerja" / "Bolos" (bukan pegawai: "Mulai"). Berangkat = jam lompat ke 17:00 seperti §11.1. |
| Rumah | Kosong, kecuali pasangan dan anak. Keluarga/teman datang **hanya kalau diundang lewat HP**. |
| Gym | Butuh **membership**, dipotong otomatis tiap 30 hari, bisa berhenti kapan saja. Latihan dan fokus Exercise hanya untuk member. |
| HP | Punya dari awal. Kontak (telepon, ajak jalan, undang ke rumah), berita, diskon, cuaca, taksi, pesan antar, bank, saham, crypto, slot online, media sosial. |
| Laptop | Dibeli di Mall (barang permanen), dipakai di rumah. Semua app HP + lamar kerja, email, kerja lepas lewat 4 mini-game (ketik cepat, hitung cepat, cocokkan kartu, sortir paket). |
| Lamaran | Lamar dari laptop → balasan email besok pagi. Papan lowongan kantor tetap langsung. |
| Tas | Masak di rumah tetap gratis. Supermarket menjual bekal dan payung; makan dari tas di mana saja. ±12 slot, tanpa kedaluwarsa. Diskon harian. |
| Hujan | Jalan lebih sepi, sebagian orang berpayung. Kehujanan tanpa payung: kebersihan dan mood turun sedikit. Prakiraan di HP. |
| Pasar | Saham bergerak harian (hari kerja), crypto per jam game dan jauh lebih liar. |
| Bank | Tabungan berbunga kecil; pinjaman dengan cicilan harian. |
| Judi | Casino (slot, roulette, blackjack) dan slot online. Bandar selalu unggul; online lebih curang dari casino. **Tanpa kecanduan** — cuma untung-rugi uang. |
| Obrolan | **Pohon dialog per topik**: pilih topik, beberapa giliran, bisa ajak jalan di tengah obrolan, pamit kapan saja. Ditulis sebelumnya sebagai data (bahasa Inggris). |
