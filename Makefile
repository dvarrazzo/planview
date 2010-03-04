EMAIL = daniele.varrazzo@gmail.com

.PHONY: serve upload check

serve:
	cd dbplanview && python2.5 manage.py runserver

upload:
	cd dbplanview/ && python2.5 manage.py update -v -e ${EMAIL}

rollback:
	cd dbplanview/ && python2.5 manage.py rollback

check:
	python2.5 `which nosetests` -w test
