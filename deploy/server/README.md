# Deploy ke server (gunicorn + nginx + systemd)

Untuk server Ubuntu yang diakses online. Kiwi menolak HTTP biasa (cookie `Secure` dan redirect SSL), jadi HTTPS lewat nginx wajib. Gunicorn hanya mendengarkan di `127.0.0.1:8000`, tidak terbuka ke luar.

```
Browser -> https (nginx :443) -> gunicorn (127.0.0.1:8000) -> PostgreSQL
```

| File | Fungsi |
|---|---|
| `kiwi_prod_settings.py` | Settings produksi (`DEBUG=False`, `SECRET_KEY` dari `.env`, host, DB, folder static) |
| `env.server.example` | Contoh `.env` server |
| `kiwi.service` | Unit systemd untuk gunicorn |
| `nginx-kiwi.conf` | Reverse proxy, HTTPS, dan file static |
| `backup.sh` | Backup `pg_dump` harian |

Prasyarat: setup README utama sudah selesai sampai `migrate` (venv, `npm install && npx webpack`, PostgreSQL).

## 1. Konfigurasi `.env`

```bash
cd ~/kiwi-tcms
git pull
cp .env .env.bak                       # simpan .env lama
cp deploy/server/env.server.example .env
chmod 600 .env
.venv/bin/python -c "import secrets; print(secrets.token_urlsafe(64))"   # isi KIWI_SECRET_KEY
nano .env                              # isi KIWI_SECRET_KEY, password DB, host
```

`KIWI_DB_PASSWORD` harus sama dengan password role `kiwi` di PostgreSQL.

## 2. Gunicorn dan file static

```bash
.venv/bin/python -m pip install gunicorn
sudo mkdir -p /var/www/kiwi/static /var/www/kiwi/uploads
sudo chown -R $USER:$USER /var/www/kiwi

export PYTHONPATH="$PWD:$PWD/Kiwi:$PWD/deploy/server" DJANGO_SETTINGS_MODULE=kiwi_prod_settings
.venv/bin/python Kiwi/manage.py migrate
.venv/bin/python Kiwi/manage.py collectstatic --noinput
.venv/bin/python Kiwi/manage.py check --deploy
```

## 3. systemd

Hentikan `runserver` lama dulu (`pkill -f "manage.py runserver"`).

```bash
sudo cp deploy/server/kiwi.service /etc/systemd/system/kiwi.service
sudo systemctl daemon-reload
sudo systemctl enable --now kiwi
systemctl status kiwi
journalctl -u kiwi -f          # log
curl -I http://127.0.0.1:8000/ # harus 200 atau 30x
```

## 4. nginx dan HTTPS

```bash
sudo apt install nginx
sudo cp deploy/server/nginx-kiwi.conf /etc/nginx/sites-available/kiwi
sudo ln -s /etc/nginx/sites-available/kiwi /etc/nginx/sites-enabled/kiwi
sudo rm -f /etc/nginx/sites-enabled/default
```

**Sementara tanpa domain (self-signed, IP saja).** Browser menampilkan peringatan sekali per orang:

```bash
sudo mkdir -p /etc/ssl/kiwi
sudo openssl req -x509 -nodes -newkey rsa:4096 -days 365 \
  -keyout /etc/ssl/kiwi/kiwi.key -out /etc/ssl/kiwi/kiwi.crt \
  -subj "/CN=199.180.128.65" -addext "subjectAltName=IP:199.180.128.65"
sudo chmod 600 /etc/ssl/kiwi/kiwi.key
sudo nginx -t && sudo systemctl reload nginx
```

Akses `https://199.180.128.65`. Port 80 dan 443 harus dibuka di firewall (koordinasi dengan tim infra).

