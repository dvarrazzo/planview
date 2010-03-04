.PHONY: serve upload check

serve:
	python2.5 google_appengine/dev_appserver.py approot

upload:
	python2.5 google_appengine/appcfg.py update -v approot

check:
	python2.5 `which nosetests` -w test
