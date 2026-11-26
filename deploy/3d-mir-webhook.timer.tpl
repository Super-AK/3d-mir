[Unit]
Description=3D-MIR Webhook-Zustellung (minütlich)

[Timer]
OnCalendar=*:0/1
AccuracySec=10s
Persistent=true
Unit=3d-mir-webhook.service

[Install]
WantedBy=timers.target
