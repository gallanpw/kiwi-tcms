# kaspin kiwi (MCP)

Salin test case dari **Zebrunner** (URL suite atau URL satu test case) ke **Kiwi TCMS**, atau upload file `.csv` / `.xlsx` / `.json`, lewat AI (Claude, Codex, Copilot, Gemini).

Cara kerja: server MCP ini di-hosting di server Kiwi (`https://<domain-kiwi>/mcp`). QA tidak memasang apa pun, cukup menempel config di AI-nya, mirip MCP Zebrunner. Kredensial tiap QA dikirim lewat header, jadi **author case = QA tersebut** dan izin Kiwi tetap berlaku. Cakupan saat ini: **test case** (test run menyusul).

## Tool

| Tool | Fungsi |
|---|---|
| `check_connection(zebrunner_url?)` | Cek login Kiwi dan akses Zebrunner. Jalankan ini pertama kali. |
| `import_from_zebrunner(url, dry_run=true)` | URL suite (`?suiteId=`): case dari suite itu dan semua child-nya; suite induknya hanya dibuat sebagai plan kosong (case milik induk tidak ikut, tempel URL induknya untuk itu). URL case (`?caseId=`): satu case + plan kosong untuk rantai suite induknya. |
| `get_file_format()` | Format kolom CSV/XLSX/JSON, supaya AI bisa memetakan spreadsheet apa pun. |
| `import_cases(cases, product, dry_run=true)` | Import data langsung (maks 100 case per panggilan; file lebih besar dikirim bertahap). |
| `import_csv_text(csv_text, product, dry_run=true)` | Import isi CSV (maks 100 case). |
| `get_import_status(job_id)` | Progres import besar. |
| `search_test_case(product, query?, category?, key?, status?, limit=20)` | Cari case yang sudah ada di Kiwi; hanya membaca, maks 100 hasil. |
| `create_test_case(product, cases, dry_run=true)` | Buat case baru di Kiwi (maks 100); pratinjau dulu, draft (PROPOSED) secara default, key opsional. Product harus sudah ada; tool ini tidak membuat Product. |
| `create_test_case_csv(product, csv_text, dry_run=true)` | Buat case baru dari tabel CSV/Excel/Google Sheets yang dibaca AI dan dikirim sebagai teks (maks 100 case, 1.000.000 karakter). |
| `get_create_format()` | Format tabel tetap untuk case baru; baca sebelum memakai `create_test_case_csv`. Hanya membaca. |

Aturan main:
- `dry_run=true` adalah default: hanya melaporkan apa yang akan dibuat. Tulis ke Kiwi dengan `dry_run=false` setelah laporan dicek.
- Aman diulang: case yang sudah ada dilewati (dikenali dari tag key, mis. `KPWEB2-12`).
- Lebih dari 30 case berjalan sebagai job latar belakang; AI memantau lewat `get_import_status`. Batas 1.000 case per import.
- Suite Zebrunner dipetakan: project -> Product, suite -> Test Plan (bertingkat), judul suite -> Category, key -> Tag, draft -> status PROPOSED.

## Pasang di AI

Ganti `<domain-kiwi>` dan isi kredensial **kamu sendiri** (pakai akun Kiwi biasa, bukan `admin`; API key Zebrunner milik sendiri, username-nya sama dengan config MCP Zebrunner kamu).

Header yang dikirim:

| Header | Isi |
|---|---|
| `X-Kiwi-Username`, `X-Kiwi-Password` | akun Kiwi kamu |
| `X-Zebrunner-Username`, `X-Zebrunner-Api-Token` | sama seperti di config MCP Zebrunner |

### Claude Code (terminal)

```bash
claude mcp add --transport http -s user kaspin-kiwi https://<domain-kiwi>/mcp \
  --header "X-Kiwi-Username: <user>" --header "X-Kiwi-Password: <password>" \
  --header "X-Zebrunner-Username: <user zebrunner>" --header "X-Zebrunner-Api-Token: <token>"
```

### Claude Desktop (butuh Node.js, sama seperti config Zebrunner)

> **Jangan memakai format `"type": "http"` di sini.** Itu format Claude Code. `claude_desktop_config.json` tidak mendukung entri HTTP langsung, sehingga entrinya diam-diam diabaikan dan server tidak muncul. Claude Desktop harus lewat jembatan `mcp-remote`.

Salin nilai `command` dari entri `zebrunner` kamu yang sudah berjalan (supaya path `npx` ikut benar), lalu:

