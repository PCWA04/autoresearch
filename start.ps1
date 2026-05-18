$envFile = Join-Path $PSScriptRoot ".env.local"

if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -and -not $_.StartsWith("#")) {
      $parts = $_.Split("=", 2)
      if ($parts.Length -eq 2) {
        [System.Environment]::SetEnvironmentVariable($parts[0], $parts[1], "Process")
      }
    }
  }
}

& "C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" "$PSScriptRoot\server.mjs"
