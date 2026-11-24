[Unit]
Description=3D-MIR Webhook-Zustellung (minütlich)

[Timer]
OnUnitActiveSec=1min
AccuracySec=10s
Persistent=true
Unit=3d-mir-webhook.service

[Install]
WantedBy=timers.target