```json
"kaspin-kiwi": {
  "command": "<sama dengan command di entri zebrunner>",
  "args": [
    "-y", "mcp-remote@latest", "https://<domain-kiwi>/mcp",
    "--header", "X-Kiwi-Username:${KIWI_USERNAME}",
    "--header", "X-Kiwi-Password:${KIWI_PASSWORD}",
    "--header", "X-Zebrunner-Username:${ZEBRUNNER_USERNAME}",
    "--header", "X-Zebrunner-Api-Token:${ZEBRUNNER_API_TOKEN}"
  ],
  "env": {
    "KIWI_USERNAME": "<user>", "KIWI_PASSWORD": "<password>",
    "ZEBRUNNER_USERNAME": "<user zebrunner>", "ZEBRUNNER_API_TOKEN": "<token>"
  }
}
```

Bentuk `${...}` menjaga password tidak tampil di daftar proses. Kalau gagal, tulis nilainya langsung di `args` seperti entri Zebrunner (`X-Kiwi-Password:isinya`).

Setelah menyimpan: pastikan JSON valid (`python3 -c "import json,sys; json.load(open(sys.argv[1])); print('JSON valid')" "$HOME/Library/Application Support/Claude/claude_desktop_config.json"`), lalu **tutup total dengan Cmd+Q** dan buka lagi. Kalau tidak muncul, log ada di `~/Library/Logs/Claude/mcp-server-kaspin-kiwi.log` (hapus password/token sebelum membagikannya).

Claude Pro/Team juga bisa lewat Settings -> Connectors -> Custom Connector, mengisi URL dan keempat header.

### Codex CLI dan ChatGPT desktop (`~/.codex/config.toml`)

ChatGPT desktop memakai file yang sama dengan Codex CLI, jadi satu config cukup untuk keduanya. Server dipanggil dari laptop.

```toml
[mcp_servers.kaspin-kiwi]
url = "https://<domain-kiwi>/mcp"
tool_timeout_sec = 120
http_headers = { X-Kiwi-Username = "<user>", X-Kiwi-Password = "<password>", X-Zebrunner-Username = "<user zebrunner>", X-Zebrunner-Api-Token = "<token>" }

# Tool baca boleh langsung disetujui. Tool impor, create_test_case, create_test_case_csv tetap perlu persetujuan manual:
# layar persetujuan menampilkan dry_run, jadi penulisan ke Kiwi tidak terjadi tanpa sepengetahuanmu.
[mcp_servers.kaspin-kiwi.tools.check_connection]
approval_mode = "approve"
[mcp_servers.kaspin-kiwi.tools.search_test_case]
approval_mode = "approve"
[mcp_servers.kaspin-kiwi.tools.get_import_status]
approval_mode = "approve"
[mcp_servers.kaspin-kiwi.tools.get_file_format]
approval_mode = "approve"
[mcp_servers.kaspin-kiwi.tools.get_create_format]
approval_mode = "approve"
```

`http_headers` menyimpan password dan token sebagai teks biasa, jadi batasi aksesnya: `chmod 600 ~/.codex/config.toml`. Aplikasi desktop macOS tidak membaca variabel lingkungan dari shell, sehingga `env_http_headers` (nilai header dari variabel lingkungan) hanya praktis untuk Codex CLI yang dijalankan dari terminal.

### GitHub Copilot (VS Code, `.vscode/mcp.json`) dan Gemini CLI

Belum diuji; format di bawah mengikuti dokumentasi umum masing-masing dan **perlu dicek**:

```json
{ "servers": { "kaspin-kiwi": { "type": "http", "url": "https://<domain-kiwi>/mcp",
    "headers": { "X-Kiwi-Username": "<user>", "X-Kiwi-Password": "<password>",
                 "X-Zebrunner-Username": "<user zebrunner>", "X-Zebrunner-Api-Token": "<token>" } } } }
```

Gemini CLI (`~/.gemini/settings.json`): kunci `mcpServers.kaspin-kiwi` dengan `httpUrl` dan `headers` yang sama.

### ChatGPT desktop

Lihat bagian Codex di atas: ChatGPT desktop dipasang lewat `~/.codex/config.toml` yang sama. Pratinjau impor terbukti berjalan dengan hasil identik dengan klien lain; penulisan (`dry_run=false`) lewat ChatGPT desktop belum diuji.

## Contoh prompt

**Sebut nama MCP-nya dan "Kiwi".** Kalau hanya menulis "dry run", sebagian AI mengira itu uji coba menjalankan test case dan memakai MCP Zebrunner (bahkan menawarkan membuat test run). Di sini "dry run" berarti pratinjau impor tanpa menulis.

> Pakai MCP kaspin-kiwi: pratinjau impor (dry run, tanpa menulis) test case dari https://<workspace>.zebrunner.com/projects/KPWEB2/test-cases?suiteId=1616 ke Kiwi.

