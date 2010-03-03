.PHONY: serve upload

serve:
	python2.5 google_appengine/dev_appserver.py approot

upload:
	python2.5 google_appengine/appcfg.py update -v approot
