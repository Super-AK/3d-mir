# 3D-MIR – systemd-Unit (Vorlage)
# Platzhalter: __APP_DIR__, __SERVICE_USER__, __DATA_DIR__, __LOG_DIR__

[Unit]
Description=3D-MIR Webseite und 3D-Druck-Rechner
Documentation=https://www.3d-mir.de
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=__SERVICE_USER__
Group=__SERVICE_USER__
WorkingDirectory=__APP_DIR__
EnvironmentFile=/etc/3d-mir/3d-mir.env
ExecStart=/usr/bin/node __APP_DIR__/dist/server.js
Restart=on-failure
RestartSec=3
TimeoutStopSec=20
KillSignal=SIGTERM

# Härtung
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
ProtectClock=true
ProtectHostname=true
RestrictSUIDSGID=true
RestrictRealtime=true
RestrictNamespaces=true
LockPersonality=true
MemoryDenyWriteExecute=false
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
SystemCallFilter=@system-service
SystemCallErrorNumber=EPERM
UMask=0027

# Beschreibbare Pfade
StateDirectory=3d-mir
StateDirectoryMode=0750
LogsDirectory=3d-mir
LogsDirectoryMode=0750
ReadWritePaths=__DATA_DIR__ __LOG_DIR__

[Install]
WantedBy=multi-user.target
