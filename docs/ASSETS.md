# Referensi Aset & Kode

Dua kategori berbeda di sini — jangan dicampur:

1. **Dependency inti** (masuk `package.json`, dipasang lewat npm) — ini semua proyek raksasa, sangat terpercaya, dipakai jutaan developer. Tidak perlu diragukan.
2. **Repo referensi/bacaan** (bukan dependency, dibaca untuk belajar pola arsitektur) — ini proyek personal kecil. Berguna sebagai bahan belajar, **bukan untuk di-fork atau di-copy mentah-mentah**.

## 1. Dependency inti (via npm, resmi & besar)

| Package | Peran |
|---|---|
| `react`, `react-dom` | UI |
| `phaser` (v3, bukan v4) | dunia 2D & rendering karakter |
| `vite` | build tool |
| `typescript` | bahasa |
| `vitest` | testing |

Semua ini punya jutaan unduhan/pengguna — tidak perlu proses vetting tambahan.

## 2. Repo referensi arsitektur (dicek manual: bintang, lisensi, aktivitas)

### townBox — referensi utama
- **Link:** https://github.com/Maudfer/townBox
- **Lisensi:** MIT (bebas dipakai/dipelajari, termasuk komersial)
- **Status saat dicek:** 5 stars, 583 commit, CI aktif (typecheck + test + coverage gate 80%), dites dengan Jest + Playwright
- **Kenapa relevan:** persis genre yang kita buat — Phaser + React + TypeScript, simulasi kehidupan warga (kelahiran, kerja, sakit, kematian) DAN simulasi bisnis (gaji, untung/rugi, bangkrut) berjalan bersamaan, dengan pemisahan tegas antara *simulation core* (tanpa React/Phaser) dan lapisan tampilan — persis pola yang kita pakai di `docs/ARCHITECTURE.md`.
- **Cara pakainya:** baca `README.md` dan `CLAUDE.md` proyek itu untuk lihat bagaimana mereka menjabarkan event kehidupan sebagai data JSON, dan bagaimana `GameManager` (event bus mereka) menjadi satu-satunya jalur komunikasi core ↔ UI. **Jangan copy kode mereka langsung** — proyek mereka jauh lebih kompleks dari kebutuhan v1 kita (335 skill, genealogi ribuan orang, dll.) — ambil polanya saja, sesuaikan skala ke kebutuhan kita.
- **Catatan jujur:** ini proyek personal dengan bintang sedikit, bukan proyek populer. Nilainya ada di kualitas arsitekturnya (bisa dibaca sendiri di README-nya), bukan di popularitas.

### skyshift — referensi sekunder (testing & struktur dokumentasi)
- **Link:** https://github.com/rudidev08/skyshift
- **Lisensi:** MIT
- **Status saat dicek:** 1 star, kecil tapi rapi — headless economy core dites terpisah dari rendering, ada pengecekan memory leak & performa
- **Kenapa relevan:** contoh nyata proyek Phaser+TS+Vite yang sudah punya `CLAUDE.md` dan `AGENTS.md` sendiri untuk menjalankan proses AI-coding-agent — berguna sebagai pembanding format dokumentasi, bukan untuk mekanik gamenya (bertema luar angkasa, beda genre).

### Catatan tambahan (belum diverifikasi mendalam, cek dulu sebelum dipakai)
Beberapa repo lain sempat ditemukan saat riset (`roma-glushko/raise-of-economy`, `Jimimimi/economia` — port dari `larsiusprime/bazaarBot`, `maximinus/EconomicsEngine`) — semuanya tentang simulasi ekonomi berbasis JS. Belum saya cek detail lisensi/aktivitasnya. Kalau nanti butuh pola simulasi pasar/harga yang lebih canggih dari sekadar "pendapatan − biaya" (di luar scope v1), ini titik awal yang layak dicek, tapi **verifikasi dulu** (lisensi, kapan terakhir di-update) sebelum dipakai — jangan asumsikan aman.

## 3. Aset visual (2D pixel art, gratis selamanya, CC0)

Sumber utama: **Kenney.nl** — perpustakaan aset CC0 (bebas dipakai komersial, tanpa atribusi wajib) dengan puluhan ribu aset, termasuk seri "Tiny" bergaya minimalis/pixel yang cocok dengan gaya visual yang kita pilih (top-down retro ala Stardew Valley). Kenney juga punya paket "RPG Urban Kit" (480+ sprite) dan seri City Kit — beberapa dalam bentuk 3D/isometrik, jadi **saat memilih paket, pastikan cek dulu apakah versinya top-down 2D**, bukan isometrik/3D, supaya konsisten dengan gaya yang dipilih.
- **Cara pakai:** buka kenney.nl/assets, filter kategori "2D", cari paket bertema kota/karakter/interior yang gayanya konsisten satu sama lain (idealnya dari seri yang sama, misalnya semua dari seri "Tiny", supaya tidak nabrak gaya).

### Sudah diunduh & dipakai: Kenney "RPG Urban Pack" (Fase 2)

- **Sumber:** https://kenney.nl/assets/rpg-urban-pack — diunduh 22 Sep 2026 atas izin user
- **Lisensi:** **CC0 1.0** (`public/assets/town/LICENSE.txt`, salinan asli dari paket).
  Bebas dipakai untuk proyek pribadi, edukasi, **dan komersial**. Atribusi ke
  Kenney dianjurkan tapi **tidak wajib**.