> Pakai kaspin-kiwi: impor test case ini ke Kiwi: https://<workspace>.zebrunner.com/projects/KPPOS/test-cases?caseId=898 (pratinjau dulu)

> Pakai kaspin-kiwi: impor file test-cases.csv yang saya lampirkan ke product KPWEB2 (pratinjau dulu)

> Pakai kaspin-kiwi: buat test case login dari requirement ini di product KPWEB2 di Kiwi. Cari case yang sudah ada dulu, lalu tampilkan preview sebelum menulis; buat sebagai draft.

Untuk case baru, key boleh kosong; judul yang sudah ada di suite/plan yang sama (sesuai `suite_path`) dilewati. Isi `draft: false` hanya bila case siap menjadi CONFIRMED.

Cek laporan pratinjau (jumlah plan dan case, peringatan bila product akan dibuat), lalu minta AI melanjutkan dengan `dry_run=false`.

File yang dilampirkan di chat dibaca AI lalu dikirim sebagai data (`import_cases` / `import_csv_text`, maks 100 case per panggilan). File yang lebih besar dikirim bertahap; aman karena case yang sudah ada dilewati. Setelah batch terakhir, cocokkan jumlah dibuat + dilewati dengan jumlah baris file. Untuk file sangat besar, data yang melewati AI memakan banyak token dan bisa tersalin kurang tepat; gunakan mode lokal (`import_file`) atau, bila perlu, link upload (opsional, di bawah).

### Link upload (opsional, default mati, khusus backup/impor)

Server dapat menyediakan link upload sekali pakai (15 menit, maks 5 MB) untuk file besar, tanpa melewati AI. Fitur ini menambah satu URL publik, jadi **tidak aktif** kecuali `MCP_ENABLE_UPLOAD=1` di `mcp.env` server. Bila aktif, tersedia tool `create_upload_link()` dan `import_uploaded_file(upload_id, product, dry_run=true)`.

## Membuat test case baru dari file (CSV / Excel / Google Sheets)

Pakai [template CSV](examples/create-template.csv) atau [template Excel](examples/create-template.xlsx).
AI membaca lampiran/tab, lalu mengirim teks tabel melalui `create_test_case_csv`; **server tidak menerima file atau membuka link** pada jalur kreasi ini. Product Kiwi harus sudah ada. Panggil `get_create_format` dahulu; `get_file_format` khusus backup/impor.

| Kolom | Aturan |
|---|---|
| `suite_path` | Wajib di header dan baris pertama case; level dipisah ` > `. |
| `title` | Wajib di header; judul terisi memulai case baru. |
| `priority` | Opsional: High, Medium, Low, Trivial, Not set; kosong = Not set. |
| `draft` | Opsional: yes/no, true/false, y/n, 1/0; kosong = yes (PROPOSED), no = CONFIRMED. |
| `description` | Opsional: deskripsi. |
| `preconditions` | Opsional: kondisi awal. |
| `postconditions` | Opsional: kondisi akhir. |
| `action` | Opsional: aksi step. |
| `expected` | Opsional: hasil yang diharapkan. |

Satu baris per step. Baris lanjutan mengosongkan `title` dan kolom lain, hanya mengisi `action`/`expected`; baris kosong dilewati. Contoh:

```csv
suite_path,title,priority,draft,description,preconditions,postconditions,action,expected
Contoh > Login,Login berhasil,High,yes,,,,Buka login,Form tampil
,,,,,,,Isi akun valid dan klik Masuk,Dashboard tampil
Contoh > Login,Password salah,Medium,yes,,,,Isi password salah,Pesan error tampil
```

Header tetap: spasi tepi/BOM diabaikan, huruf besar/kecil disamakan, spasi/underscore/tanda hubung dinormalisasi menjadi `_`. Kolom kosong di kanan (atau bernama `Unnamed: n` dari pandas) yang seluruh selnya kosong diabaikan, tetapi kolom tanpa nama yang berisi nilai (mis. kolom nomor baris) ditolak. Kolom asing, kolom wajib hilang, atau nama kolom ganda ditolak. Tambahan gaya backup `key` dan `step_no` diterima; pada step lanjutan `key` harus kosong/sama dan `step_no` diabaikan. Nilai priority/draft tidak membedakan huruf besar/kecil, tetapi nilai lain ditolak. CSV boleh memakai `,`, `;` (umum pada Excel lokal Indonesia/Eropa), atau TAB; sel berisi pemisah/baris baru harus dikutip. Judul yang sudah ada di suite/plan yang sama dilewati. Maksimal 100 case per panggilan; bagi tabel besar menjadi beberapa batch.

