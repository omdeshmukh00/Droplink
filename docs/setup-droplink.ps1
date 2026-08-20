# DropLink setup script
# Run from PowerShell in an empty directory.

$ErrorActionPreference = 'Stop'

$root = 'DropLink'
New-Item -ItemType Directory -Force -Path $root | Out-Null
Set-Location $root

$folders = @(
  'frontend/app',
  'frontend/components',
  'frontend/features',
  'frontend/lib',
  'frontend/public',
  'frontend/styles',
  'frontend/types',
  'backend/src/config',
  'backend/src/middleware',
  'backend/src/models',
  'backend/src/modules/upload',
  'backend/src/modules/transfer',
  'backend/src/modules/download',
  'backend/src/modules/cleanup',
  'backend/src/routes',
  'backend/src/services',
  'backend/src/utils',
  'backend/uploads',
  'docs'
)

foreach ($folder in $folders) {
  New-Item -ItemType Directory -Force -Path $folder | Out-Null
}

$files = @(
  'frontend/.env.example',
  'frontend/package.json',
  'frontend/tsconfig.json',
  'frontend/next.config.ts',
  'backend/.env.example',
  'backend/package.json',
  'backend/tsconfig.json',
  'backend/src/server.ts',
  'backend/src/config/env.ts',
  'backend/src/config/db.ts',
  'README.md',
  'docs/PRD.md'
)

foreach ($file in $files) {
  New-Item -ItemType File -Force -Path $file | Out-Null
}

Write-Host 'Folder structure created.'
Write-Host 'Next steps: initialize frontend and backend dependencies manually or with npm commands in the guide.'