- **Isi paket:** 486 tile berukuran **16x16**, satu tilesheet 27x18 tile.
- **Yang disimpan di repo:** `public/assets/town/tilemap.png` (versi **berjarak
  1px** antar tile) + `LICENSE.txt`. 486 berkas PNG satuan dan berkas preview
  **tidak** disimpan — isinya sama persis dengan tilesheet, jadi cuma menggandakan
  berat repo.
- **Kenapa versi berjarak, bukan `tilemap_packed.png`:** jarak 1px mencegah
  "texture bleeding" (garis tipis dari tile tetangga ikut tergambar saat di-zoom).
  Phaser menerimanya lewat opsi `spacing: 1`.
- **Cara menghitung indeks tile:** `indeks = baris * 27 + kolom`, kiri-atas = 0.

Isi yang relevan untuk kota kita (indeks sudah diverifikasi dengan melihat
tilesheet-nya, bukan ditebak):

| Keperluan | Indeks tile |
|---|---|
| Rumput | 5, 28 |
| Trotoar | 36 |
| Aspal | 440, 467 |
| Marka jalan | 433 (garis datar), 462 (garis tegak), 407 (perempatan) |
| Zebra cross | 355, 357 |
| Gedung bata merah | 17, 18, 71, 72, 98, 99 (dinding) · 44, 45 (baris jendela) |
| Gedung oranye | 125, 126, 179, 180 (dinding) · 152, 153 (baris jendela) |
| Gedung abu-abu | 14, 41 |
| Pintu | 255, 257, 310, 336, 443 |
| Pohon | 238, 291, 292 (hijau) · 345, 346 (oranye) |
| Mobil | 2×2 tile, **moncong menghadap bawah** (lampu, kaca depan, roda, dan bayangan di sisi bawah): `[447, 448, 474, 475]` dan `[450, 451, 477, 478]` (keduanya cermin kiri-kanan). ~~251-254~~ ternyata tempat sampah/kotak pos — dicatat salah sejak Fase 2, dibetulkan 23 Sep 2026. |
| Sprite orang | Di **4 kolom paling kanan** (kolom 23-26), 18 baris. Rumus: `dasar = baris * 27 + 23`, lalu `+0` **profil kiri**, `+1` **hadap depan (bawah)**, `+2` hadap belakang (atas), `+3` **profil kanan** (cermin persis `+0`). |
| Siapa di baris mana | **6 orang × 3 frame**, bukan 18 orang: baris `3k` = diam, `3k+1` dan `3k+2` = dua langkah jalan (warnanya identik). Dicek piksel demi piksel, 23 Sep 2026. Catatan lama ("18 karakter", "+0 hadap bawah") salah dan membuat pemain serta semua potret tampil menyamping. |

Sumber cadangan (kalau ada celah yang tidak dicover Kenney):
- **OpenGameArt.org** — filter berdasarkan lisensi CC0/CC-BY sebelum pakai
- Kreator itch.io yang rilis paket CC0 lengkap: **Pixel Frog**, **Ansimuz**, **0x72** — biasa dipakai untuk tileset & karakter pixel-art bergaya serupa

### Sudah diunduh & dipakai: Kenney "Interface Sounds" (Fase 5D)

- **Sumber:** https://kenney.nl/assets/interface-sounds — diunduh 23 Sep 2026 atas izin user
- **Lisensi:** **CC0 1.0** (`public/assets/sfx/LICENSE.txt`, salinan asli dari paket)
- **Isi paket:** 100 berkas `.ogg`
- **Yang disimpan di repo:** **6 berkas saja**, total **73 KB**, diganti nama sesuai perannya:

| Berkas | Asal | Dibunyikan saat |
|---|---|---|
| `week.ogg` | `tick_002` | Satu minggu berlalu |
| `good.ogg` | `confirmation_001` | Kejadian baik |
| `bad.ogg` | `error_004` | Kejadian buruk |
| `decide.ogg` | `question_002` | Event yang menghentikan minggu |
| `buy.ogg` | `confirmation_004` | Membeli barang |
| `death.ogg` | `minimize_008` | Karakter meninggal |

94 berkas sisanya tidak disimpan. Menyimpan seluruh paket berarti menambah
ratusan KB yang tidak pernah dibunyikan.

**Tidak ada musik latar**, sesuai keputusan user — musik yang sama selama
berjam-jam menyiksa, dan lisensi musik gratis lebih rumit daripada SFX
(lihat catatan Jamendo di bawah).

## 4. Audio (SFX & musik, gratis)

- **Kenney.nl** juga punya paket sound effect gratis CC0
- **Freesound.org** — banyak SFX gratis, cek lisensi per-file (tidak semua CC0, sebagian CC-BY butuh atribusi)
- **Jamendo** — untuk musik, perhatikan: lisensi personal gratis, tapi butuh lisensi sync berbayar untuk pemakaian komersial — kalau proyek ini akan dipublikasikan ke publik meski gratis, baca ketentuannya dulu

## 5. Kalau nanti butuh generate aset custom dengan AI

Lihat pembahasan di chat sebelumnya: gunakan AI generator hanya untuk **mengisi celah** (logo fiktif, potret NPC penting) setelah fondasi dari Kenney terpasang — bukan untuk membuat seluruh set sprite dari nol, karena AI masih lemah soal konsistensi gaya lintas banyak aset. Kalau ada GPU lokal yang cukup kuat, model open-source (Stable Diffusion/SDXL via ComfyUI) adalah satu-satunya jalur AI yang benar-benar gratis tanpa kuota.
