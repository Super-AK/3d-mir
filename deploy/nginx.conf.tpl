# 3D-MIR – NGINX-Vhost
# Wird von deploy/install.sh aus dieser Vorlage erzeugt:
#   __DOMAIN__  Domain (z. B. 3d-mir.de)
#   __APP_DIR__ Projektverzeichnis (z. B. /var/www/3d-mir.de)
# TLS wird nach der DNS-Umstellung mit `certbot --nginx` ergänzt.

server {
    listen 80;
    listen [::]:80;

    server_name __DOMAIN__ www.__DOMAIN__;

    root __APP_DIR__/public;
    index index.html;

    server_tokens off;
    charset utf-8;

    client_max_body_size 55m;
    client_body_timeout 120s;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml+rss image/svg+xml application/manifest+json;

    # Sicherheits-Header für dynamische Antworten setzt die Anwendung selbst.
    # Für statische Dateien werden sie hier gesetzt.
    location /assets/ {
        try_files $uri =404;
        expires 30d;
        access_log off;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    }

    # SEO-Dateien kommen aus der Anwendung (dynamische Sitemap).
    location = /robots.txt {
        proxy_pass http://127.0.0.1:__PORT__;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /sitemap.xml {
        proxy_pass http://127.0.0.1:__PORT__;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:__PORT__;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }

    error_page 502 503 504 /50x.html;
    location = /50x.html {
        internal;
        default_type text/html;
        return 503 "<!doctype html><html lang=\"de\"><meta charset=\"utf-8\"><title>Wartung</title><body style=\"font-family:system-ui;padding:2rem\"><h1>Kurz nicht erreichbar</h1><p>Bitte versuchen Sie es in wenigen Minuten erneut.</p></body></html>";
    }
}
