WINDOWS_CERT_DIR ?= certs
WINDOWS_CERT_NAME ?= ChatGPT Multitab Local Code Signing
WINDOWS_CERT_PFX ?= $(WINDOWS_CERT_DIR)/chatgpt-multitab-code-signing.pfx
WINDOWS_CERT_PASSWORD_FILE ?= $(WINDOWS_CERT_DIR)/chatgpt-multitab-code-signing.password.txt

.PHONY: windows-code-sign-cert
windows-code-sign-cert:
	@mkdir -p "$(WINDOWS_CERT_DIR)"
	@powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "\
		$$ErrorActionPreference = 'Stop'; \
		$$certPath = '$(WINDOWS_CERT_PFX)'; \
		$$passwordPath = '$(WINDOWS_CERT_PASSWORD_FILE)'; \
		if (Test-Path $$certPath) { throw \"Certificate already exists: $$certPath\" }; \
		if (Test-Path $$passwordPath) { throw \"Password file already exists: $$passwordPath\" }; \
		$$password = [System.Web.Security.Membership]::GeneratePassword(32, 8); \
		$$securePassword = ConvertTo-SecureString -String $$password -Force -AsPlainText; \
		$$cert = New-SelfSignedCertificate \
			-Type CodeSigningCert \
			-Subject 'CN=$(WINDOWS_CERT_NAME)' \
			-CertStoreLocation 'Cert:\CurrentUser\My' \
			-KeyExportPolicy Exportable \
			-KeySpec Signature \
			-KeyLength 2048 \
			-KeyAlgorithm RSA \
			-HashAlgorithm SHA256 \
			-NotAfter (Get-Date).AddYears(3); \
		Export-PfxCertificate -Cert $$cert -FilePath $$certPath -Password $$securePassword | Out-Null; \
		Set-Content -Path $$passwordPath -Value $$password -NoNewline; \
		Write-Host \"Created $$certPath\"; \
		Write-Host \"Saved password in $$passwordPath\"; \
		Write-Host \"Use for Windows packaging:\"; \
		Write-Host \"  CSC_LINK=$$certPath CSC_KEY_PASSWORD=$$password npm run dist:win\"; \
	"
