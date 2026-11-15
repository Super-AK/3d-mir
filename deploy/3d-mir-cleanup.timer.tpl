[Unit]
Description=3D-MIR tägliche Löschung alter Uploads und Anfragen

[Timer]
OnCalendar=*-*-* 03:30:00
Persistent=true
Unit=3d-mir-cleanup.service

[Install]
WantedBy=timers.target
