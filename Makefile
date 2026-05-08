WINDOWS_CERT_DIR ?= certs
WINDOWS_CERT_NAME ?= ChatGPT Multitab Local Code Signing
WINDOWS_CERT_PFX ?= $(WINDOWS_CERT_DIR)/chatgpt-multitab-code-signing.pfx
WINDOWS_CERT_PASSWORD_FILE ?= $(WINDOWS_CERT_DIR)/chatgpt-multitab-code-signing.password.txt
WINDOWS_SIGN_EXE ?= dist/win-unpacked/chatgpt-multitab.exe
WINDOWS_SIGN_TIMESTAMP_URL ?= http://timestamp.digicert.com

.PHONY: windows-code-sign-cert
windows-code-sign-cert:
	@mkdir -p "$(WINDOWS_CERT_DIR)"
	@powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "\
		\$$ErrorActionPreference = 'Stop'; \
		\$$certPath = '$(WINDOWS_CERT_PFX)'; \
		\$$passwordPath = '$(WINDOWS_CERT_PASSWORD_FILE)'; \
		if (Test-Path \$$certPath) { throw \"Certificate already exists: \$$certPath\" }; \
		if (Test-Path \$$passwordPath) { throw \"Password file already exists: \$$passwordPath\" }; \
		\$$passwordBytes = New-Object byte[] 32; \
		[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes(\$$passwordBytes); \
		\$$password = [Convert]::ToBase64String(\$$passwordBytes); \
		\$$securePassword = ConvertTo-SecureString -String \$$password -Force -AsPlainText; \
		\$$cert = New-SelfSignedCertificate \
			-Type CodeSigningCert \
			-Subject 'CN=$(WINDOWS_CERT_NAME)' \
			-CertStoreLocation 'Cert:\CurrentUser\My' \
			-KeyExportPolicy Exportable \
			-KeySpec Signature \
			-KeyLength 2048 \
			-KeyAlgorithm RSA \
			-HashAlgorithm SHA256 \
			-NotAfter (Get-Date).AddYears(3); \
		Export-PfxCertificate -Cert \$$cert -FilePath \$$certPath -Password \$$securePassword | Out-Null; \
		Set-Content -Path \$$passwordPath -Value \$$password -NoNewline; \
		Write-Host \"Created \$$certPath\"; \
		Write-Host \"Saved password in \$$passwordPath\"; \
		Write-Host \"Use for Windows packaging:\"; \
		Write-Host \"  CSC_LINK=\$$certPath CSC_KEY_PASSWORD=\$$password npm run dist:win\"; \
	"

.PHONY: windows-sign-exe
windows-sign-exe:
	@powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "\
		\$$ErrorActionPreference = 'Stop'; \
		\$$exePath = '$(WINDOWS_SIGN_EXE)'; \
		\$$certPath = '$(WINDOWS_CERT_PFX)'; \
		\$$passwordPath = '$(WINDOWS_CERT_PASSWORD_FILE)'; \
		if (-not (Test-Path \$$exePath)) { throw \"Executable not found: \$$exePath\" }; \
		if (-not (Test-Path \$$certPath)) { throw \"Certificate not found: \$$certPath. Run make windows-code-sign-cert first.\" }; \
		if (-not (Test-Path \$$passwordPath)) { throw \"Certificate password file not found: \$$passwordPath. Run make windows-code-sign-cert first.\" }; \
		\$$password = Get-Content -Raw \$$passwordPath; \
		\$$signtool = Get-Command signtool.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1; \
		\$$kitsRoot = Join-Path ([Environment]::GetEnvironmentVariable('ProgramFiles(x86)')) 'Windows Kits\10\bin'; \
		if (-not \$$signtool -and (Test-Path \$$kitsRoot)) { \
			\$$signtool = Get-ChildItem -Path \$$kitsRoot -Recurse -Filter signtool.exe | Sort-Object FullName -Descending | Select-Object -ExpandProperty FullName -First 1; \
		}; \
		\$$timestampUrl = '$(WINDOWS_SIGN_TIMESTAMP_URL)'; \
		if (\$$signtool) { \
			\$$args = @('sign', '/f', (Resolve-Path \$$certPath).Path, '/p', \$$password, '/fd', 'SHA256', '/v'); \
			if (\$$timestampUrl) { \$$args += @('/tr', \$$timestampUrl, '/td', 'SHA256') }; \
			\$$args += (Resolve-Path \$$exePath).Path; \
			& \$$signtool @args; \
			if (\$$LASTEXITCODE -ne 0) { exit \$$LASTEXITCODE }; \
		} else { \
			\$$subject = 'CN=$(WINDOWS_CERT_NAME)'; \
			\$$cert = Get-ChildItem 'Cert:\CurrentUser\My' | Where-Object { \$$_.Subject -eq \$$subject -and \$$_.HasPrivateKey } | Sort-Object NotAfter -Descending | Select-Object -First 1; \
			if (-not \$$cert) { throw \"Code signing certificate not found in Cert:\CurrentUser\My for \$$subject. Run make windows-code-sign-cert first.\" }; \
			\$$signatureArgs = @{ FilePath = (Resolve-Path \$$exePath).Path; Certificate = \$$cert; HashAlgorithm = 'SHA256' }; \
			if (\$$timestampUrl) { \$$signatureArgs.TimestampServer = \$$timestampUrl }; \
			\$$signature = Set-AuthenticodeSignature @signatureArgs; \
			if (-not \$$signature.SignerCertificate) { throw \"Signing failed: \$$(\$$signature.Status) \$$(\$$signature.StatusMessage)\" }; \
			if (\$$signature.Status -ne 'Valid') { Write-Warning \"Signed, but Windows reports: \$$(\$$signature.Status) \$$(\$$signature.StatusMessage)\" }; \
		}; \
		Write-Host \"Signed \$$exePath\"; \
	"
