# Run Claude Code through OmniRoute instead of the Anthropic account — for
# when the Claude usage limit is reached. Same tool, same repo rules
# (AGENTS.md, the roadmap); only the model provider changes.
#
# One-time setup (your NEW key — never commit it, never paste it in chat):
#   [Environment]::SetEnvironmentVariable("OMNIROUTE_KEY", "<key>", "User")
#   (then open a new terminal)
#
# Use:
#   .\scripts\claude-omniroute.ps1 -Model <omniroute-model-name>
#   .\scripts\claude-omniroute.ps1 -Model <name> -Continue   # resume the last session
#   .\scripts\claude-omniroute.ps1 -Test -Model <name>        # just check the key + model
#
# The variables are set for this process only; a normal `claude` run in
# another terminal still uses the Anthropic account.

param(
  [Parameter(Mandatory = $true)][string]$Model,
  [string]$FastModel = "",
  [string]$BaseUrl = "https://omniroute-noodeenv.up.railway.app",
  [switch]$Continue,
  [switch]$Test
)

$key = [Environment]::GetEnvironmentVariable("OMNIROUTE_KEY", "User")
if (-not $key) { $key = $env:OMNIROUTE_KEY }
if (-not $key) {
  Write-Error "OMNIROUTE_KEY is not set. See the setup line at the top of this script."
  exit 1
}

if ($Test) {
  $body = @{
    model      = $Model
    max_tokens = 20
    messages   = @(@{ role = "user"; content = "Reply with the single word: ok" })
  } | ConvertTo-Json -Depth 5
  try {
    $r = Invoke-RestMethod -Method Post -Uri "$BaseUrl/v1/messages" `
      -Headers @{ "x-api-key" = $key; "authorization" = "Bearer $key"; "anthropic-version" = "2023-06-01" } `
      -ContentType "application/json" -Body $body -TimeoutSec 60
    Write-Host "OK - OmniRoute answered with model '$Model':"
    $r.content | ForEach-Object { $_.text }
  } catch {
    Write-Host "FAILED: $($_.Exception.Message)"
    Write-Host "Check the key, the model name (GET $BaseUrl/v1/models with the key), and that /v1/messages is enabled."
    exit 1
  }
  exit 0
}

$env:ANTHROPIC_BASE_URL   = $BaseUrl
$env:ANTHROPIC_AUTH_TOKEN = $key
$env:ANTHROPIC_MODEL      = $Model
$env:ANTHROPIC_SMALL_FAST_MODEL = $(if ($FastModel) { $FastModel } else { $Model })
Remove-Item Env:ANTHROPIC_API_KEY -ErrorAction SilentlyContinue

Write-Host "Claude Code -> OmniRoute ($BaseUrl), model $Model"
Write-Host "Reminder: AGENTS.md rules apply (no push, no deploy, .env is production)."
if ($Continue) { claude --continue } else { claude }
