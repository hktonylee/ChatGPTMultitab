DIST_DIR := dist
PACKAGE_NAME := chatgpt-multitab-system
PACKAGE_ZIP := $(DIST_DIR)/$(PACKAGE_NAME).zip
PACKAGE_FILES := \
	manifest.json \
	options.html \
	extension-icon.png \
	src \
	styles

.PHONY: package clean-package

package: $(PACKAGE_ZIP)
	@printf 'Created %s\n' "$(PACKAGE_ZIP)"

$(PACKAGE_ZIP): $(PACKAGE_FILES)
	@mkdir -p "$(DIST_DIR)"
	@rm -f "$(PACKAGE_ZIP)"
	@zip -q -r "$(PACKAGE_ZIP)" $(PACKAGE_FILES)

clean-package:
	@rm -f "$(PACKAGE_ZIP)"
