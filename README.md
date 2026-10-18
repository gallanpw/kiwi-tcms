# kiwi-tcms

Setup lokal [Kiwi TCMS](https://github.com/kiwitcms/Kiwi) (test case management system open source) untuk laptop, memakai `uv`, `pnpm`, dan SQLite. Tujuannya mempelajari model data dan alur kerja TCM, serta membandingkannya dengan Zebrunner.

Repo ini **tidak berisi kode Kiwi**. Kode upstream di-clone ke folder `Kiwi/` (di-ignore git). Repo ini hanya menyimpan konfigurasi lokal, skrip bantu, dan dokumentasi.

## Isi repo

| Path | Fungsi |
|---|---|
| `kiwi_local_settings.py` | Settings Django lokal. Basis `tcms.settings.devel`, DB SQLite di `data/db.sqlite3`. |
| `run.sh` | Wrapper `manage.py` (mengatur `PYTHONPATH`, `DJANGO_SETTINGS_MODULE`, memakai `.venv`). |
| `config/pnpm-workspace.yaml` | Konfigurasi pnpm untuk frontend Kiwi. Disalin ke `Kiwi/tcms/` saat setup. |
| `scripts/import_zebrunner_suite.py` | Mengimpor suite dan test case Zebrunner (format JSON) ke Kiwi. |
| `.python-version`, `.node-version`, `.nvmrc` | Versi Python (3.14) dan Node (24). |
| `data/` | DB SQLite dan upload. Dibuat otomatis, di-ignore git. |

## Prasyarat

- [uv](https://docs.astral.sh/uv/), Python 3.14 (`uv` bisa memasangnya)
- [fnm](https://github.com/Schniz/fnm) dengan Node 24, dan [pnpm](https://pnpm.io/) 11
- Git

## Setup

```bash
git clone https://github.com/gallanpw/kiwi-tcms.git
cd kiwi-tcms

# 1. Kode upstream Kiwi
git clone --depth 1 https://github.com/kiwitcms/Kiwi.git

# 2. Python: venv dan dependency (tanpa uWSGI, hanya untuk produksi dan butuh compile)
uv venv --python 3.14 .venv
grep -v -i uwsgi Kiwi/requirements/base.txt | grep -v '^-r' > /tmp/kiwi-req.txt
grep -v -i uwsgi Kiwi/requirements/tarballs.txt | grep -v '^#' | grep . >> /tmp/kiwi-req.txt
uv pip install --python .venv/bin/python -r /tmp/kiwi-req.txt

# 3. Frontend: build bundle JS
fnm use
cp config/pnpm-workspace.yaml Kiwi/tcms/
cd Kiwi/tcms && pnpm install && pnpm exec webpack && cd ../..

# 4. Database SQLite dan akun admin
mkdir -p data
./run.sh migrate
./run.sh createsuperuser
```

## Menjalankan

```bash
./run.sh runserver 127.0.0.1:8080
```

Buka <http://127.0.0.1:8080> dan login dengan akun superuser yang dibuat tadi. Tanpa argumen, `./run.sh` menjalankan `runserver` di port 8000. Perintah lain: `./run.sh migrate`, `./run.sh shell`.

Ini setup **development** (`DEBUG=True`), bukan untuk produksi.

## Penyimpanan data

Semua data ada di satu file `data/db.sqlite3`:

- User yang login: tabel `auth_user`
- Test case, plan, dan run: tabel `testcases_*`, `testplans_*`, `testruns_*`
- Riwayat perubahan: tabel `historical*` (django-simple-history)

Backup cukup dengan menyalin file itu.

## Catatan teknis

- **Versi:** Django 6.1.2 (dipin oleh `Kiwi/requirements/base.txt`), Python 3.14.7. `manage.py check` bersih. Ada satu `SyntaxWarning` dari paket `django-vinaigrette` (kode paket itu sendiri, tidak mengganggu).
- **Static storage:** profil `devel` memakai storage khusus test yang butuh `factory_boy`. `kiwi_local_settings.py` menggantinya dengan `StaticFilesStorage` bawaan Django.
- **pnpm vs npm:** Kiwi mengharapkan `node_modules` datar seperti hasil npm. pnpm 11 secara default membuat struktur ketat, sehingga jQuery, Bootstrap, moment, dan datatables hilang (HTTP 404 pada `/static/...`). `config/pnpm-workspace.yaml` memperbaikinya:
  - `nodeLinker: hoisted` untuk `node_modules` datar
  - `autoInstallPeers: true` untuk memasang peer dependency
  - `overrides` untuk versi yang sama dengan `overrides` di `Kiwi/tcms/package.json`, karena pnpm 11 tidak membaca `overrides` dari `package.json`

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
