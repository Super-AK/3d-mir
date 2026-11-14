[Unit]
Description=3D-MIR Uptime-Check alle fünf Minuten

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
Unit=3d-mir-monitor.service
Persistent=true

[Install]
WantedBy=timers.target
