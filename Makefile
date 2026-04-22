DIST_DIR := dist
PACKAGE_NAME := chatgpt-multitab-system
PACKAGE_ZIP := $(DIST_DIR)/$(PACKAGE_NAME).zip
FIREFOX_PACKAGE_XPI := $(DIST_DIR)/$(PACKAGE_NAME)-firefox.xpi

.PHONY: package package-chromium package-firefox clean-package

package: package-chromium

package-chromium:
	@npm run package:chromium

package-firefox:
	@npm run package:firefox

clean-package:
	@rm -rf "$(DIST_DIR)/build" "$(PACKAGE_ZIP)" "$(FIREFOX_PACKAGE_XPI)"
