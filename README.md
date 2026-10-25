# kiwi-tcms

Setup lokal [Kiwi TCMS](https://github.com/kiwitcms/Kiwi) (test case management system open source) untuk laptop, memakai `pip` (opsional `uv`), `npm` (opsional `pnpm`), dan SQLite atau PostgreSQL (dipilih lewat `.env`). Tujuannya mempelajari model data dan alur kerja TCM, serta membandingkannya dengan Zebrunner.

Repo ini **tidak menyalin kode Kiwi**. Kode upstream ada di folder `Kiwi/` sebagai git submodule yang di-pin ke satu commit (dibutuhkan Vercel untuk mengambil kode yang sama). Repo ini hanya menyimpan konfigurasi, skrip bantu, dan dokumentasi.

## Isi repo

| Path | Fungsi |
|---|---|
| `kiwi_local_settings.py` | Settings Django lokal. Basis `tcms.settings.devel`. Membaca `.env` dan memilih DB (SQLite atau PostgreSQL) lewat `KIWI_DB`. |
| `.env.example` | Contoh `.env`. Salin ke `.env` dan sesuaikan. |
| `.env` | Konfigurasi lokal (pilihan DB dan kredensial). Dibuat sendiri, di-ignore git. |
| `run.sh` | Wrapper `manage.py` (mengatur `PYTHONPATH`, `DJANGO_SETTINGS_MODULE`, memakai `.venv`). |
| `config/pnpm-workspace.yaml` | Konfigurasi pnpm untuk frontend Kiwi. Disalin ke `Kiwi/tcms/` saat setup. |
| `scripts/import_zebrunner_suite.py` | Mengimpor suite dan test case Zebrunner (format JSON) ke Kiwi. |
| `scripts/import_zebrunner_runs.py` | Mengimpor test run Zebrunner beserta hasil eksekusinya ke Kiwi. |
| `.python-version`, `.node-version`, `.nvmrc` | Versi Python (3.14) dan Node (24). |
| `data/` | DB SQLite dan upload. Dibuat otomatis, di-ignore git. Tidak dipakai untuk data PostgreSQL. |
| `vercel.json`, `pyproject.toml`, `manage.py`, `wsgi.py`, `kiwi_vercel_settings.py`, `static_src/`, `deploy/vercel/` | Deploy app ke Vercel dengan PostgreSQL di Neon. Lihat [Deploy ke Vercel + Neon](#deploy-ke-vercel--neon). |

## Prasyarat

- Python 3.14 (satu-satunya versi yang sudah diuji) dengan `pip` bawaan Python (cara utama). Di Debian/Ubuntu pasang dulu `sudo apt install python3.14-venv`, kalau tidak `python3 -m venv` gagal dengan *ensurepip is not available*.
- Opsional: [uv](https://docs.astral.sh/uv/) sebagai alternatif pip (bisa memasang Python sendiri). Tidak wajib.
- Node 24 (lewat [fnm](https://github.com/Schniz/fnm) atau pasang sendiri) dengan `npm` bawaan Node (cara utama)
- Opsional: [pnpm](https://pnpm.io/) 11 sebagai alternatif npm. Tidak wajib.
- Git

## Setup

```bash
git clone https://github.com/gallanpw/kiwi-tcms.git
cd kiwi-tcms

# 1. Kode upstream Kiwi (submodule, commit yang di-pin repo ini)
git submodule update --init --depth 1

# 2. Python: venv dan dependency (tanpa uWSGI, hanya untuk produksi dan butuh compile)
#    Daftar dependency, sama untuk pip dan uv:
grep -v -i uwsgi Kiwi/requirements/base.txt | grep -v '^-r' > /tmp/kiwi-req.txt
grep -v -i uwsgi Kiwi/requirements/tarballs.txt | grep -v '^#' | grep . >> /tmp/kiwi-req.txt

#    Cara utama: pip
python3.14 -m venv .venv
.venv/bin/python -m pip install -r /tmp/kiwi-req.txt
.venv/bin/python -m pip freeze > requirements-freeze.txt   # opsional: catat versi terpasang
#    Opsional, alternatif: uv (tidak wajib)
uv venv --python 3.14 .venv
uv pip install --python .venv/bin/python -r /tmp/kiwi-req.txt
uv pip freeze --python .venv/bin/python > requirements-freeze.txt   # opsional

# 3. Frontend: build bundle JS
#    Cara utama: npm (bawaan Node 24; `fnm use` hanya jika memakai fnm)
fnm use
cd Kiwi/tcms && npm install && npx webpack && cd ../..
#    Opsional, alternatif: pnpm (tidak wajib, butuh config/pnpm-workspace.yaml)
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

### PostgreSQL lokal (podman atau docker)

Perintah `podman` di bagian ini dan di bawahnya bisa diganti `docker` dengan argumen yang sama (misalnya `docker exec postgres-local psql ...`). Container `postgres-local` harus sudah berjalan.

Driver: `.venv/bin/python -m pip install psycopg2-binary`. Opsional dengan uv: `uv pip install --python .venv/bin/python psycopg2-binary`. Lalu buat database dan role di container Postgres:

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

## Deploy ke Vercel + Neon

Vercel menjalankan Kiwi sebagai satu Vercel Function (Python, WSGI) dari source di `Kiwi/`. Database PostgreSQL di Neon.

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
# Cara utama: pip
.venv/bin/python -m pip install "psycopg[binary]==3.3.6"
# Opsional, alternatif: uv
uv pip install --python .venv/bin/python "psycopg[binary]==3.3.6"
set -a; . ./.env.vercel; set +a
.venv/bin/python manage.py migrate
.venv/bin/python manage.py refresh_permissions
.venv/bin/python manage.py createsuperuser
```

Ini memakai settings Vercel yang sama dengan produksi. Jangan salah pakai `./run.sh`, yang membaca `.env` lokal.

Untuk membawa data lokal (user, product, plan, case, run), lewati `createsuperuser` dan muat dump dari PostgreSQL lokal. Database Neon harus baru (hanya `migrate` dan `refresh_permissions`):

```bash
KIWI_DB=postgres ./run.sh dumpdata --natural-foreign --natural-primary \
  --exclude contenttypes --exclude auth.permission --exclude admin.logentry \
  --exclude sessions --indent 1 -o data/pg_dump.json

set -a; . ./.env.vercel; set +a
.venv/bin/python manage.py loaddata data/pg_dump.json
.venv/bin/python manage.py shell -c "
from django.apps import apps
from django.core.management.color import no_style
from django.db import connection
with connection.cursor() as c:
    for sql in connection.ops.sequence_reset_sql(no_style(), apps.get_models()):
        c.execute(sql)
"
```

`data/pg_dump.json` berisi hash password user lokal. Jangan di-commit (folder `data/` sudah di-ignore) dan ganti password `admin` setelah login pertama di Vercel. Jalankan `set_domain` di langkah 4 seperti biasa.

Dump `.sql` dari `pg_dump` juga bisa dimuat dengan `psql`, tetapi hasilnya bergantung pada versi PostgreSQL asal dan tujuan, jadi jalur `loaddata` di atas lebih aman.

### 4. Vercel

1. *Add New → Project*, impor repo GitHub ini. Biarkan *Root Directory* kosong. Submodule `Kiwi` ikut di-clone oleh Vercel.
2. Isi *Environment Variables* dengan lima nilai dari `.env.vercel` (`SECRET_KEY`, `KIWI_DB_HOST`, `KIWI_DB_NAME`, `KIWI_DB_USER`, `KIWI_DB_PASSWORD`). Nilainya dibutuhkan saat build juga, karena `collectstatic` memuat settings.
3. *Deploy*. Bila selesai, buka domain `*.vercel.app` dan login dengan superuser dari langkah 3.
4. Catat domain, lalu set di database: `.venv/bin/python manage.py set_domain <project>.vercel.app` (dengan env dari `.env.vercel` masih termuat).

Catatan:

- Build dan deploy di Vercel berhasil. Database Neon yang masih kosong membuat semua halaman dialihkan ke `/init-db/` sampai `migrate` dijalankan dari laptop (langkah 3). Jangan memakai tombol di halaman itu.
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
ZEBRUNNER_JSON=scripts/zebrunner_kpfree_suite.json \
  ./run.sh shell -c "exec(open('scripts/import_zebrunner_suite.py').read())"
```

Tanpa `ZEBRUNNER_JSON`, yang diimpor adalah `scripts/zebrunner_kpapi_suite.json`. Field `desc`, `post` (Teardown), dan `draft` (status PROPOSED) pada JSON bersifat opsional.

Skrip mengasumsikan user `admin` sudah ada dan memakainya sebagai author semua test case.

### Test run

Skrip `scripts/import_zebrunner_runs.py` mengimpor test run beserta hasil eksekusinya. Impor suite harus dijalankan lebih dulu, karena test case dicari lewat Tag key Zebrunner.

| Zebrunner | Kiwi |
|---|---|
| Test run | Test Run pada Test Plan yang berisi test case-nya (build `unspecified`) |
| Configuration (group, option) | Property pada Test Run (`Environment: Iphone`) |
| Description | Notes, ditambah link ke test run Zebrunner |
| Test case dalam run | Test Execution |
| Result status | Status eksekusi (tabel di bawah) |

| Zebrunner | Kiwi |
|---|---|
| Untested | IDLE |
| Passed | PASSED |
| Failed | FAILED |
| Blocked | BLOCKED |
| Skipped | WAIVED |
| Retest | RETEST (status baru, weight 0) |
| Passed W/Note, Pass With Note, Passed with notes | PASSED WITH NOTE (status baru, weight 15) |

Kiwi menghitung eksekusi berstatus `weight` 0 sebagai belum selesai, positif sebagai sukses, dan negatif sebagai gagal. Karena itu RETEST dibuat dengan weight 0 dan WAIVED (Skipped) ikut terhitung selesai.

User Zebrunner (`productkaspin`) bukan user Kiwi, jadi manager, assignee, dan tested by diisi `admin`. Eksekusi `Untested` tidak punya assignee, sama seperti di Zebrunner. Data diambil lewat MCP Zebrunner dan disimpan di `scripts/zebrunner_runs.json` (di-ignore git):

```json
{
  "base_url": "https://<host>.zebrunner.com",
  "runs": [{
    "product": "KPAPI", "id": 391, "title": "...", "description": "...",
    "created": "2026-10-22T09:29:58Z",
    "configurations": [["Environment", "Iphone"]],
    "items": [["KPAPI-1", "Passed", 1]]
  }]
}
```

Elemen `items` berisi key test case, nama status Zebrunner, dan `1` bila ada assignee. Menjalankan impor (aman diulang; run dan eksekusi yang sudah ada tidak diubah):

```bash
./run.sh shell -c "exec(open('scripts/import_zebrunner_runs.py').read())"
```

Detail hasil (komentar, issue, lampiran, durasi) tidak diimpor.

## Memperbarui Kiwi

1. Backup DB: `cp data/db.sqlite3 data/db.sqlite3.bak-$(date +%F)`
2. Ambil kode baru. Submodule di-clone `--depth 1`, jadi jalankan sekali `git fetch --unshallow --tags` di `Kiwi/`, lalu `git checkout <tag>` atau `git pull`. Setelah itu `git add Kiwi` dan commit untuk memindahkan pin. Ulangi `deploy/vercel/build_static_src.sh` bila memakai Vercel.
3. Lihat perubahan dependency: `git diff <lama> <baru> -- requirements/ tcms/package.json`
4. Ulangi langkah 2 dan 3 pada bagian Setup (install Python, `pnpm install`, webpack). Samakan `overrides` di `config/pnpm-workspace.yaml` dengan `package.json` upstream.
5. `./run.sh migrate`, lalu cek `git diff` pada `tcms/settings/` kalau `kiwi_local_settings.py` bermasalah.

Migrasi tidak bisa di-downgrade dengan aman, jadi backup di langkah 1 adalah satu-satunya jalan mundur.

## Lisensi

Kiwi TCMS berlisensi GPL-2.0 (lihat repo upstream). Repo ini hanya berisi konfigurasi dan skrip bantu.
