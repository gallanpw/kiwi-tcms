# kaspin kiwi (MCP)

Salin test case dari **Zebrunner** (URL suite atau URL satu test case) ke **Kiwi TCMS**, atau upload file `.csv` / `.xlsx` / `.json`, lewat AI (Claude, Codex, Copilot, Gemini).

Cara kerja: server MCP ini di-hosting di server Kiwi (`https://<domain-kiwi>/mcp`). QA tidak memasang apa pun, cukup menempel config di AI-nya, mirip MCP Zebrunner. Kredensial tiap QA dikirim lewat header, jadi **author case = QA tersebut** dan izin Kiwi tetap berlaku. Cakupan saat ini: **test case** (test run menyusul).

## Tool

| Tool | Fungsi |
|---|---|
| `check_connection(zebrunner_url?)` | Cek login Kiwi dan akses Zebrunner. Jalankan ini pertama kali. |
| `import_from_zebrunner(url, dry_run=true)` | URL suite (`?suiteId=`): suite itu + semua child + suite induknya. URL case (`?caseId=`): satu case + rantai suite induknya. |
| `get_file_format()` | Format kolom CSV/XLSX/JSON, supaya AI bisa memetakan spreadsheet apa pun. |
| `import_cases(cases, product, dry_run=true)` | Import data langsung (maks 100 case per panggilan). |
| `import_csv_text(csv_text, product, dry_run=true)` | Import isi CSV (maks 100 case). |
| `create_upload_link()` | Link upload sekali pakai (15 menit, maks 5 MB) untuk file besar. |
| `import_uploaded_file(upload_id, product, dry_run=true)` | Import file yang sudah diunggah lewat link. |
| `get_import_status(job_id)` | Progres import besar. |

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

```json
"kaspin-kiwi": {
  "command": "npx",
  "args": [
    "-y", "mcp-remote@latest", "https://<domain-kiwi>/mcp",
    "--header", "X-Kiwi-Username:<user>",
    "--header", "X-Kiwi-Password:<password>",
    "--header", "X-Zebrunner-Username:<user zebrunner>",
    "--header", "X-Zebrunner-Api-Token:<token>"
  ]
}
```

Claude Pro/Team juga bisa lewat Settings -> Connectors -> Custom Connector, mengisi URL dan keempat header.

### Codex CLI (`~/.codex/config.toml`)

Nilai header dibaca dari environment, jadi password tidak tersimpan di file:

```toml
[mcp_servers.kaspin-kiwi]
url = "https://<domain-kiwi>/mcp"
tool_timeout_sec = 120

[mcp_servers.kaspin-kiwi.env_http_headers]
X-Kiwi-Username = "KIWI_USERNAME"
X-Kiwi-Password = "KIWI_PASSWORD"
X-Zebrunner-Username = "ZEBRUNNER_USERNAME"
X-Zebrunner-Api-Token = "ZEBRUNNER_API_TOKEN"
```

Lalu export keempat variabel itu di shell sebelum menjalankan `codex`.

### GitHub Copilot (VS Code, `.vscode/mcp.json`) dan Gemini CLI

Belum diuji; format di bawah mengikuti dokumentasi umum masing-masing dan **perlu dicek**:

```json
{ "servers": { "kaspin-kiwi": { "type": "http", "url": "https://<domain-kiwi>/mcp",
    "headers": { "X-Kiwi-Username": "<user>", "X-Kiwi-Password": "<password>",
                 "X-Zebrunner-Username": "<user zebrunner>", "X-Zebrunner-Api-Token": "<token>" } } } }
```

Gemini CLI (`~/.gemini/settings.json`): kunci `mcpServers.kaspin-kiwi` dengan `httpUrl` dan `headers` yang sama.

### ChatGPT desktop

**Belum didukung.** Connector kustom ChatGPT memakai OAuth atau tanpa autentikasi dan, sepengetahuan kami, tidak bisa mengirim header. Pengguna GPT memakai Codex CLI.

## Contoh prompt

> Pakai kaspin kiwi: cek koneksi, lalu dry run import dari https://<workspace>.zebrunner.com/projects/KPWEB2/test-cases?suiteId=1616

> Import test case ini: https://<workspace>.zebrunner.com/projects/KPPOS/test-cases?caseId=898

> Baca file test-cases.csv ini dan import ke product KPWEB2 (dry run dulu)

File kecil (sampai sekitar 50 case) cukup ditempel atau dilampirkan di chat; AI memanggil `import_cases`. File besar (sampai 500+ case): minta AI membuat link upload, unggah file di browser (atau AI terminal menjalankan `curl`), lalu `import_uploaded_file`. Data tidak lewat konteks AI sehingga tidak ada risiko berubah atau terpotong.

## Format CSV / XLSX

Satu baris per step. Kolom:
`key, suite_path, title, priority, draft, description, preconditions, postconditions, step_no, action, expected`

- `suite_path`: level suite dipisah ` > `, mis. `Owner > Login > Login with Google`
- baris pertama tiap case membawa data case; baris berikutnya hanya `key`, `step_no`, `action`, `expected`
- `priority`: `High`, `Medium`, `Low`, `Trivial`, `Not set`; `draft`: `yes`/`no`
- `key` wajib dan unik
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

Sudah diuji:
- 24 tes otomatis, termasuk server Zebrunner MCP tiruan lewat HTTP (header, paging, rantai suite induk).
- Uji penuh lokal: Kiwi sungguhan + server MCP mode HTTP + klien MCP yang mengirim header. Mencakup import suite (40 case via job), ulang tanpa duplikat, URL satu case, `import_cases`, CSV, upload 60 case, isolasi antar-user, dan penolakan host Zebrunner lain.

**Belum** diuji:
- Zebrunner sungguhan (alur autentikasi header mengikuti dokumentasi Zebrunner).
- systemd, nginx, dan HTTPS di server nyata.
- Tiap aplikasi AI (Claude Desktop, Codex, Copilot, Gemini); format config mengikuti dokumentasi vendor.
