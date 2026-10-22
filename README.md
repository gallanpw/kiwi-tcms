# kiwi-tcms

Setup lokal [Kiwi TCMS](https://github.com/kiwitcms/Kiwi) (test case management system open source) untuk laptop, memakai `uv`, `pnpm`, dan SQLite atau PostgreSQL (dipilih lewat `.env`). Tujuannya mempelajari model data dan alur kerja TCM, serta membandingkannya dengan Zebrunner.

Repo ini **tidak berisi kode Kiwi**. Kode upstream di-clone ke folder `Kiwi/` (di-ignore git). Repo ini hanya menyimpan konfigurasi lokal, skrip bantu, dan dokumentasi.

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

# 1. Kode upstream Kiwi
git clone --depth 1 https://github.com/kiwitcms/Kiwi.git

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
2. Ambil kode baru. Clone awal `--depth 1`, jadi jalankan sekali `git fetch --unshallow --tags` di `Kiwi/`, lalu `git checkout <tag>` atau `git pull`.
3. Lihat perubahan dependency: `git diff <lama> <baru> -- requirements/ tcms/package.json`
4. Ulangi langkah 2 dan 3 pada bagian Setup (install Python, `pnpm install`, webpack). Samakan `overrides` di `config/pnpm-workspace.yaml` dengan `package.json` upstream.
5. `./run.sh migrate`, lalu cek `git diff` pada `tcms/settings/` kalau `kiwi_local_settings.py` bermasalah.

Migrasi tidak bisa di-downgrade dengan aman, jadi backup di langkah 1 adalah satu-satunya jalan mundur.

## Lisensi

Kiwi TCMS berlisensi GPL-2.0 (lihat repo upstream). Repo ini hanya berisi konfigurasi dan skrip bantu.
