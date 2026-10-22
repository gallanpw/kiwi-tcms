# kiwi-tcms

Setup lokal [Kiwi TCMS](https://github.com/kiwitcms/Kiwi) (test case management system open source) untuk laptop, memakai `uv`, `pnpm`, dan SQLite atau PostgreSQL (dipilih lewat `.env`). Tujuannya mempelajari model data dan alur kerja TCM, serta membandingkannya dengan Zebrunner.

Repo ini **tidak menyalin kode Kiwi**. Kode upstream ada di folder `Kiwi/` sebagai git submodule yang di-pin ke satu commit (dibutuhkan Vercel dan PythonAnywhere untuk mengambil kode yang sama). Repo ini hanya menyimpan konfigurasi, skrip bantu, dan dokumentasi.

## Isi repo

| Path | Fungsi |
|---|---|
| `kiwi_local_settings.py` | Settings Django lokal. Basis `tcms.settings.devel`. Membaca `.env` dan memilih DB (SQLite atau PostgreSQL) lewat `KIWI_DB`. |
| `.env.example` | Contoh `.env`. Salin ke `.env` dan sesuaikan. |
| `.env` | Konfigurasi lokal (pilihan DB dan kredensial). Dibuat sendiri, di-ignore git. |
| `run.sh` | Wrapper `manage.py` (mengatur `PYTHONPATH`, `DJANGO_SETTINGS_MODULE`, memakai `.venv`). |
| `config/pnpm-workspace.yaml` | Konfigurasi pnpm untuk frontend Kiwi. Disalin ke `Kiwi/tcms/` saat setup. |
| `scripts/import_zebrunner_suite.py` | Mengimpor suite dan test case Zebrunner (format JSON) ke Kiwi. |
| `.python-version`, `.node-version`, `.nvmrc` | Versi Python (3.14) dan Node (24). |
| `data/` | DB SQLite dan upload. Dibuat otomatis, di-ignore git. Tidak dipakai untuk data PostgreSQL. |
| `render.yaml`, `deploy/` | Deploy app ke Render atau Fly.io dengan PostgreSQL di Neon. Lihat [Deploy ke Render + Neon](#deploy-ke-render--neon) dan [Deploy ke Fly.io + Neon](#deploy-ke-flyio--neon). |
| `deploy/pythonanywhere/` | Deploy app ke PythonAnywhere (plan free, SQLite). Lihat [Deploy ke PythonAnywhere](#deploy-ke-pythonanywhere-plan-free). |
| `vercel.json`, `pyproject.toml`, `manage.py`, `wsgi.py`, `kiwi_vercel_settings.py`, `static_src/`, `deploy/vercel/` | Deploy app ke Vercel dengan PostgreSQL di Neon. Lihat [Deploy ke Vercel + Neon](#deploy-ke-vercel--neon). |

## Prasyarat

- Python 3.14 (satu-satunya versi yang sudah diuji) dan salah satu dari:
  - [uv](https://docs.astral.sh/uv/) (bisa memasang Python sendiri), atau
  - `pip` bawaan Python. Di Debian/Ubuntu pasang dulu `sudo apt install python3.14-venv`, kalau tidak `python3 -m venv` gagal dengan *ensurepip is not available*.
- [fnm](https://github.com/Schniz/fnm) dengan Node 24, dan [pnpm](https://pnpm.io/) 11
- Git

## Setup

```bash
git clone https://github.com/gallanpw/kiwi-tcms.git
cd kiwi-tcms

# 1. Kode upstream Kiwi (submodule, commit yang di-pin repo ini)
git submodule update --init --depth 1

# 2. Python: venv dan dependency (tanpa uWSGI, hanya untuk produksi dan butuh compile)
#    Daftar dependency, sama untuk uv dan pip:
grep -v -i uwsgi Kiwi/requirements/base.txt | grep -v '^-r' > /tmp/kiwi-req.txt
grep -v -i uwsgi Kiwi/requirements/tarballs.txt | grep -v '^#' | grep . >> /tmp/kiwi-req.txt

#    Pilih SATU: uv ...
uv venv --python 3.14 .venv
uv pip install --python .venv/bin/python -r /tmp/kiwi-req.txt
#    ... atau pip
python3.14 -m venv .venv
.venv/bin/python -m pip install -r /tmp/kiwi-req.txt

# 3. Frontend: build bundle JS
fnm use
cp config/pnpm-workspace.yaml Kiwi/tcms/
cd Kiwi/tcms && pnpm install && pnpm exec webpack && cd ../..

# 4. Konfigurasi database (lihat bagian "Konfigurasi database")
#    .env.example memilih postgres. Tanpa server dan driver PostgreSQL,
#    ubah baris pertama .env menjadi KIWI_DB=sqlite
cp .env.example .env

# 5. Skema database dan akun admin
mkdir -p data
./run.sh migrate
./run.sh createsuperuser
```

## Konfigurasi database

Pilihan database ada di file `.env` (dibaca oleh `kiwi_local_settings.py`). Salin dari contoh:

```bash
cp .env.example .env
```

Isi `.env`:

```bash
# Pilih satu: sqlite atau postgres
KIWI_DB=postgres
#KIWI_DB=sqlite

# Dipakai saat KIWI_DB=postgres
KIWI_DB_NAME=kiwi
KIWI_DB_USER=kiwi
KIWI_DB_PASSWORD=kiwi
KIWI_DB_HOST=localhost
KIWI_DB_PORT=5432
```

- Ganti database dengan comment atau uncomment baris `KIWI_DB`, lalu jalankan ulang `./run.sh`.
- Tanpa `.env` atau tanpa `KIWI_DB`, defaultnya SQLite (`data/db.sqlite3`).
- Env var shell menang atas `.env`, misalnya `KIWI_DB=sqlite ./run.sh runserver`.
- Nilai `KIWI_DB` selain `sqlite` atau `postgres` menghasilkan `ValueError`.
- `.env` berisi password dan di-ignore git. Hanya `.env.example` yang di-commit.

### PostgreSQL lokal (podman)

Driver: `uv pip install --python .venv/bin/python psycopg2-binary`, atau dengan pip: `.venv/bin/python -m pip install psycopg2-binary`. Lalu buat database dan role di container Postgres:

```bash
podman exec postgres-local psql -U postgres \
  -c "CREATE DATABASE kiwi;" \
  -c "CREATE ROLE kiwi LOGIN PASSWORD 'kiwi';" \
  -c "ALTER DATABASE kiwi OWNER TO kiwi;"
KIWI_DB=postgres ./run.sh migrate
```

### Memindahkan data SQLite ke PostgreSQL

```bash
# 1. Dump dari SQLite
KIWI_DB=sqlite ./run.sh dumpdata --natural-foreign --natural-primary \
  --exclude contenttypes --exclude auth.permission --exclude admin.logentry \
  --exclude sessions --indent 1 -o data/sqlite_dump.json

# 2. Buat skema dan muat data ke PostgreSQL
KIWI_DB=postgres ./run.sh migrate
KIWI_DB=postgres ./run.sh loaddata data/sqlite_dump.json
```

Jalankan pada database PostgreSQL yang masih kosong. Bila `loaddata` memakai ID eksplisit, reset sequence supaya insert berikutnya tidak bentrok:

```bash
KIWI_DB=postgres ./run.sh sqlsequencereset auth management testcases testplans testruns \
  | podman exec -i postgres-local psql -U kiwi -d kiwi
```

## Menjalankan

```bash
./run.sh runserver 127.0.0.1:8080
```

Buka <http://127.0.0.1:8080> dan login dengan akun superuser yang dibuat tadi. Tanpa argumen, `./run.sh` menjalankan `runserver` di port 8000. Perintah lain: `./run.sh migrate`, `./run.sh shell`.

Selalu jalankan lewat `./run.sh`, bukan `python Kiwi/manage.py` langsung. Skrip itu memakai `.venv/bin/python` (tidak perlu `source .venv/bin/activate`, dan tidak perlu `uv`) serta mengatur `PYTHONPATH` dan `DJANGO_SETTINGS_MODULE`. Tanpa itu Django memakai settings upstream (MariaDB) dan gagal konek. `run.sh` butuh bash, jadi di Windows pakai WSL.

Ini setup **development** (`DEBUG=True`), bukan untuk produksi.

## Penyimpanan data

Dengan SQLite, semua data ada di satu file `data/db.sqlite3`. Dengan PostgreSQL, tabel yang sama ada di database `kiwi`:

- User yang login: tabel `auth_user`
- Test case, plan, dan run: tabel `testcases_*`, `testplans_*`, `testruns_*`
- Riwayat perubahan: tabel `historical*` (django-simple-history)

Backup SQLite cukup dengan menyalin file itu. Untuk PostgreSQL pakai `podman exec postgres-local pg_dump -U kiwi kiwi > kiwi.sql`.

## Catatan teknis

- **Versi:** Django 6.1.2 (dipin oleh `Kiwi/requirements/base.txt`), Python 3.14.7. `manage.py check` bersih. Ada satu `SyntaxWarning` dari paket `django-vinaigrette` (kode paket itu sendiri, tidak mengganggu).
- **Static storage:** profil `devel` memakai storage khusus test yang butuh `factory_boy`. `kiwi_local_settings.py` menggantinya dengan `StaticFilesStorage` bawaan Django.
- **pnpm vs npm:** Kiwi mengharapkan `node_modules` datar seperti hasil npm. pnpm 11 secara default membuat struktur ketat, sehingga jQuery, Bootstrap, moment, dan datatables hilang (HTTP 404 pada `/static/...`). `config/pnpm-workspace.yaml` memperbaikinya:
  - `nodeLinker: hoisted` untuk `node_modules` datar
  - `autoInstallPeers: true` untuk memasang peer dependency
  - `overrides` untuk versi yang sama dengan `overrides` di `Kiwi/tcms/package.json`, karena pnpm 11 tidak membaca `overrides` dari `package.json`

## Deploy ke Render + Neon

App jalan di Render dari image resmi `kiwitcms/kiwi` (bukan dari folder `Kiwi/`). Database PostgreSQL di Neon.

File di `deploy/` menyesuaikan image untuk Render. Render menghentikan TLS dan meneruskan HTTP biasa, sedangkan image asli hanya melayani HTTPS di 8443 dan hanya me-redirect di 8080 (redirect loop di Render).

| File | Fungsi |
|---|---|
| `nginx.conf` | Melayani HTTP di 8080, plus `/healthz` yang dijawab nginx tanpa menyentuh DB (supaya Neon bisa tidur). |
| `tcms_settings_dir/50-render.py` | `SECRET_KEY` dari env (key upstream publik) dan `SECURE_PROXY_SSL_HEADER` agar redirect HTTPS Django tidak loop. |
| `uwsgi.override` | 2 worker. Default upstream satu worker per core host, bisa melebihi RAM 512 MB. |
| `start.sh` | `migrate`, `refresh_permissions`, buat admin dari env, set domain (dari `RENDER_EXTERNAL_HOSTNAME` atau `FLY_APP_NAME`), lalu jalankan `/httpd-foreground`. |
| `fly.toml` | Konfigurasi Fly.io. Tidak dipakai Render. |

Langkah:

1. **Neon:** buat project di region `aws-ap-southeast-1` (Singapore). Di dialog *Connect*, **matikan** *Connection pooling* agar host tanpa `-pooler`. Migrasi Django tidak cocok dengan pooler.
2. **Render:** *New → Blueprint*, pilih repo ini. Isi variabel `sync: false` dari `render.yaml`:
   - `KIWI_DB_HOST`, `KIWI_DB_NAME`, `KIWI_DB_USER`, `KIWI_DB_PASSWORD`: dari connection string Neon
   - `DJANGO_SUPERUSER_USERNAME`, `DJANGO_SUPERUSER_EMAIL`, `DJANGO_SUPERUSER_PASSWORD`: admin pertama
3. Setelah deploy pertama berhasil dan login jalan, hapus `DJANGO_SUPERUSER_PASSWORD` dari env Render.

Catatan:

- Image di-pull dengan tag `latest` (Docker Hub hanya menyediakan tag itu). Untuk build yang bisa diulang, ganti `KIWI_IMAGE` di `deploy/Dockerfile` dengan digest `kiwitcms/kiwi@sha256:...`.
- `nginx.conf` adalah salinan upstream 16.6 yang diubah. Cek ulang diff-nya saat memperbarui image.
- Plan `free`: tidur setelah 15 menit idle dan tidak ada disk, jadi file upload (attachment) hilang tiap redeploy. Untuk upload permanen, pakai plan berbayar dengan disk di `/Kiwi/uploads`.
- Rate limit nginx untuk `/accounts/` memakai IP klien. Di belakang proxy Render, semua klien tampak berasal dari IP proxy, jadi batas 10 req/detik berlaku bersama.
- Neon free tier tidur setelah 5 menit tanpa koneksi. Request pertama sesudahnya lebih lambat sekitar satu detik.

## Deploy ke Fly.io + Neon

Memakai `Dockerfile` dan file `deploy/` yang sama dengan Render. Konfigurasi Fly ada di `deploy/fly.toml` (region `sin`, RAM 512 MB, machine mati otomatis saat idle).

1. Pasang flyctl dan login:

   ```bash
   curl -L https://fly.io/install.sh | sh
   fly auth login
   ```

2. Fly tidak punya free tier untuk akun baru. Kartu prepaid/virtual sering ditolak sebagai metode tersimpan, tetapi biasanya bisa dipakai untuk membeli credits di *Dashboard → Billing → Buy Credits*.
3. Buat app. Nama harus unik di seluruh Fly, dan harus sama dengan `app` di `deploy/fly.toml`:

   ```bash
   cd deploy
   fly apps create kiwi-tcms-gallanpw
   ```

4. Isi secret. Perintah ini membaca `NAME=value` dari stdin, jadi password tidak masuk history shell. Tempel baris-barisnya, lalu tekan Ctrl-D:

   ```bash
   fly secrets import
   ```

   ```
   SECRET_KEY=<string acak, python3 -c "import secrets; print(secrets.token_urlsafe(50))">
   KIWI_DB_HOST=<host Neon, tanpa -pooler>
   KIWI_DB_NAME=<database Neon>
   KIWI_DB_USER=<user Neon>
   KIWI_DB_PASSWORD=<password Neon>
   DJANGO_SUPERUSER_USERNAME=<admin>
   DJANGO_SUPERUSER_EMAIL=<email valid>
   DJANGO_SUPERUSER_PASSWORD=<password admin>
   ```

5. Deploy dari folder `deploy/`. `--ha=false` wajib supaya hanya satu machine yang jalan. Dua machine akan menjalankan `migrate` bersamaan pada DB yang sama.

   ```bash
   fly deploy --ha=false
   fly logs
   ```

6. Buka `https://kiwi-tcms-gallanpw.fly.dev` dan login. Lalu hapus password admin dari secret: `fly secrets unset DJANGO_SUPERUSER_PASSWORD`.

Catatan:

- Setiap kali machine bangun dari mati, `start.sh` menjalankan `migrate` lagi. Itu cepat bila skema sudah mutakhir, tetapi request pertama sesudah idle tetap lambat.
- Upload (attachment) hilang saat machine dibuat ulang. Untuk upload permanen, buat volume (`fly volumes create`) dan mount ke `/Kiwi/uploads`.

## Deploy ke PythonAnywhere (plan free)

Berbeda dari Render dan Fly.io, PythonAnywhere tidak memakai Docker. Kode Kiwi dijalankan langsung dari `Kiwi/` dengan Python 3.12 atau 3.13 (Django 6.1 butuh minimal 3.12), database SQLite.

Kenapa SQLite: plan free membatasi koneksi keluar ke daftar situs tertentu (Neon tidak bisa dipakai) dan tidak punya PostgreSQL. MySQL bawaan PythonAnywhere kemungkinan terlalu lama untuk Django 6.1 (minimal MariaDB 10.11 atau MySQL 8.4). Dengan plan berbayar, `kiwi_pa_settings.py` bisa diganti ke Neon.

| File | Fungsi |
|---|---|
| `deploy/pythonanywhere/kiwi_pa_settings.py` | Settings profil `product`. Membaca `.env`, memakai SQLite di `data/`, `ALLOWED_HOSTS` dan `CSRF_TRUSTED_ORIGINS` dari `KIWI_HOSTNAME`. |
| `deploy/pythonanywhere/wsgi.py` | Isi file WSGI di tab Web. Ganti `USERNAME`. |
| `deploy/pythonanywhere/env.example` | Contoh `.env` di server (`SECRET_KEY`, `KIWI_HOSTNAME`). |
| `deploy/pythonanywhere/build_static.sh` | Jalan di laptop. Mengumpulkan file static (hanya paket npm runtime) ke `data/kiwi-static.tar.gz`. |
| `deploy/pythonanywhere/manage.sh` | Wrapper `manage.py` untuk Bash console PythonAnywhere. |

Static dibangun di laptop karena bundle JS butuh Node dan pnpm. Paket `kiwitcms` di PyPI berhenti di versi 12.4, jadi tidak bisa dipakai.

Di bawah, ganti `USERNAME` dengan username PythonAnywhere.

### 1. Di laptop

```bash
# bundle JS sudah dibangun (Setup, langkah 3)
deploy/pythonanywhere/build_static.sh     # hasil: data/kiwi-static.tar.gz (sekitar 30 MB)
git push                                  # settings PythonAnywhere dan submodule Kiwi harus sudah ada di GitHub
```

### 2. Bash console PythonAnywhere

Buka *Consoles → Bash*. Cek dulu versi Python dan SQLite. Django 6.1 butuh SQLite 3.37 atau lebih baru:

```bash
python3.12 -c "import sqlite3; print(sqlite3.sqlite_version)"
```

Lalu:

```bash
cd ~
git clone https://github.com/gallanpw/kiwi-tcms.git
cd kiwi-tcms

# Kiwi: commit yang di-pin submodule, sama dengan bundle JS dari laptop
git submodule update --init --depth 1

# venv dan dependency (tanpa uWSGI). --no-cache-dir hemat kuota disk 512 MB.
python3.12 -m venv .venv
grep -v -i uwsgi Kiwi/requirements/base.txt | grep -v '^-r' > ~/kiwi-req.txt
grep -v -i uwsgi Kiwi/requirements/tarballs.txt | grep -v '^#' | grep . >> ~/kiwi-req.txt
.venv/bin/python -m pip install --no-cache-dir -r ~/kiwi-req.txt
rm ~/kiwi-req.txt

# konfigurasi
cp deploy/pythonanywhere/env.example .env
python3 -c "import secrets; print(secrets.token_urlsafe(50))"   # salin ke SECRET_KEY
nano .env                                                        # isi SECRET_KEY dan USERNAME
mkdir -p data
```

### 3. Upload static

Tab *Files*, buka `/home/USERNAME/kiwi-tcms/data/`, klik *Upload a file*, pilih `data/kiwi-static.tar.gz`. Lalu di Bash console:

```bash
tar -C data -xzf data/kiwi-static.tar.gz && rm data/kiwi-static.tar.gz
```

### 4. Database dan admin

```bash
deploy/pythonanywhere/manage.sh migrate
deploy/pythonanywhere/manage.sh refresh_permissions
deploy/pythonanywhere/manage.sh set_domain USERNAME.pythonanywhere.com
deploy/pythonanywhere/manage.sh createsuperuser
```

Untuk membawa data dari laptop, upload `data/db.sqlite3` ke `/home/USERNAME/kiwi-tcms/data/` (dari SQLite lokal, bukan PostgreSQL), lalu cukup jalankan `migrate` dan `set_domain`.

### 5. Web app

Tab *Web → Add a new web app → Manual configuration*, pilih Python yang sama dengan venv (3.12). Lalu isi:

| Kolom | Nilai |
|---|---|
| Source code | `/home/USERNAME/kiwi-tcms` |
| Virtualenv | `/home/USERNAME/kiwi-tcms/.venv` |
| WSGI configuration file | ganti seluruh isinya dengan `deploy/pythonanywhere/wsgi.py`, `USERNAME` diganti |
| Static files | URL `/static/`, Directory `/home/USERNAME/kiwi-tcms/data/static` |
| Force HTTPS | Enabled |

Klik *Reload*, lalu buka `https://USERNAME.pythonanywhere.com` dan login. Bila error, baca *Error log* di tab Web.

Catatan:

- Plan free: web app mati bila tidak diperpanjang. Klik *Run until 3 months from today* di tab Web sebelum kedaluwarsa.
- Kuota disk 512 MB. Pemakaian: venv sekitar 110 MB, static sekitar 100 MB, source Kiwi sekitar 30 MB.
- Plan free membatasi koneksi keluar ke daftar situs tertentu. Integrasi issue tracker (Jira, GitHub, Bugzilla, dan lain-lain) hanya jalan ke situs di daftar itu.
- Download attachment belum teruji. Kiwi di luar `DEBUG` mengirim header `X-Accel-Redirect` ke lokasi `/ngx-uploads/` milik nginx upstream, dan PythonAnywhere tidak punya lokasi itu.
- `kiwi_pa_settings.py` mematikan `SECURE_SSL_REDIRECT` (redirect HTTPS dikerjakan *Force HTTPS*) dan mengisi `SECURE_PROXY_SSL_HEADER` dengan `X-Forwarded-Proto`. Apakah PythonAnywhere mengirim header itu belum diverifikasi. Bila tidak, `CSRF_TRUSTED_ORIGINS` tetap membuat login jalan, tetapi URL absolut yang dibuat Django bisa berskema `http`.
- `KIWI_REGISTRATION_ENABLED=False` di `.env` menutup pendaftaran publik. Defaultnya terbuka (dengan CAPTCHA).
- Backup: unduh `data/db.sqlite3` dari tab *Files*.

Memperbarui: `git pull && git submodule update --init --depth 1` di `~/kiwi-tcms`, ulangi langkah 1 dan 3 bila versi Kiwi atau bundle berubah (`pip install` ulang bila dependency berubah), jalankan `manage.sh migrate`, lalu *Reload*.

## Deploy ke Vercel + Neon

Vercel menjalankan Kiwi sebagai satu Vercel Function (Python, WSGI) dari source di `Kiwi/`. Database PostgreSQL di Neon. Tidak ada Docker, nginx, atau uWSGI.

| File | Fungsi |
|---|---|
| `pyproject.toml` | Dependency (disalin dari `Kiwi/requirements/base.txt` dan `tarballs.txt`, tanpa uWSGI, plus `psycopg`) dan `tool.vercel.entrypoint`. Samakan isinya bila memperbarui Kiwi. |
| `wsgi.py` | Entrypoint function. |
| `manage.py` | Dibaca Vercel untuk menemukan `DJANGO_SETTINGS_MODULE`. Di laptop dipakai untuk migrasi ke Neon. |
| `kiwi_vercel_settings.py` | Settings profil `product`. `SECRET_KEY` dari env, PostgreSQL dari `KIWI_DB_*`, `SECURE_PROXY_SSL_HEADER`, dan static dari `static_src/`. |
| `static_src/` | Frontend hasil build (bundle webpack dan paket npm runtime, sekitar 90 MB). Vercel tidak punya Node build dari repo ini, jadi `collectstatic` saat build membaca folder ini dan menyajikannya dari CDN. |
| `deploy/vercel/build_static_src.sh` | Membangun `static_src/` di laptop. |
| `vercel.json` | Region `sin1` (dekat Neon Singapore), `excludeFiles` supaya `static_src/` tidak masuk bundle function, dan rewrite `/favicon.ico` dan `/robots.txt`. |
| `.vercelignore` | Dipakai bila deploy lewat `vercel deploy` (CLI). |

### 1. Di laptop

```bash
# bundle JS sudah dibangun (Setup, langkah 3)
deploy/vercel/build_static_src.sh
git add Kiwi static_src
git commit -m "feat: setup for Vercel"
git push
```

### 2. Neon

Buat project di region `aws-ap-southeast-1` (Singapore). Di dialog *Connect*, **matikan** *Connection pooling* agar host tanpa `-pooler`. Pooler (PgBouncer) butuh penyesuaian Django yang belum dikerjakan di sini.

### 3. Migrasi dari laptop

Buat `.env.vercel` (di-ignore git) dari connection string Neon:

```bash
SECRET_KEY=<python3 -c "import secrets; print(secrets.token_urlsafe(50))">
KIWI_DB_HOST=<host Neon, tanpa -pooler>
KIWI_DB_NAME=<database Neon>
KIWI_DB_USER=<user Neon>
KIWI_DB_PASSWORD=<password Neon>
```

Pasang driver di venv lokal, muat env, lalu migrasi:

```bash
uv pip install --python .venv/bin/python "psycopg[binary]==3.3.6"
set -a; . ./.env.vercel; set +a
.venv/bin/python manage.py migrate
.venv/bin/python manage.py refresh_permissions
.venv/bin/python manage.py createsuperuser
```

Ini memakai settings Vercel yang sama dengan produksi. Jangan salah pakai `./run.sh`, yang membaca `.env` lokal.

### 4. Vercel

1. *Add New → Project*, impor repo GitHub ini. Biarkan *Root Directory* kosong. Submodule `Kiwi` ikut di-clone oleh Vercel.
2. Isi *Environment Variables* dengan lima nilai dari `.env.vercel` (`SECRET_KEY`, `KIWI_DB_HOST`, `KIWI_DB_NAME`, `KIWI_DB_USER`, `KIWI_DB_PASSWORD`). Nilainya dibutuhkan saat build juga, karena `collectstatic` memuat settings.
3. *Deploy*. Bila selesai, buka domain `*.vercel.app` dan login dengan superuser dari langkah 3.
4. Catat domain, lalu set di database: `.venv/bin/python manage.py set_domain <project>.vercel.app` (dengan env dari `.env.vercel` masih termuat).

Catatan:

- Belum diuji di Vercel. Yang sudah diuji lokal: `collectstatic`, `migrate`, `createsuperuser`, dan alur login (CSRF aktif) lewat `wsgi.py` pada PostgreSQL.
- Bila `/static/...` 404 setelah deploy, pindahkan isi `static_src/` ke `public/static/` dan hapus `STATICFILES_DIRS` dari settings. Vercel menyajikan `public/` dari CDN.
- Attachment tidak berfungsi: filesystem function read-only (hanya `/tmp`, sementara) dan body request dibatasi 4,5 MB.
- Plan Hobby hanya untuk pemakaian non-komersial. Neon free tidur setelah 5 menit idle, jadi request pertama lebih lambat, ditambah cold start function.
- Koneksi database dibuka per request (`CONN_MAX_AGE` default 0). Cukup untuk beban kecil.
- Memperbarui Kiwi: pindahkan pin submodule, sesuaikan `pyproject.toml` dengan `Kiwi/requirements/`, jalankan ulang `deploy/vercel/build_static_src.sh`, commit, push, lalu `manage.py migrate`.

## Impor data dari Zebrunner

Skrip `scripts/import_zebrunner_suite.py` memetakan struktur Zebrunner ke Kiwi:

| Zebrunner | Kiwi |
|---|---|
| Project | Product (+ Version `unspecified`) |
| Suite (bersarang) | Test Plan, bersarang lewat `parent` |
| Nama suite | Category |
| Key (`KPAPI-1`) | Tag |
| Preconditions | Bagian `**Setup**` pada teks test case |
| Steps (action, expected) | `**Actions**` dan `**Expected results**` bernomor |
| Priority High / Medium / Low / Trivial | P1 / P3 / P4 / P5 |

Data diambil lewat MCP Zebrunner dan disimpan sebagai `scripts/zebrunner_<project>_suite.json`. File itu berisi data internal, sehingga **di-ignore git**. Format JSON-nya:

```json
{
  "product": "KPAPI",
  "suites": [{"id": 1454, "parent": null, "title": "Transaksi Penjualan"}],
  "cases": [{
    "key": "KPAPI-1", "suite": 1455, "priority": "Medium",
    "title": "...", "pre": "...",
    "steps": [["action", "expected result"]]
  }]
}
```

Menjalankan impor (aman diulang karena memakai `get_or_create`):

```bash
./run.sh shell -c "exec(open('scripts/import_zebrunner_suite.py').read())"
```

Skrip mengasumsikan user `admin` sudah ada dan memakainya sebagai author semua test case.

## Memperbarui Kiwi

1. Backup DB: `cp data/db.sqlite3 data/db.sqlite3.bak-$(date +%F)`
2. Ambil kode baru. Submodule di-clone `--depth 1`, jadi jalankan sekali `git fetch --unshallow --tags` di `Kiwi/`, lalu `git checkout <tag>` atau `git pull`. Setelah itu `git add Kiwi` dan commit untuk memindahkan pin. Ulangi `deploy/vercel/build_static_src.sh` bila memakai Vercel.
3. Lihat perubahan dependency: `git diff <lama> <baru> -- requirements/ tcms/package.json`
4. Ulangi langkah 2 dan 3 pada bagian Setup (install Python, `pnpm install`, webpack). Samakan `overrides` di `config/pnpm-workspace.yaml` dengan `package.json` upstream.
5. `./run.sh migrate`, lalu cek `git diff` pada `tcms/settings/` kalau `kiwi_local_settings.py` bermasalah.

Migrasi tidak bisa di-downgrade dengan aman, jadi backup di langkah 1 adalah satu-satunya jalan mundur.

## Lisensi

Kiwi TCMS berlisensi GPL-2.0 (lihat repo upstream). Repo ini hanya berisi konfigurasi dan skrip bantu.