**Setelah domain siap (Let's Encrypt):**

1. A record domain mengarah ke IP server.
2. Ubah `server_name _;` menjadi domain di `/etc/nginx/sites-available/kiwi`.
3. `sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx -d tcms.domain-kamu.id` (certbot mengganti path sertifikat dan memperbarui otomatis).
4. Ubah `KIWI_ALLOWED_HOSTS` dan `KIWI_CSRF_TRUSTED_ORIGINS` di `.env` ke domain, lalu `sudo systemctl restart kiwi`.

## 5. Backup

```bash
chmod +x deploy/server/backup.sh
deploy/server/backup.sh                  # tes sekali
crontab -e
# tambahkan:
0 2 * * * /home/gallanwidyanto/kiwi-tcms/deploy/server/backup.sh >> /home/gallanwidyanto/kiwi-backup.log 2>&1
```

Backup berada di `~/kiwi-backups` (14 hari terakhir). Salin juga ke luar server secara berkala. File upload ada di `/var/www/kiwi/uploads`.

## Update aplikasi

```bash
~/kiwi-tcms/deploy/server/update.sh
```

Skrip ini menjalankan `git pull`, submodule, `migrate`, `collectstatic`, memperbarui venv MCP, lalu `systemctl restart kiwi` (MCP ikut restart bila sedang jalan).

## Kaspin Kiwi MCP (opsional)

MCP di `mcp/` dijalankan sebagai service terpisah `kiwi-mcp` dengan venv sendiri (`mcp/.venv`), di port 8765 (hanya `127.0.0.1`), dan diakses publik lewat nginx di `https://<domain-kiwi>/mcp`. Pemakaian RAM sekitar 60-90 MB; batas `MemoryMax`/`CPUQuota` ada di unit.

### Pemasangan pertama (sekali)

```bash
cd ~/kiwi-tcms && git pull
python3 -m venv mcp/.venv && mcp/.venv/bin/pip install ./mcp        # butuh Python 3.10+
cp deploy/server/mcp.env.example deploy/server/mcp.env && chmod 600 deploy/server/mcp.env
nano deploy/server/mcp.env                                          # cek KIWI_URL, ZEBRUNNER_URL, MCP_ALLOWED_HOSTS

sudo cp deploy/server/kiwi-mcp.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now kiwi-mcp
```

nginx: salin blok `location /mcp` dari `nginx-kiwi.conf` ke konfigurasi yang aktif, dan tambahkan zona rate limit di blok `http`
(`/etc/nginx/conf.d/mcp-limit.conf`):

```
limit_req_zone $binary_remote_addr zone=mcp:10m rate=5r/s;
```

lalu `sudo nginx -t && sudo systemctl reload nginx`. Cek: `curl https://<domain-kiwi>/mcp/health` harus membalas `{"status":"ok",...}`. Membuka `/mcp` di browser menampilkan `406 Not Acceptable` (JSON): itu normal, endpoint ini hanya untuk klien MCP.

### Perintah sehari-hari

| Tujuan | Perintah |
|---|---|
| Restart Kiwi **dan** MCP | `sudo systemctl restart kiwi` |
| Restart hanya MCP | `sudo systemctl restart kiwi-mcp` |
| Matikan MCP sementara (Kiwi tetap jalan) | `sudo systemctl stop kiwi-mcp` |
| Matikan MCP permanen (tidak start saat boot) | `sudo systemctl disable --now kiwi-mcp` |
| Nyalakan lagi | `sudo systemctl enable --now kiwi-mcp` |
| Lihat pemakaian RAM/CPU | `systemctl status kiwi-mcp` (baris `Memory:`) |
| Log | `journalctl -u kiwi-mcp -n 100` |

Aturan: `restart kiwi` hanya me-restart MCP yang **sedang jalan** (`PartOf=`). MCP yang dimatikan tidak ikut menyala. Jangan memakai `stop kiwi` lalu `start kiwi` untuk memperbarui: `stop kiwi` ikut menghentikan MCP, dan `start kiwi` tidak menyalakannya lagi. Pakai `restart`, atau jalankan `start kiwi-mcp` setelahnya.

### Verifikasi perilaku systemd (jalankan sekali setelah pasang)

Perilaku `PartOf=` mengikuti dokumentasi systemd dan belum diuji di server ini. Cek dengan tiga langkah:

1. MCP jalan, `sudo systemctl restart kiwi` -> `systemctl status kiwi-mcp` menunjukkan waktu start baru.
2. `sudo systemctl stop kiwi-mcp`, lalu `sudo systemctl restart kiwi` -> `kiwi-mcp` tetap `inactive`.
3. `sudo systemctl disable --now kiwi-mcp`, reboot atau `daemon-reload` -> `kiwi` tetap naik, `kiwi-mcp` tidak.

### Keamanan

- Password Kiwi dan token Zebrunner tidak disimpan di server; tiap QA mengirimnya lewat header HTTPS. Jangan mengaktifkan log header di nginx.
- Host Zebrunner dikunci oleh `ZEBRUNNER_URL`.
- Endpoint dibatasi rate limit per IP di nginx.

## Catatan

- Ganti password `admin` dengan yang kuat. Batasi pembuatan akun jika perlu.
- `.env` berisi rahasia, tetap di-ignore git (`chmod 600`).
- Dependency npm Kiwi punya peringatan `npm audit` (moderate), berasal dari upstream. Batasi akses jaringan (VPN atau allowlist IP kantor) bila memungkinkan.
- Troubleshooting: `journalctl -u kiwi -n 100`, `sudo tail /var/log/nginx/error.log`. `502` berarti gunicorn mati. `400 Bad Request` biasanya `ALLOWED_HOSTS`. `403 CSRF` biasanya `CSRF_TRUSTED_ORIGINS`. CSS hilang berarti `collectstatic` atau izin `/var/www/kiwi`.
