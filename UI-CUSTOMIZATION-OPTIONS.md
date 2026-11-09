# Opsi Perubahan UI Kiwi TCMS

Catatan diskusi tentang cara mengubah UI Kiwi TCMS tanpa kehilangan kemampuan mengikuti update dari repo upstream ([kiwitcms/Kiwi](https://github.com/kiwitcms/Kiwi)).

Status: **bahan diskusi, belum ada keputusan.**

## Tiga ide

### 1. Bridging / add-on tanpa mengubah direktori `Kiwi`

`Kiwi` tetap submodule murni (pin commit tidak diubah). Semua kustomisasi hidup di app Django terpisah, misalnya `kaspin`, yang dipasang lewat settings lokal (`kiwi_local_settings.py`).

Titik ekstensi yang bisa dipakai:
- **Template dan static:** letakkan app `kaspin` sebelum `tcms` di `INSTALLED_APPS`. Template dengan path yang sama (`base.html`, `testcases/search.html`, dst.) menimpa yang asli.
- **Model baru:** model dan migrasi sendiri di app `kaspin`, berelasi ke model Kiwi lewat FK atau model terpisah, tanpa menambah kolom di tabel Kiwi.
- **API:** daftarkan method RPC baru dari app `kaspin`.
- **Settings:** tambahan konfigurasi di `kiwi_local_settings.py`.

Kelebihan: update upstream cukup memindahkan pin submodule. Kekurangan: perubahan yang harus menyentuh logika core (misalnya filter di `rpc/api/testcase.py`) tidak bisa dilakukan murni lewat override, dan perlu monkey-patch, signal, atau patch kecil.

### 2. Tetap mengubah direktori `Kiwi`, kode perubahan dikumpulkan di direktori khusus

`Kiwi` dimodifikasi langsung (fork), tetapi kode baru ditaruh di direktori khusus seperti `modules/` atau `kaspin-module/`. Perubahan pada file core dibuat sekecil mungkin dan didokumentasikan.

Kelebihan: bisa mengubah apa saja, termasuk model dan API core. Update upstream masih mungkin lewat merge atau rebase. Kekurangan: konflik muncul di setiap file core yang diubah, dan makin banyak file diubah makin berat merge-nya.

### 3. Duplikasi direktori `Kiwi` menjadi `Kaspin`

Seluruh `Kiwi` disalin dan diganti nama (misalnya `Kaspin`), lalu semua perubahan dilakukan di salinan itu.

Kelebihan: paling mudah dikerjakan di awal, bebas ubah apa saja. Kekurangan: link ke upstream putus, history hilang, dan setiap update upstream berarti merge manual ratusan file.

## Perbandingan

| | 1. Bridge / add-on | 2. Ubah Kiwi + folder modul | 3. Duplikat jadi Kaspin |
|---|---|---|---|
| Mengikuti update upstream | Mudah | Sedang (konflik di file core) | Sulit (merge manual, history putus) |
| Bisa mengubah skema/model core | Terbatas | Bisa | Bisa |
| Bisa mengubah template/JS | Bisa (override) | Bisa | Bisa |
| Effort awal | Sedang | Rendah | Rendah |
| Risiko jangka panjang | Rendah | Sedang | Tinggi |

Catatan: opsi 2 dan 3 tidak otomatis menjaga kemampuan update upstream, karena kode ubahan tetap bercampur dengan file core.

## Kondisi branch `re-ui` (per 2026-11-04)

Rekan tim sudah mencoba opsi 3 di branch `origin/re-ui` (commit `6c5cbd6` dan `20c1f62`):
- Submodule `Kiwi` diganti folder biasa `Kaspin` (897 file), ditambah `run-kaspin.sh`.
- Dibanding `Kiwi` pada pin `d3a946f`: **50 file diubah, 30 file baru**.
- Hanya sekitar 19 file yang berupa template/JS/CSS. Sisanya bukan UI, melainkan fitur **Project** baru:
  - model `Project`, 3 migrasi di `management`, 10 migrasi di `testcases`
  - API dan `project_scope.py`
  - perubahan pada `rpc/api/*`, `testcases/models.py`, `telemetry/*`

Artinya `re-ui` lebih dari perubahan tampilan: ada perubahan skema DB dan logika core.

## Rekomendasi sementara

Pendekatan hibrida dengan dasar opsi 1:
1. Pertahankan `Kiwi` sebagai submodule yang tidak diubah.
2. Pindahkan perubahan UI (template/JS/CSS) ke app `kaspin` lewat override.
3. Pindahkan fitur Project (model, migrasi, API) ke app `kaspin` terpisah, direview tersendiri karena menyentuh skema DB.
4. Untuk perubahan yang tidak bisa di-override, gunakan patch kecil yang terdokumentasi (opsi 2 yang disiplin), bukan menyalin seluruh direktori.
5. Jangan merge `re-ui` apa adanya sebagai folder `Kaspin`.

## Pertanyaan terbuka

1. Fitur Project scoping sudah dipakai atau di-deploy, atau masih eksperimen? Jika sudah ada data, migrasi harus dijaga kompatibel.
2. Seberapa sering tim ingin mengikuti update upstream? Jika jarang, opsi 2 masih masuk akal.
3. Langkah konkret berikutnya: buat daftar 50 file yang diubah, dikelompokkan menjadi "bisa di-override" dan "perlu patch core".

---

# Catatan implementasi: dashboard superuser (contoh opsi 1)

> **Penanda untuk pembaca:** semua bagian di ATAS garis pemisah ini (Tiga ide, Perbandingan, Kondisi `re-ui`, Rekomendasi, Pertanyaan terbuka) adalah **bahan diskusi** tentang 3 ide pengelolaan perubahan UI. Bagian di BAWAH ini adalah **catatan pekerjaan yang sudah dilakukan** (commit `b35e4c0`), bukan bagian dari diskusi. Ini contoh nyata opsi 1: `Kiwi` tidak diubah.

## Masalah

Dashboard upstream (`Kiwi/tcms/core/views.py`, `DashboardView`) hanya menampilkan test plan yang `author`-nya user login, dan test run yang user tersebut jadi manager/default tester/assignee. Superuser yang tidak membuat apa pun melihat dashboard kosong, padahal data ada.

## Yang dilakukan

Superuser melihat semua test plan aktif dan semua test run yang belum selesai. User non-superuser tetap memakai dashboard upstream tanpa perubahan.

## Isi `kiwi_templates/` dan file terkait

`kiwi_templates/` hanya satu bagian dari fitur. Jejak lengkapnya ada di 4 tempat:

| File | Peran |
|------|-------|
| `kiwi_templates/dashboard_all.html` | Salinan `Kiwi/tcms/core/templates/dashboard.html`. Beda: judul panel ("... (all users)"), link SEE ALL tanpa filter user, teks total. Template ini dipakai hanya untuk superuser. |
| `kiwi_custom_package/dashboard.py` | `AllDataDashboardView(DashboardView)`: memilih `dashboard_all.html` dan mengisi queryset tanpa filter user bila `is_superuser`; selain itu memanggil perilaku upstream. |
| `kiwi_custom_package/urls.py` | URLconf baru: mengambil `tcms.urls` lalu mengganti route `/` (`core-views-index`) ke `AllDataDashboardView` dan `accounts/register/` ke `AutoActivateRegister`. |
| `kiwi_custom_package/register.py` | `AutoActivateRegister(Register)`: user baru langsung aktif tanpa verifikasi email. |
| `kiwi_local_settings.py` dan `deploy/server/kiwi_prod_settings.py` | Masing-masing +2 baris aktif: `ROOT_URLCONF = "kiwi_custom_package.urls"` dan `TEMPLATES[0]["DIRS"].insert(0, ...kiwi_templates)`. |

Semua kode kustomisasi `.py` ada di package `kiwi_custom_package/`. Tanpa file lain, `dashboard_all.html` tidak dipanggil siapa pun.

## Keputusan dan batasan

- Cakupan sengaja **superuser saja**. Perluasan ke role lain (mis. staff/lead per project) belum diputuskan.
- Tidak ada isolasi per project: superuser melihat semuanya.
- `dashboard_all.html` adalah **salinan**. Saat pin submodule `Kiwi` dinaikkan, bandingkan dengan `dashboard.html` upstream (`diff`) dan sinkronkan bila perlu.
- Bila digabung dengan branch `re-ui` (opsi 3, folder `Kaspin`), template ini tidak otomatis mengikuti perubahan dashboard di sana.
- Deploy: `git pull` lalu `sudo systemctl restart kiwi`. Tanpa migrasi atau collectstatic.