- **CSV:** lampirkan file; AI mengirim teksnya tanpa mengubah isi.
- **Excel (.xlsx):** lampirkan file; AI membaca sheet pertama, mempertahankan header, nilai sel dan susunan baris, lalu mengirim CSV text tanpa meringkas, menggabung, menerjemahkan atau mengurutkan ulang. `.xls`/Numbers perlu diekspor ke `.xlsx` atau CSV dahulu.
- **Google Sheets:** AI memakai akses Google Drive/Sheets miliknya untuk membaca tab berisi case (`gid` pada link). Jika akses tidak tersedia, unduh tab sebagai CSV (File > Download > Comma-separated values) atau `.xlsx`, lalu lampirkan. Hanya jika sheet dibagikan sebagai **"anyone with the link"**, AI boleh mengambil URL ekspor CSV: `https://docs.google.com/spreadsheets/d/<id>/export?format=csv&gid=<tab id>`. Server sendiri tidak mengambil URL.

> Pakai kaspin-kiwi: buat test case baru dari lampiran Excel ini di product KPWEB2 di Kiwi. Baca get_create_format dan sheet pertama, kirim tabel sebagai CSV text, tampilkan preview dulu sebelum menulis.

> Pakai kaspin-kiwi: baca tab test case pada Google Sheets ini dengan akses Google kamu untuk membuat case baru di product KPWEB2 di Kiwi. Ikuti get_create_format; tampilkan preview dulu, lanjut menulis hanya setelah saya setuju.

## Format CSV / XLSX

Satu baris per step. Kolom:
`key, suite_path, title, priority, draft, description, preconditions, postconditions, step_no, action, expected`

- `suite_path`: level suite dipisah ` > `, mis. `Owner > Login > Login with Google`
- baris pertama tiap case membawa data case; baris berikutnya hanya `key`, `step_no`, `action`, `expected`
- `priority`: `High`, `Medium`, `Low`, `Trivial`, `Not set`; `draft`: `yes`/`no`
- `key` wajib dan unik
- contoh siap pakai: `mcp/examples/import-sample.csv` dan `import-sample.xlsx` (4 case, product `MCPTEST`)
- JSON: daftar objek case dengan field yang sama (`steps` berisi `{action, expected}`), atau bentuk lama `scripts/zebrunner_*_suite.json`

## Mode lokal (cadangan, tanpa server)

Server yang sama bisa jalan di laptop lewat stdio, mis. untuk uji atau jaringan tanpa akses ke server. Di mode ini kredensial dibaca dari variabel lingkungan (`KIWI_URL`, `KIWI_USERNAME`, `KIWI_PASSWORD`, `ZEBRUNNER_USERNAME`, `ZEBRUNNER_API_TOKEN`, opsional `ZEBRUNNER_URL`), dan tersedia dua tool tambahan yang membaca/menulis disk lokal: `import_file(path)` dan `zebrunner_backup(url, out_path)` (simpan ke `.json`/`.csv`/`.xlsx`). Kedua tool itu sengaja **tidak ada** di server hosting.

```bash
python3 -m venv ~/.kaspin-kiwi && ~/.kaspin-kiwi/bin/pip install ./mcp   # Python 3.10+
~/.kaspin-kiwi/bin/kaspin-kiwi-mcp --print-config                         # config siap tempel
```

## Pengembangan dan deploy

```bash
cd mcp && uv sync && uv run pytest            # atau: pip install -e . pytest && pytest
uv run kaspin-kiwi-mcp --http --port 8765      # mode hosting lokal; butuh KIWI_URL
```

Pemasangan di server (systemd, nginx, batas resource): lihat `deploy/server/README.md`.

## Status verifikasi

Terbukti di server nyata (`<domain-kiwi>`):
- koneksi lewat nginx + HTTPS, service systemd dengan batas resource, `restart kiwi` ikut me-restart MCP
- autentikasi Zebrunner (header) dan login Kiwi per pengguna
- baca (pratinjau) dan **tulis** ke Kiwi: plan bertingkat, kategori, case, tag; idempoten; job latar belakang untuk suite besar (109 case dalam sekitar 1,5 menit)
- pratinjau suite yang sama memberi hasil identik di Claude Code, Codex CLI, Claude Desktop, dan ChatGPT desktop

Tes otomatis: 27 tes, termasuk server Zebrunner MCP tiruan lewat HTTP.

**Belum** diuji:
- penulisan lewat Codex CLI, Claude Desktop, dan ChatGPT desktop (baru pratinjau)
- lampiran file di chat (`import_csv_text` / `import_cases` pada file nyata) dan jalur `.xlsx`
- akun Kiwi QA biasa (non-admin): izin yang dibutuhkan untuk membuat plan/kategori/case
- Copilot dan Gemini CLI
