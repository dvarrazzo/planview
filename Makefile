EMAIL = daniele.varrazzo@gmail.com

PYTHON_VER = 2.5
APPENGINE_VER = 1.3.1

PYTHON = python${PYTHON_VER}

.PHONY: serve upload check

serve:
	cd dbplanview && ${PYTHON} manage.py runserver

upload:
	cd dbplanview/ && ${PYTHON} manage.py update -v -e ${EMAIL}

rollback:
	cd dbplanview/ && ${PYTHON} manage.py rollback

check:
	${PYTHON} `which nosetests` -w test

install_lib:
	# this can't be easy_installed but needs hacking the setup.py
	# PYTHONPATH=lib easy_install-2.5 -s bin -d lib ssl
	PYTHONPATH=lib easy_install-${PYTHON_VER} -s bin -d lib django
	wget http://googleappengine.googlecode.com/files/google_appengine_${APPENGINE_VER}.zip
	unzip google_appengine_${APPENGINE_VER}.zip
	rm google_appengine_${APPENGINE_VER}.zip
	(cd dbplanview && ln -s ../google_appengine .google_appengine)
